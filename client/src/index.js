import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

// 阻止 SDK 连接 localhost:3006（不存在的 WebSocket 服务器）
(function() {
  const _WebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (typeof url === 'string' && url.includes('localhost:3006')) {
      console.warn('[WS_BLOCKED]', url);
      const mockWs = {
        close: () => {}, send: () => {},
        onopen: null, onclose: null, onmessage: null, onerror: null,
        CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
        readyState: 3, url
      };
      setTimeout(() => { if (mockWs.onerror) mockWs.onerror({ message: 'Blocked' }); }, 0);
      return mockWs;
    }
    return new _WebSocket(url, protocols);
  };
  window.WebSocket.prototype = _WebSocket.prototype;
  window.WebSocket.CONNECTING = 0;
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSING = 2;
  window.WebSocket.CLOSED = 3;
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


