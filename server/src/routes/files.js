const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 1024;

// Rate limiter: max 120 requests per minute per IP for file operations
const fileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

// Apply rate limiter first, then auth, so rate limiting is not bypassable
router.use(fileLimiter);
router.use(authMiddleware);

/**
 * Extract a single string query parameter safely.
 * Express allows duplicate params which results in an array — reject those.
 */
function getStringParam(value) {
  if (typeof value === 'string') return value;
  return null;
}

/**
 * Safely resolve and validate a requested path to prevent directory traversal
 * and null-byte injection. Only accepts absolute paths that start with a known
 * drive/mount-point root.
 * Returns the resolved absolute path, or null if the path is not safe.
 */
function safePath(requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') return null;

  // Reject null bytes (common injection vector)
  if (requestedPath.includes('\0')) return null;

  // Only allow absolute paths — the client receives these from server responses,
  // so there is no legitimate reason to send a relative path.
  if (!path.isAbsolute(requestedPath)) return null;

  // Resolve to normalize any remaining . or .. components
  const resolved = path.resolve(requestedPath);

  // Guard against any post-resolution null bytes
  if (resolved.includes('\0')) return null;

  // Verify the resolved path starts with a known allowed root (drive/mount point).
  // This prevents access to paths that could not be reached via normal navigation.
  const allowedRoots = getAvailableDrives().map((d) => d.path);
  const isUnderAllowedRoot = allowedRoots.some((root) => {
    if (root === '/' || root === path.sep) return resolved.startsWith('/');
    return resolved === root || resolved.startsWith(root + path.sep);
  });
  if (!isUnderAllowedRoot) return null;

  return resolved;
}

/**
 * List available drives / mount points.
 */
router.get('/drives', (req, res) => {
  try {
    const drives = getAvailableDrives();
    res.json({ drives });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List files and folders in a directory.
 */
router.get('/files', (req, res) => {
  const requestedPath = getStringParam(req.query.path);

  if (!requestedPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  const resolved = safePath(requestedPath);
  if (!resolved) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Path not found' });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: 'Path is not a directory' });
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith('.') || process.env.SHOW_HIDDEN === 'true')
      .map((e) => {
        const fullPath = path.join(resolved, e.name);
        let size = null;
        let mtime = null;
        try {
          const s = fs.statSync(fullPath);
          size = e.isFile() ? s.size : null;
          mtime = s.mtime.toISOString();
        } catch {
          // skip unreadable entries
        }
        return {
          name: e.name,
          path: fullPath,
          isDirectory: e.isDirectory(),
          isFile: e.isFile(),
          size,
          mtime,
          mimeType: e.isFile() ? mime.lookup(e.name) || 'application/octet-stream' : null,
        };
      })
      .sort((a, b) => {
        // Directories first, then files
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    res.json({
      path: resolved,
      parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload a file into a directory. The destination directory is passed as a
 * query parameter (not a multipart field) so it is available before multer
 * needs it to pick a destination, regardless of multipart field ordering.
 * Existing files with the same name are overwritten.
 */
const uploadStorage = multer.diskStorage({
  destination(req, file, cb) {
    const requestedPath = getStringParam(req.query.path);
    const resolved = requestedPath && safePath(requestedPath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return cb(new Error('Invalid destination path'));
    }
    req.uploadDestDir = resolved;
    cb(null, resolved);
  },
  filename(req, file, cb) {
    const safeName = path.basename(file.originalname || '');
    if (!safeName || safeName === '.' || safeName === '..') {
      return cb(new Error('Invalid file name'));
    }
    req.uploadFileName = safeName;
    cb(null, safeName);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File exceeds maximum upload size of ${MAX_UPLOAD_MB} MB` });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const fullPath = path.join(req.uploadDestDir, req.uploadFileName);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      return res.status(500).json({ error: 'Upload succeeded but file could not be read back' });
    }

    res.json({
      name: req.uploadFileName,
      path: fullPath,
      isDirectory: false,
      isFile: true,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      mimeType: mime.lookup(fullPath) || 'application/octet-stream',
    });
  });
});

/**
 * Download a file.
 */
router.get('/download', (req, res) => {
  const requestedPath = getStringParam(req.query.path);

  if (!requestedPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  const resolved = safePath(requestedPath);
  if (!resolved) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return res.status(400).json({ error: 'Path is not a file' });
  }

  const mimeType = mime.lookup(resolved) || 'application/octet-stream';
  const fileName = path.basename(resolved);

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Content-Length', stat.size);

  const stream = fs.createReadStream(resolved);
  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });
  stream.pipe(res);
});

/**
 * Preview a file (inline, without forcing download).
 */
router.get('/preview', (req, res) => {
  const requestedPath = getStringParam(req.query.path);

  if (!requestedPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  const resolved = safePath(requestedPath);
  if (!resolved) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return res.status(400).json({ error: 'Path is not a file' });
  }

  const mimeType = mime.lookup(resolved) || 'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(resolved))}"`);
  res.setHeader('Content-Length', stat.size);

  const stream = fs.createReadStream(resolved);
  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });
  stream.pipe(res);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAvailableDrives() {
  if (process.platform === 'win32') {
    return getWindowsDrives();
  }
  return getUnixMounts();
}

function getWindowsDrives() {
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    if (fs.existsSync(drivePath)) {
      drives.push({ name: `${letter}:`, path: drivePath, type: 'drive' });
    }
  }
  return drives;
}

function getUnixMounts() {
  const drives = [];
  const seen = new Set();

  // Always include root
  drives.push({ name: 'Root (/)', path: '/', type: 'root' });
  seen.add('/');

  // Read /proc/mounts if available (Linux)
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    mounts.split('\n').forEach((line) => {
      const parts = line.split(' ');
      if (parts.length < 3) return;

      const device = parts[0];
      const mountPoint = parts[1];
      const fsType = parts[2];

      // Skip virtual/pseudo filesystems
      const skipTypes = ['proc', 'sysfs', 'devpts', 'tmpfs', 'cgroup', 'cgroup2',
        'pstore', 'bpf', 'tracefs', 'debugfs', 'securityfs', 'fusectl',
        'hugetlbfs', 'mqueue', 'devtmpfs', 'configfs', 'efivarfs', 'autofs',
        'squashfs', 'overlay', 'none', 'binfmt_misc', 'ramfs', 'nsfs',
        'rpc_pipefs', 'nfsd', 'sunrpc', 'selinuxfs', 'cifs', 'fuse.gvfsd-fuse'];

      if (skipTypes.includes(fsType)) return;
      if (seen.has(mountPoint)) return;
      if (!mountPoint.startsWith('/')) return;

      // Skip snap/loop mounts
      if (device.startsWith('/dev/loop') || mountPoint.startsWith('/snap/')) return;

      seen.add(mountPoint);

      const name = mountPoint === '/' ? 'Root (/)' : path.basename(mountPoint) || mountPoint;
      drives.push({ name, path: mountPoint, type: fsType, device });
    });
  } catch {
    // /proc/mounts not available (macOS or container)
  }

  // macOS: use /Volumes
  if (process.platform === 'darwin') {
    try {
      const volumes = fs.readdirSync('/Volumes');
      volumes.forEach((v) => {
        const vPath = `/Volumes/${v}`;
        if (!seen.has(vPath)) {
          seen.add(vPath);
          drives.push({ name: v, path: vPath, type: 'volume' });
        }
      });
    } catch {
      // ignore
    }
  }

  return drives;
}

module.exports = router;
