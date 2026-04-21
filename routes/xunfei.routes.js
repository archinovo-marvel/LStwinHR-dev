const express = require('express');
const crypto = require('crypto');

function createXunfeiRouter() {
  const router = express.Router();

  router.get('/avatar-sign', (req, res) => {
    try {
      const appId = process.env.XUNFEI_APP_ID || process.env.REACT_APP_XUNFEI_APP_ID;
      const apiKey = process.env.XUNFEI_API_KEY || process.env.REACT_APP_XUNFEI_API_KEY;
      const apiSecret = process.env.XUNFEI_API_SECRET || process.env.REACT_APP_XUNFEI_API_SECRET;

      if (!appId || !apiKey || !apiSecret) {
        return res.status(500).json({ error: '讯飞 API 配置缺失' });
      }

      const host = 'avatar.cn-huadong-1.xf-yun.com';
      const path = '/v1/interact';
      const date = new Date().toUTCString();

      const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
      const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');

      const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
      const authorization = Buffer.from(authorizationOrigin).toString('base64');

      const signedUrl = `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;

      res.json({
        success: true,
        signedUrl,
        appId,
        expiresIn: 300
      });
    } catch (error) {
      console.error('生成讯飞签名失败:', error);
      res.status(500).json({ error: '生成签名失败' });
    }
  });

  return router;
}

module.exports = { createXunfeiRouter };
