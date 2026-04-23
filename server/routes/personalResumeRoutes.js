const express = require('express');
const path = require('path');
const { getPersonalUserDB } = require('../../db');
const { resumeAnalysisService } = require('../../services/resume');

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function createPersonalResumeRouter({ authMiddleware, upload }) {
  const router = express.Router();

  // All routes require authentication
  router.use(authMiddleware);

  // POST /api/personal/resume/upload — 上传简历并AI优化
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
      const { buffer, originalname } = req.file;
      const fileType = path.extname(originalname).toLowerCase();

      // Call AI optimization service
      const analysisResult = await resumeAnalysisService.analyze(
        buffer,
        fileType,
        null, // no position matching for personal users
        { originalName: originalname }
      );

      const optimizedContent = JSON.stringify(analysisResult);
      const resumeScore = analysisResult.totalScore || 0;
      const status = 'completed';

      // Insert into database
      const [result] = await pool.query(
        `INSERT INTO personal_resumes
          (owner_user_id, original_file_blob, original_file_name, optimized_content, resume_score, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, buffer, originalname, optimizedContent, resumeScore, status]
      );

      res.json({
        id: result.insertId,
        optimized_content: analysisResult,
        resume_score: resumeScore
      });
    } catch (error) {
      console.error('个人简历上传分析失败:', error);
      res.status(500).json({ message: '简历分析失败，请稍后重试' });
    }
  });

  // GET /api/personal/resume/history — 获取历史优化记录
  router.get('/history', async (req, res) => {
    const userId = req.user.id;

    try {
      const pool = getPersonalUserDB(userId);
      const [rows] = await pool.query(
        `SELECT id, original_file_name, resume_score, status, created_at
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
        `SELECT * FROM personal_resumes WHERE id = ? AND owner_user_id = ?`,
        [resumeId, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: '简历不存在或无权限访问' });
      }

      // Parse optimized_content if it's a string
      const record = rows[0];
      if (typeof record.optimized_content === 'string') {
        try {
          record.optimized_content = JSON.parse(record.optimized_content);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }

      res.json(record);
    } catch (error) {
      console.error('获取简历详情失败:', error);
      res.status(500).json({ message: '获取简历详情失败，请稍后重试' });
    }
  });

  // PUT /api/personal/resume/:id — 重复修改（追加到optimization_history）
  router.put('/:id', async (req, res) => {
    const userId = req.user.id;
    const resumeId = parseInt(req.params.id, 10);
    const { optimized_content } = req.body;

    if (!resumeId) {
      return res.status(400).json({ message: '无效的简历ID' });
    }

    if (!optimized_content) {
      return res.status(400).json({ message: '请提供优化内容' });
    }

    try {
      const pool = getPersonalUserDB(userId);

      // Get existing record
      const [rows] = await pool.query(
        `SELECT * FROM personal_resumes WHERE id = ? AND owner_user_id = ?`,
        [resumeId, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: '简历不存在或无权限访问' });
      }

      const record = rows[0];

      // Parse existing optimization_history
      let history = [];
      if (record.optimization_history) {
        try {
          history = typeof record.optimization_history === 'string'
            ? JSON.parse(record.optimization_history)
            : record.optimization_history;
        } catch (e) {
          history = [];
        }
      }

      // Prepend new entry with timestamp
      const newEntry = {
        content: optimized_content,
        timestamp: new Date().toISOString()
      };
      history.unshift(newEntry);

      // Serialize optimized_content for storage
      const serializedContent = typeof optimized_content === 'string'
        ? optimized_content
        : JSON.stringify(optimized_content);

      // Update record
      await pool.query(
        `UPDATE personal_resumes
         SET optimized_content = ?, optimization_history = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?`,
        [serializedContent, JSON.stringify(history), resumeId, userId]
      );

      // Return updated record
      const [updatedRows] = await pool.query(
        `SELECT * FROM personal_resumes WHERE id = ? AND owner_user_id = ?`,
        [resumeId, userId]
      );

      const updatedRecord = updatedRows[0];
      if (typeof updatedRecord.optimized_content === 'string') {
        try {
          updatedRecord.optimized_content = JSON.parse(updatedRecord.optimized_content);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }

      res.json(updatedRecord);
    } catch (error) {
      console.error('更新简历失败:', error);
      res.status(500).json({ message: '更新简历失败，请稍后重试' });
    }
  });

  return router;
}

module.exports = createPersonalResumeRouter;