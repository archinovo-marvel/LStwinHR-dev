const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://ai-hr-backend:3001',
      changeOrigin: true,
      secure: false,
      ws: true,
      onError: (err) => {
        console.log('API代理错误:', err.message);
      }
    })
  );

  app.use(
    '/avatar-ws',
    createProxyMiddleware({
      target: 'https://avatar.cn-huadong-1.xf-yun.com/v1',
      changeOrigin: true,
      secure: true,
      ws: true,
      pathRewrite: {
        '^/avatar-ws': ''
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('host', 'avatar.cn-huadong-1.xf-yun.com');
      },
      onProxyReqWs: (proxyReq) => {
        proxyReq.setHeader('host', 'avatar.cn-huadong-1.xf-yun.com');
      },
      onError: (err) => {
        console.log('虚拟人WS代理错误:', err.message);
      }
    })
  );

  app.use(
    '/avatar-api',
    createProxyMiddleware({
      target: 'https://avatar.cn-huadong-1.xf-yun.com',
      changeOrigin: true,
      secure: true,
      ws: true,
      pathRewrite: {
        '^/avatar-api': ''
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('host', 'avatar.cn-huadong-1.xf-yun.com');
      },
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        proxyReq.setHeader('host', 'avatar.cn-huadong-1.xf-yun.com');
      },
      onError: (err, req, res) => {
        console.log('代理错误:', err.message);
      }
    })
  );
};
