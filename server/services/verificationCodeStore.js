'use strict';

require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const STORE_MODE = process.env.VERIFICATION_CODE_STORE || 'redis';
const KEY_PREFIX = process.env.VERIFICATION_CODE_PREFIX || 'verification-code';

function createMemoryStore() {
  const store = new Map();
  return {
    async get(email) {
      const entry = store.get(`${KEY_PREFIX}:${String(email || '').trim().toLowerCase()}`);
      if (!entry) return null;
      if (Date.now() > entry.expiry) {
        store.delete(`${KEY_PREFIX}:${String(email || '').trim().toLowerCase()}`);
        return null;
      }
      return entry;
    },
    async set(email, value) {
      store.set(`${KEY_PREFIX}:${String(email || '').trim().toLowerCase()}`, value);
      return true;
    },
    async delete(email) {
      store.delete(`${KEY_PREFIX}:${String(email || '').trim().toLowerCase()}`);
      return true;
    },
    async close() {
      store.clear();
    }
  };
}

function createVerificationCodeStore() {
  if (STORE_MODE === 'memory') {
    console.warn('[verification-code-store] 当前使用内存存储，验证码在多实例下不会共享');
    const fallbackStore = createMemoryStore();
    return fallbackStore;
  }

  let IORedis;
  try {
    IORedis = require('ioredis');
  } catch (e) {
    console.error('[verification-code-store] ioredis未安装，验证码服务不可用');
    throw new Error('验证码服务不可用：ioredis 依赖缺失');
  }

  const redis = new IORedis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false
  });

  let fallbackMode = false;

  redis.on('error', error => {
    console.error('[verification-code-store] Redis异常:', error.message);
    fallbackMode = true;
  });

  redis.on('ready', () => {
    fallbackMode = false;
    console.log('[verification-code-store] Redis连接就绪');
  });

  async function getRedisClient() {
    if (fallbackMode) {
      return null;
    }

    try {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      return redis;
    } catch (error) {
      fallbackMode = true;
      console.warn('[verification-code-store] Redis不可用，请求将返回错误 (将在连接恢复后自动切回):', error.message);
      return null;
    }
  }

  function buildKey(email) {
    return `${KEY_PREFIX}:${String(email || '').trim().toLowerCase()}`;
  }

  return {
    async get(email) {
      const client = await getRedisClient();
      if (!client) {
        throw new Error('验证码服务暂不可用，请稍后重试');
      }

      const rawValue = await client.get(buildKey(email));
      if (!rawValue) {
        return null;
      }

      try {
        return JSON.parse(rawValue);
      } catch (error) {
        await client.del(buildKey(email)).catch(() => {});
        return null;
      }
    },
    async set(email, value) {
      const client = await getRedisClient();
      if (!client) {
        throw new Error('验证码服务暂不可用，请稍后重试');
      }

      const ttlMs = Math.max(1000, Number(value?.expiry || 0) - Date.now());
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await client.set(buildKey(email), JSON.stringify(value), 'EX', ttlSec);
      return true;
    },
    async delete(email) {
      const client = await getRedisClient();
      if (!client) {
        throw new Error('验证码服务暂不可用，请稍后重试');
      }

      await client.del(buildKey(email));
      return true;
    },
    async close() {
      if (fallbackMode) {
        return;
      }
      await redis.quit().catch(() => redis.disconnect());
    }
  };
}

module.exports = {
  createVerificationCodeStore
};
