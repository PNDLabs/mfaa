import React from 'react';
import { qrUrl, downloadUrl } from '../api';

export default function QRModal({ fileName, fileUrl, onClose }) {
  if (!fileUrl) return null;

  const qrImgUrl = qrUrl(fileUrl);
  const dUrl = downloadUrl
    ? null
    : null; // download URL is passed as fileUrl already

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Scan to Download</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body qr-body">
          <p className="qr-filename">{fileName}</p>
          <img src={qrImgUrl} alt="QR Code" className="qr-image" />
          <p className="qr-hint">Scan this QR code with your phone to download the file.</p>
          <div className="qr-url">
            <input
              type="text"
              readOnly
              value={fileUrl}
              onFocus={(e) => e.target.select()}
              className="qr-url-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
