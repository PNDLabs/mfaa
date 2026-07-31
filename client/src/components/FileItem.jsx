import React from 'react';
import { downloadUrl, previewUrl, qrUrl } from '../api';

const PREVIEWABLE_TYPES = [
  'image/', 'video/', 'audio/', 'text/', 'application/pdf',
  'application/json', 'application/xml',
];

function isPreviewable(mimeType) {
  if (!mimeType) return false;
  return PREVIEWABLE_TYPES.some((t) => mimeType.startsWith(t));
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function fileIcon(item) {
  if (item.isDirectory) return '📁';
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('text/')) return '📝';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz') || mime.includes('rar')) return '🗜️';
  return '📄';
}

export default function FileItem({ item, onNavigate, onPreview, onQR }) {
  const dUrl = item.isFile ? downloadUrl(item.path) : null;
  const pUrl = item.isFile && isPreviewable(item.mimeType) ? previewUrl(item.path) : null;

  function handleQR() {
    if (!dUrl) return;
    // Build the absolute download URL for QR code
    const absoluteUrl = window.location.origin + dUrl;
    onQR(absoluteUrl, item.name);
  }

  return (
    <tr className={`file-row ${item.isDirectory ? 'is-dir' : 'is-file'}`}>
      <td className="file-icon-cell">{fileIcon(item)}</td>
      <td className="file-name-cell">
        {item.isDirectory ? (
          <button className="link-btn" onClick={() => onNavigate(item.path)}>
            {item.name}
          </button>
        ) : (
          <span>{item.name}</span>
        )}
      </td>
      <td className="file-size-cell">{formatSize(item.size)}</td>
      <td className="file-date-cell">
        {item.mtime ? new Date(item.mtime).toLocaleString() : ''}
      </td>
      <td className="file-actions-cell">
        {item.isFile && (
          <>
            {pUrl && (
              <button
                className="btn-action btn-preview"
                onClick={() => onPreview(item)}
                title="Preview"
              >
                👁
              </button>
            )}
            <a
              className="btn-action btn-download"
              href={dUrl}
              download={item.name}
              title="Download"
            >
              ⬇
            </a>
            <button
              className="btn-action btn-qr"
              onClick={handleQR}
              title="QR Code"
            >
              📱
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
