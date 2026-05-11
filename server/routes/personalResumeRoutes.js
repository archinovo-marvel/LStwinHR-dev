const express = require('express');
const path = require('path');
const { getPersonalUserDB } = require('../../db');
const personalResumeOptimizeService = require('../../services/resume/personalResumeOptimizeService');
const { loadUploadedFileBuffer, cleanupUploadedFile } = require('../utils/uploadStorage');

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 修复文件名编码问题（从 latin1 转换为 utf8）
function fixFilenameEncoding(filename) {
  if (!filename) return filename;
  try {
    // 尝试从 latin1 解码为 utf8
    const buf = Buffer.from(filename, 'latin1');
    const fixed = buf.toString('utf8');
    // 检查是否包含乱码特征（双重编码）
    if (fixed.includes('Ã') || fixed.includes('Â') || fixed.includes('§')) {
      // 可能是双重编码，尝试修复
      const buf2 = Buffer.from(fixed, 'latin1');
      return buf2.toString('utf8');
    }
    return fixed;
  } catch (e) {
    return filename;
  }
}

function createPersonalResumeRouter({ authMiddleware, upload }) {
  const router = express.Router();

  // All routes require authentication
  router.use(authMiddleware);

  // POST /api/personal/resume/upload — 上传简历并生成优化建议
  router.post('/upload', upload.single('file'), async (req, res) => {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: '请上传简历文件' });
    }

    if (req.file.size > MAX_SIZE) {
      return res.status(400).json({ message: '文件大小超过限制（最大10MB）' });
    }

    try {
      const pool = getPersonalUserDB(userId);
      // 修复文件名编码
      const originalname = fixFilenameEncoding(req.file.originalname);
      const buffer = await loadUploadedFileBuffer(req.file);
      const fileType = path.extname(originalname).toLowerCase();

      console.log(`[简历上传] 原始文件名: ${req.file.originalname}, 修复后: ${originalname}`);

      // 调用专门的简历优化服务
      const optimizeResult = await personalResumeOptimizeService.analyze(
        buffer,
        fileType,
        originalname
      );

      // 存入数据库
      const [result] = await pool.query(
        `INSERT INTO personal_resumes
          (owner_user_id, original_file_blob, original_file_name, optimized_content, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'completed', NOW(), NOW())`,
        [userId, buffer, originalname, JSON.stringify(optimizeResult)]
      );

      res.json({
        id: result.insertId,
        original_file_name: originalname,
        optimized_content: optimizeResult
      });
    } catch (error) {
      console.error('简历上传分析失败:', error);
      res.status(500).json({ message: error.message || '简历分析失败，请稍后重试' });
    } finally {
      await cleanupUploadedFile(req.file);
    }
  });

  // GET /api/personal/resume/history — 获取历史优化记录
  router.get('/history', async (req, res) => {
    const userId = req.user.id;

    try {
      const pool = getPersonalUserDB(userId);
      const [rows] = await pool.query(
        `SELECT id, original_file_name, status, created_at
         FROM personal_resumes
         WHERE owner_user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json(rows);
    } catch (error) {
      console.error('获取简历历史失败:', error);
      res.status(500).json({ message: '获取历史记录失败，请稍后重试' });
    }
  });

  // GET /api/personal/resume/:id — 获取单条优化结果
  router.get('/:id', async (req, res) => {
    const userId = req.user.id;
    const resumeId = parseInt(req.params.id, 10);

    if (!resumeId) {
      return res.status(400).json({ message: '无效的简历ID' });
    }

    try {
      const pool = getPersonalUserDB(userId);
      const [rows] = await pool.query(
        `SELECT id, original_file_name, optimized_content, status, created_at
         FROM personal_resumes
         WHERE id = ? AND owner_user_id = ?`,
        [resumeId, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: '简历不存在或无权限访问' });
      }

      const record = rows[0];

      // 解析 optimized_content
      if (typeof record.optimized_content === 'string') {
        try {
          record.optimized_content = JSON.parse(record.optimized_content);
        } catch (e) {
          // 保持原样
        }
      }

      res.json(record);
    } catch (error) {
      console.error('获取简历详情失败:', error);
      res.status(500).json({ message: '获取简历详情失败，请稍后重试' });
    }
  });

  // DELETE /api/personal/resume/:id — 删除单条记录
  router.delete('/:id', async (req, res) => {
    const userId = req.user.id;
    const resumeId = parseInt(req.params.id, 10);

    if (!resumeId) {
      return res.status(400).json({ message: '无效的简历ID' });
    }

    try {
      const pool = getPersonalUserDB(userId);
      const [result] = await pool.query(
        'DELETE FROM personal_resumes WHERE id = ? AND owner_user_id = ?',
        [resumeId, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: '简历不存在或无权限删除' });
      }

      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      console.error('删除简历失败:', error);
      res.status(500).json({ message: '删除失败，请稍后重试' });
    }
  });

  return router;
}

module.exports = createPersonalResumeRouter;