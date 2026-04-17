import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

if (typeof window !== 'undefined' && !window.__suppressDevWsNoisePatched) {
  const originalConsoleError = window.console.error.bind(window.console);
  window.console.error = (...args) => {
    const message = args
      .map((item) => (typeof item === 'string' ? item : item?.message || ''))
      .join(' ');

    if (
      message.includes("WebSocket connection to 'ws://localhost:3006/ws' failed: Invalid frame header") ||
      message.includes('WebSocketClient.js:13 WebSocket connection to')
    ) {
      return;
    }

    originalConsoleError(...args);
  };
  window.__suppressDevWsNoisePatched = true;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


