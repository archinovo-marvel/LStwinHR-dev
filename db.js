const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'luanshu-authhub',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// Cache for personal user DB pools (key: userId, value: pool)
const personalPoolCache = new Map();

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
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

  // Return cached pool if exists
  if (personalPoolCache.has(userId)) {
    return personalPoolCache.get(userId);
  }

  const dbName = `lstwin_personal_user_${userId}`;
  const poolConfig = {
    ...dbConfig,
    database: dbName
  };
  const personalPool = mysql.createPool(poolConfig);
  personalPoolCache.set(userId, personalPool);
  return personalPool;
}

// 初始化个人用户数据库（注册时调用）
async function initPersonalUserDB(userId) {
  // Validate userId is numeric
  if (!userId || !/^\d+$/.test(String(userId))) {
    throw new Error('Invalid userId: must be a positive integer');
  }

  const dbName = `lstwin_personal_user_${userId}`;
  const connectionConfig = {
    ...dbConfig,
    database: dbName,
    multipleStatements: true
  };

  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`personal_resumes\` (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        owner_user_id BIGINT NOT NULL,
        original_file_name VARCHAR(255),
        original_file_blob LONGBLOB,
        optimized_content LONGTEXT,
        optimization_history LONGTEXT,
        resume_score DECIMAL(10,2),
        status VARCHAR(64) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    throw new Error(`Failed to initialize personal user DB: ${error.message}`);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

module.exports = {
  pool,
  testConnection,
  dbConfig,
  getPersonalUserDB,
  initPersonalUserDB
};
