'use strict';

const IORedis = require('ioredis');

require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const STORE_MODE = process.env.VERIFICATION_CODE_STORE || 'redis';
const KEY_PREFIX = process.env.VERIFICATION_CODE_PREFIX || 'verification-code';

function buildKey(email) {
  return `${KEY_PREFIX}:${String(email || '').trim().toLowerCase()}`;
}

function createMemoryStore() {
  const store = new Map();
  return {
    async get(email) {
      return store.get(buildKey(email)) || null;
    },
    async set(email, value) {
      store.set(buildKey(email), value);
      return true;
    },
    async delete(email) {
      store.delete(buildKey(email));
      return true;
    },
    async close() {
      store.clear();
    }
  };
}

function createVerificationCodeStore() {
  const fallbackStore = createMemoryStore();

  if (STORE_MODE === 'memory') {
    console.warn('[verification-code-store] 当前使用内存存储，验证码在多实例下不会共享');
    return fallbackStore;
  }

  const redis = new IORedis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false
  });

  let fallbackMode = false;

  redis.on('error', error => {
    console.error('[verification-code-store] Redis异常:', error.message);
  });

  redis.on('ready', () => {
    if (fallbackMode) {
      fallbackMode = false;
      console.log('[verification-code-store] Redis恢复连接，退出内存回退模式');
    }
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
      console.warn('[verification-code-store] Redis不可用，回退到内存存储 (将在连接恢复后自动切回):', error.message);
      return null;
    }
  }

  return {
    async get(email) {
      const client = await getRedisClient();
      if (!client) {
        return fallbackStore.get(email);
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
        return fallbackStore.set(email, value);
      }

      const ttlMs = Math.max(1000, Number(value?.expiry || 0) - Date.now());
      await client.set(buildKey(email), JSON.stringify(value), 'PX', ttlMs);
      return true;
    },
    async delete(email) {
      const client = await getRedisClient();
      if (!client) {
        return fallbackStore.delete(email);
      }

      await client.del(buildKey(email));
      return true;
    },
    async close() {
      await fallbackStore.close();
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