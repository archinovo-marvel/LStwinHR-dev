const mysql = require('mysql2/promise');
require('dotenv').config();

// 使用连接 URL 强制指定字符集
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';
const DB_NAME = process.env.DB_NAME || 'luanshu-authhub';

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAIN_DB_CONNECTION_LIMIT = parsePositiveInt(process.env.DB_CONNECTION_LIMIT, 10);
const MAIN_DB_QUEUE_LIMIT = parsePositiveInt(process.env.DB_QUEUE_LIMIT, 100);
const PERSONAL_DB_CONNECTION_LIMIT = parsePositiveInt(process.env.PERSONAL_DB_CONNECTION_LIMIT, 3);
const PERSONAL_DB_POOL_MAX = parsePositiveInt(process.env.PERSONAL_DB_POOL_MAX, 20);
const PERSONAL_DB_POOL_IDLE_MS = parsePositiveInt(process.env.PERSONAL_DB_POOL_IDLE_MS, 10 * 60 * 1000);
const PERSONAL_DB_POOL_SWEEP_INTERVAL_MS = parsePositiveInt(
  process.env.PERSONAL_DB_POOL_SWEEP_INTERVAL_MS,
  Math.min(PERSONAL_DB_POOL_IDLE_MS, 60 * 1000)
);

// 构建 MySQL 连接 URL，添加字符集参数
const connectionString = `mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?charset=utf8mb4`;

const dbConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: MAIN_DB_CONNECTION_LIMIT,
  queueLimit: MAIN_DB_QUEUE_LIMIT
};

const pool = mysql.createPool(dbConfig);

// Cache for personal user DB pools (key: userId, value: managed pool entry)
const personalPoolCache = new Map();

function touchPersonalPoolEntry(entry) {
  entry.lastUsedAt = Date.now();
}

function scheduleClosePersonalPool(userId, entry, reason) {
  if (!entry || entry.activeOperations > 0) {
    return false;
  }

  const cacheKey = String(userId);
  const cachedEntry = personalPoolCache.get(cacheKey);
  if (cachedEntry !== entry) {
    return false;
  }

  personalPoolCache.delete(cacheKey);
  entry.rawPool.end().catch((error) => {
    console.error(`[DB] Failed to close personal pool for user ${cacheKey} (${reason}):`, error.message);
  });
  return true;
}

function sweepPersonalPoolCache(now = Date.now()) {
  for (const [userId, entry] of personalPoolCache.entries()) {
    if (entry.activeOperations > 0) {
      continue;
    }

    if (now - entry.lastUsedAt >= PERSONAL_DB_POOL_IDLE_MS) {
      scheduleClosePersonalPool(userId, entry, 'idle-timeout');
    }
  }
}

function trimPersonalPoolCacheToLimit() {
  if (personalPoolCache.size < PERSONAL_DB_POOL_MAX) {
    return;
  }

  const candidates = Array.from(personalPoolCache.entries())
    .filter(([, entry]) => entry.activeOperations === 0)
    .sort(([, left], [, right]) => left.lastUsedAt - right.lastUsedAt);

  while (personalPoolCache.size >= PERSONAL_DB_POOL_MAX && candidates.length > 0) {
    const [userId, entry] = candidates.shift();
    scheduleClosePersonalPool(userId, entry, 'cache-trim');
  }

  if (personalPoolCache.size >= PERSONAL_DB_POOL_MAX) {
    console.warn(
      `[DB] personal pool cache reached soft limit ${PERSONAL_DB_POOL_MAX}; all cached pools are busy.`
    );
  }
}

function createManagedPersonalPool(userId, rawPool) {
  const cacheKey = String(userId);
  const entry = {
    userId: cacheKey,
    rawPool,
    activeOperations: 0,
    lastUsedAt: Date.now(),
    managedPool: null
  };

  const trackCall = async (executor) => {
    touchPersonalPoolEntry(entry);
    entry.activeOperations += 1;
    try {
      return await executor();
    } finally {
      entry.activeOperations = Math.max(0, entry.activeOperations - 1);
      touchPersonalPoolEntry(entry);
    }
  };

  entry.managedPool = new Proxy(rawPool, {
    get(target, prop, receiver) {
      if (prop === 'query' || prop === 'execute') {
        return (...args) => trackCall(() => target[prop](...args));
      }

      if (prop === 'getConnection') {
        return async (...args) => {
          touchPersonalPoolEntry(entry);
          entry.activeOperations += 1;
          try {
            const connection = await target.getConnection(...args);
            const originalRelease = typeof connection.release === 'function'
              ? connection.release.bind(connection)
              : null;
            let released = false;

            if (originalRelease) {
              connection.release = (...releaseArgs) => {
                if (!released) {
                  released = true;
                  entry.activeOperations = Math.max(0, entry.activeOperations - 1);
                  touchPersonalPoolEntry(entry);
                }
                return originalRelease(...releaseArgs);
              };
            }

            return connection;
          } catch (error) {
            entry.activeOperations = Math.max(0, entry.activeOperations - 1);
            touchPersonalPoolEntry(entry);
            throw error;
          }
        };
      }

      if (prop === 'end') {
        return (...args) => {
          personalPoolCache.delete(cacheKey);
          return target.end(...args);
        };
      }

      if (prop === '__poolEntry') {
        return entry;
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });

  return entry;
}

function getPersonalPoolCacheStats() {
  const now = Date.now();
  return {
    cacheSize: personalPoolCache.size,
    maxCacheSize: PERSONAL_DB_POOL_MAX,
    idleTimeoutMs: PERSONAL_DB_POOL_IDLE_MS,
    connectionLimit: PERSONAL_DB_CONNECTION_LIMIT,
    entries: Array.from(personalPoolCache.values()).map((entry) => ({
      userId: entry.userId,
      activeOperations: entry.activeOperations,
      idleForMs: Math.max(0, now - entry.lastUsedAt)
    }))
  };
}

const personalPoolSweepHandle = setInterval(() => {
  sweepPersonalPoolCache();
}, PERSONAL_DB_POOL_SWEEP_INTERVAL_MS);

if (typeof personalPoolSweepHandle.unref === 'function') {
  personalPoolSweepHandle.unref();
}

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    // 设置字符集
    await connection.query("SET NAMES 'utf8mb4'");
    console.log('✅ MySQL数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error.message);
    return false;
  }
};

// 获取个人用户数据库连接池
function getPersonalUserDB(userId) {
  // Validate userId is numeric
  if (!userId || !/^\d+$/.test(String(userId))) {
    throw new Error('Invalid userId: must be a positive integer');
  }

  const cacheKey = String(userId);
  sweepPersonalPoolCache();

  // Return cached pool if exists
  if (personalPoolCache.has(cacheKey)) {
    const cachedEntry = personalPoolCache.get(cacheKey);
    touchPersonalPoolEntry(cachedEntry);
    return cachedEntry.managedPool;
  }

  trimPersonalPoolCacheToLimit();

  const dbName = `lstwin_personal_user_${userId}`;
  const rawPersonalPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: PERSONAL_DB_CONNECTION_LIMIT,
    queueLimit: 0
  });

  const personalPoolEntry = createManagedPersonalPool(cacheKey, rawPersonalPool);

  personalPoolCache.set(cacheKey, personalPoolEntry);
  return personalPoolEntry.managedPool;
}

// 初始化个人用户数据库（注册时调用）
async function initPersonalUserDB(userId) {
  // Validate userId is numeric
  if (!userId || !/^\d+$/.test(String(userId))) {
    throw new Error('Invalid userId: must be a positive integer');
  }

  const dbName = `lstwin_personal_user_${userId}`;

  // 使用 root 连接创建数据库（需要从环境变量获取 root 密码）
  const rootConnectionConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: process.env.DB_ROOT_USER || 'root',
    password: process.env.DB_ROOT_PASSWORD || 'rootpassword',
    multipleStatements: true
  };

  let rootConnection;
  try {
    rootConnection = await mysql.createConnection(rootConnectionConfig);

    // 创建数据库
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // 授予普通用户权限
    await rootConnection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO 'user'@'%'`);
    await rootConnection.query(`FLUSH PRIVILEGES`);

    await rootConnection.query(`USE \`${dbName}\``);

    // 设置数据库字符集
    await rootConnection.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    // 创建表
    await rootConnection.query(`
      CREATE TABLE IF NOT EXISTS \`personal_resumes\` (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        owner_user_id BIGINT NOT NULL,
        original_file_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        original_file_blob LONGBLOB,
        optimized_content LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        status VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    throw new Error(`Failed to initialize personal user DB: ${error.message}`);
  } finally {
    if (rootConnection) {
      await rootConnection.end();
    }
  }
}

module.exports = {
  pool,
  testConnection,
  dbConfig,
  getPersonalUserDB,
  initPersonalUserDB,
  __internal: {
    getPersonalPoolCacheStats,
    sweepPersonalPoolCache
  }
};
