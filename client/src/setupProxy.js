const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const apiProxy = createProxyMiddleware({
    target: process.env.REACT_APP_API_URL || 'http://localhost:3001',
    changeOrigin: true,
    secure: false,
    ws: true,
    pathRewrite: {
      '^/api': '/api'
    },
    onError: (err, req, res) => {
      console.log('API代理错误:', err.message);
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log('[API代理]', req.method, req.url, '->', process.env.REACT_APP_API_URL || 'http://localhost:3001');
      // 确保查询参数被保留
      if (req.url && req.url.includes('token=')) {
        console.log('[API代理] 检测到 token 参数，URL:', req.url);
      }
    }
  });

  app.use('/api', apiProxy);

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
