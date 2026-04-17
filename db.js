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
module.exports = {
  pool,
  testConnection,
  dbConfig
};
