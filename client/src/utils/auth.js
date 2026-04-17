/**
 * 使用Web Crypto API生成HMAC-SHA256签名
 * @param {string} message - 要签名的消息
 * @param {string} secret - 密钥
 * @returns {Promise<string>} Base64编码的签名
 */
const hmacSha256 = async (message, secret) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

/**
 * 生成鉴权信息
 * @param {string} apiKey - API Key
 * @param {string} apiSecret - API Secret
 * @param {string} appId - App ID
 * @returns {Promise<Object>} 鉴权信息
 */
export const generateAuth = async (apiKey, apiSecret, appId) => {
  // 生成时间戳
  const timestamp = Math.floor(Date.now() / 1000);
  
  // 生成随机字符串
  const nonce = Math.random().toString(36).substring(2, 15);
  
  // 构建签名字符串
  const signatureOrigin = `host: avatar.cn-huadong-1.xf-yun.com\ndate: ${new Date(timestamp * 1000).toUTCString()}\nGET /v1/interact HTTP/1.1`;
  
  // 使用HMAC-SHA256生成签名
  const signature = await hmacSha256(signatureOrigin, apiSecret);
  
  // 构建authorization字符串
  const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  
  return {
    timestamp,
    nonce,
    signature,
    authorization,
    appId
  };
};

/**
 * 生成WebSocket连接URL
 * @param {Object} authInfo - 鉴权信息
 * @returns {string} WebSocket URL
 */
export const generateWebSocketUrl = (authInfo) => {
  const { timestamp, authorization } = authInfo;
  const date = new Date(timestamp * 1000).toUTCString();
  
  const params = new URLSearchParams({
    authorization: btoa(authorization),
    date: date,
    host: 'avatar.cn-huadong-1.xf-yun.com'
  });
  
  return `wss://avatar.cn-huadong-1.xf-yun.com/v1/interact?${params.toString()}`;
};

export default {
  generateAuth,
  generateWebSocketUrl
};
