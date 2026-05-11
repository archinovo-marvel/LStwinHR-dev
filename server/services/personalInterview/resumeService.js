/**
 * 简历上传解析服务
 * 负责面试专用简历的上传和解析
 * 复用 parserService 进行文本提取
 */
const { v4: uuidv4 } = require('uuid');
const { parserService } = require('../../../services/resume/parserService');
const { loadUploadedFileBuffer, cleanupUploadedFile } = require('../../utils/uploadStorage');

class ResumeService {
  /**
   * 上传并解析简历
   * @param {number} userId - 用户ID
   * @param {Object} file - 文件对象 (Express multer file)
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 简历记录
   */
  async uploadAndParse(userId, file, pool) {
    const id = uuidv4();
    const fileName = file.originalname;
    try {
      const fileBuffer = await loadUploadedFileBuffer(file);
      const mimeType = file.mimetype;
      const size = file.size;

      // 获取文件扩展名
      const ext = this.getFileExtension(fileName);

      // 解析简历文本
      let parsedText = '';
      let parseStatus = 'pending';

      try {
        const parseResult = await parserService.parseFile(fileBuffer, ext, fileName);
        parsedText = parseResult.text || '';
        parseStatus = parseResult.status;
      } catch (error) {
        console.error('[Interview Resume] Parse error:', error.message);
        parseStatus = 'failed';
      }

      // 存储到数据库
      await pool.execute(
        `INSERT INTO interview_resumes
         (id, user_id, file_name, file_blob, mime_type, size, parsed_text, parse_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, fileName, fileBuffer, mimeType, size, parsedText, parseStatus]
      );

      return this.getById(id, pool);
    } finally {
      await cleanupUploadedFile(file);
    }
  }

  /**
   * 获取简历详情
   * @param {string} id - 简历ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object|null>}
   */
  async getById(id, pool) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, file_name, mime_type, size, parsed_text, parse_status, created_at
       FROM interview_resumes
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.formatResume(rows[0]);
  }

  /**
   * 获取简历文件（用于下载）
   * @param {string} id - 简历ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object|null>}
   */
  async getFileById(id, pool) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, file_name, file_blob, mime_type, size
       FROM interview_resumes
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      userId: rows[0].user_id,
      fileName: rows[0].file_name,
      fileBuffer: rows[0].file_blob,
      mimeType: rows[0].mime_type,
      size: rows[0].size
    };
  }

  /**
   * 获取用户简历列表
   * @param {number} userId - 用户ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Array>}
   */
  async getByUserId(userId, pool) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, file_name, mime_type, size, parse_status, created_at
       FROM interview_resumes
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    return rows.map(row => this.formatResumeSummary(row));
  }

  /**
   * 删除简历
   * @param {string} id - 简历ID
   * @param {number} userId - 用户ID (用于权限校验)
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<boolean>}
   */
  async delete(id, userId, pool) {
    const [result] = await pool.execute(
      'DELETE FROM interview_resumes WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext.startsWith('.') ? ext : `.${ext}`;
  }

  /**
   * 格式化简历详情
   */
  formatResume(row) {
    return {
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      size: row.size,
      parsedText: row.parsed_text,
      parseStatus: row.parse_status,
      createdAt: row.created_at
    };
  }

  /**
   * 格式化简历摘要（不含解析文本）
   */
  formatResumeSummary(row) {
    return {
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      size: row.size,
      parseStatus: row.parse_status,
      createdAt: row.created_at
    };
  }
}

module.exports = new ResumeService();
