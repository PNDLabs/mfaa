import React from 'react';
import { previewUrl } from '../api';

export default function Preview({ item, onClose }) {
  if (!item) return null;

  const pUrl = previewUrl(item.path);
  const mime = item.mimeType || '';

  function renderContent() {
    if (mime.startsWith('image/')) {
      return <img src={pUrl} alt={item.name} className="preview-image" />;
    }
    if (mime.startsWith('video/')) {
      return (
        <video controls className="preview-video">
          <source src={pUrl} type={mime} />
          Your browser does not support the video tag.
        </video>
      );
    }
    if (mime.startsWith('audio/')) {
      return (
        <audio controls className="preview-audio">
          <source src={pUrl} type={mime} />
          Your browser does not support the audio tag.
        </audio>
      );
    }
    if (mime === 'application/pdf') {
      return (
        <iframe
          src={pUrl}
          title={item.name}
          className="preview-iframe"
        />
      );
    }
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') {
      return (
        <iframe
          src={pUrl}
          title={item.name}
          className="preview-iframe preview-text"
        />
      );
    }
    return <p className="preview-unsupported">Preview not available for this file type.</p>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{item.name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{renderContent()}</div>
      </div>
    </div>
  );
}
