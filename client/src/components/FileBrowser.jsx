import React, { useState, useEffect, useCallback } from 'react';
import { getDrives, getFiles } from '../api';
import FileItem from './FileItem';
import Preview from './Preview';
import QRModal from './QRModal';

export default function FileBrowser({ onLogout }) {
  const [view, setView] = useState('drives'); // 'drives' | 'files'
  const [drives, setDrives] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [listing, setListing] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewItem, setPreviewItem] = useState(null);
  const [qrData, setQrData] = useState(null); // { url, name }

  useEffect(() => {
    loadDrives();
  }, []);

  async function loadDrives() {
    setLoading(true);
    setError('');
    try {
      const res = await getDrives();
      setDrives(res.data.drives);
      setView('drives');
      setBreadcrumbs([]);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        onLogout();
      } else {
        setError(err.response?.data?.error || 'Failed to load drives');
      }
    } finally {
      setLoading(false);
    }
  }

  const navigate = useCallback(async (path) => {
    setLoading(true);
    setError('');
    try {
      const res = await getFiles(path);
      setListing(res.data);
      setCurrentPath(path);
      setView('files');

      // Build breadcrumbs
      const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
      const crumbs = [];
      // Add home (drives)
      crumbs.push({ label: '🏠 Drives', path: null });
      let accumulated = path.startsWith('/') ? '' : '';
      if (path.startsWith('/')) {
        // Unix absolute path
        parts.forEach((part, i) => {
          accumulated += '/' + part;
          crumbs.push({ label: part, path: accumulated });
        });
      } else {
        // Windows
        parts.forEach((part, i) => {
          accumulated = i === 0 ? part + '\\' : accumulated + part + '\\';
          crumbs.push({ label: part, path: accumulated.replace(/\\$/, '') });
        });
      }
      setBreadcrumbs(crumbs);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        onLogout();
      } else {
        setError(err.response?.data?.error || 'Failed to load directory');
      }
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  function handleBreadcrumb(path) {
    if (path === null) {
      loadDrives();
    } else {
      navigate(path);
    }
  }

  function handleQR(absoluteUrl, name) {
    setQrData({ url: absoluteUrl, name });
  }

  return (
    <div className="browser-container">
      {/* Header */}
      <header className="browser-header">
        <div className="header-left">
          <span className="app-logo">📁</span>
          <span className="app-name">MFAA</span>
        </div>
        <div className="header-right">
          <button className="btn-secondary" onClick={loadDrives}>🏠 Drives</button>
          <button className="btn-secondary btn-logout" onClick={onLogout}>Sign Out</button>
        </div>
      </header>

      {/* Breadcrumbs */}
      {view === 'files' && breadcrumbs.length > 0 && (
        <nav className="breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="breadcrumb-sep"> / </span>}
              {i < breadcrumbs.length - 1 ? (
                <button className="link-btn breadcrumb-btn" onClick={() => handleBreadcrumb(crumb.path)}>
                  {crumb.label}
                </button>
              ) : (
                <span className="breadcrumb-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Content */}
      <main className="browser-main">
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && view === 'drives' && (
          <div className="drives-grid">
            <h2 className="section-title">Available Drives &amp; Mounts</h2>
            <div className="drive-cards">
              {drives.map((drive) => (
                <button
                  key={drive.path}
                  className="drive-card"
                  onClick={() => navigate(drive.path)}
                >
                  <span className="drive-icon">💾</span>
                  <span className="drive-name">{drive.name}</span>
                  <span className="drive-path">{drive.path}</span>
                  {drive.type && <span className="drive-type">{drive.type}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && view === 'files' && listing && (
          <div className="files-view">
            {listing.parent && (
              <button className="btn-up" onClick={() => navigate(listing.parent)}>
                ⬆ Up
              </button>
            )}
            {listing.items.length === 0 ? (
              <p className="empty-dir">This directory is empty.</p>
            ) : (
              <table className="files-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Modified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listing.items.map((item) => (
                    <FileItem
                      key={item.path}
                      item={item}
                      onNavigate={navigate}
                      onPreview={setPreviewItem}
                      onQR={handleQR}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {previewItem && (
        <Preview item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
      {qrData && (
        <QRModal
          fileName={qrData.name}
          fileUrl={qrData.url}
          onClose={() => setQrData(null)}
        />
      )}
    </div>
  );
}
