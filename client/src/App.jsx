import React, { useState } from 'react';
import Login from './components/Login';
import FileBrowser from './components/FileBrowser';
import './styles/App.css';

function hasValidToken() {
  const token = localStorage.getItem('mfaa_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(hasValidToken);

  function handleLogin() {
    setAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem('mfaa_token');
    setAuthenticated(false);
  }

  return authenticated ? (
    <FileBrowser onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}
