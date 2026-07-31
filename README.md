# MFAA – My Files Anywhere Anytime

A secure, password-protected, self-hosted file sharing platform.  
Browse all disks/drives, navigate folders, preview and download files, and generate QR codes for mobile access — all over HTTP, deployable via PM2 or systemd, and exposable via [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

---

## Features

- 🔒 **Password protection** – set access credentials server-side via environment variables
- 💾 **Drive/disk listing** – shows all real mount points / volumes (Linux, macOS, Windows)
- 📂 **Folder navigation** – browse any directory with a clean table view
- 👁 **File preview** – inline preview for images, video, audio, PDF, and text files
- ⬇ **File download** – direct download with correct MIME type
- 📱 **QR code generation** – scan on mobile to download any file
- 🌐 **Single-server deployment** – Express serves the built React app (no separate web server needed)
- ⚡ **PM2 / systemd ready** – ships with `ecosystem.config.js`

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/PNDLabs/mfaa.git
cd mfaa
npm run install:all   # installs server + client dependencies
```

### 2. Configure

```bash
cp .env.example server/.env
nano server/.env      # set ACCESS_PASSWORD and JWT_SECRET
```

**Minimum required settings in `server/.env`:**

```env
ACCESS_PASSWORD=your-strong-password-here
JWT_SECRET=run-node-e-console.log(require('crypto').randomBytes(64).toString('hex'))
```

To use a bcrypt hash instead of a plain password (recommended):

```bash
node -e "const b=require('./server/node_modules/bcryptjs'); b.hash('yourpassword',12).then(console.log)"
```

Then in `.env`:
```env
# Remove ACCESS_PASSWORD and use this instead:
ACCESS_PASSWORD_HASH=$2a$12$...hash...
```

### 3. Build the frontend

```bash
npm run build
```

### 4. Start

```bash
# Development (two terminals)
npm run dev:server
npm run dev:client

# Production (single process, serves built frontend)
npm start

# Production with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # to auto-start on boot
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ACCESS_PASSWORD` | Yes* | – | Plain-text access password |
| `ACCESS_PASSWORD_HASH` | Yes* | – | bcrypt hash (overrides `ACCESS_PASSWORD`) |
| `JWT_SECRET` | **Yes** | insecure default | Secret for signing JWT tokens |
| `TOKEN_EXPIRY` | No | `24h` | Token validity (e.g. `1h`, `7d`) |
| `PORT` | No | `3001` | HTTP port (overridden to `3039` in `ecosystem.config.js` for PM2 deployments — keep `.env` and `ecosystem.config.js` in sync) |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `SHOW_HIDDEN` | No | `false` | Show hidden files (`.dotfiles`) |
| `NODE_ENV` | No | `development` | `production` silences debug output |

*Exactly one of `ACCESS_PASSWORD` or `ACCESS_PASSWORD_HASH` must be set.

---

## Deploying with Cloudflare Tunnel

1. [Install cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Authenticate and create a tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create mfaa
   ```
3. Create `~/.cloudflared/config.yml` (or, if `cloudflared` is already installed as a system service, add an ingress entry to the existing `/etc/cloudflared/config.yml` instead of creating a new tunnel):
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json
   ingress:
     - hostname: files.yourdomain.com
       service: http://localhost:3039   # must match PORT in .env / ecosystem.config.js
     - service: http_status:404
   ```
4. Add to your domain's DNS (cloudflared will guide you), or if reusing an existing tunnel: `cloudflared tunnel route dns <TUNNEL_NAME> files.yourdomain.com`
5. Start the tunnel (or restart it, if reusing an existing systemd-managed tunnel):
   ```bash
   cloudflared tunnel run mfaa
   # or, for an existing service:
   sudo systemctl restart cloudflared
   ```
6. Update `ALLOWED_ORIGINS` in `server/.env`:
   ```env
   ALLOWED_ORIGINS=https://files.yourdomain.com
   ```

---

## systemd Service

Create `/etc/systemd/system/mfaa.service`:

```ini
[Unit]
Description=MFAA File Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/mfaa
ExecStart=/usr/bin/node server/src/index.js
EnvironmentFile=/path/to/mfaa/server/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mfaa
```

---

## Project Structure

```
mfaa/
├── server/                   # Node.js + Express backend
│   ├── src/
│   │   ├── index.js          # Entry point, Express app
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.js       # POST /api/auth/login
│   │       ├── files.js      # GET /api/drives, /api/files, /api/download, /api/preview
│   │       └── qr.js         # GET /api/qr
│   └── package.json
├── client/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── api/index.js      # API client helpers
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── FileBrowser.jsx
│   │   │   ├── FileItem.jsx
│   │   │   ├── Preview.jsx
│   │   │   └── QRModal.jsx
│   │   └── styles/App.css
│   └── package.json
├── ecosystem.config.js       # PM2 config
├── .env.example              # Environment variable template
└── package.json              # Root convenience scripts
```

---

## Security Notes

- **Never expose** `ACCESS_PASSWORD` or `JWT_SECRET` in source control — use the `.env` file (already in `.gitignore`)
- The server validates and resolves all file paths to prevent directory traversal attacks
- JWT tokens expire (default 24h); set `TOKEN_EXPIRY` as appropriate
- For production, always set a strong `JWT_SECRET`
- Consider setting `ALLOWED_ORIGINS` to your specific domain when using Cloudflare Tunnel

---

## License

MIT
