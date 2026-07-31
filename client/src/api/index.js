import axios from 'axios';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('mfaa_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

export function login(password) {
  return axios.post(`${BASE}/auth/login`, { password });
}

export function getDrives() {
  return axios.get(`${BASE}/drives`, { headers: authHeaders() });
}

export function getFiles(path) {
  return axios.get(`${BASE}/files`, {
    params: { path },
    headers: authHeaders(),
  });
}

export function downloadUrl(filePath) {
  const token = getToken();
  return `${BASE}/download?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
}

export function previewUrl(filePath) {
  const token = getToken();
  return `${BASE}/preview?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
}

export function qrUrl(targetUrl) {
  const token = getToken();
  return `${BASE}/qr?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(token)}`;
}
