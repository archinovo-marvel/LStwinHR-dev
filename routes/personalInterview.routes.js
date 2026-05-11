const express = require('express');
const { getPersonalUserDB, initPersonalUserDB } = require('../db');
const { createDiskUpload } = require('../server/utils/uploadStorage');
const {
  positionService,
  resumeService,
  sessionService,
  statsService
} = require('../server/services/personalInterview');

// 配置 multer 用于简历上传
const upload = createDiskUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileSize: 10 * 1024 * 1024,
  allowedTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
  errorMessage: '只支持 PDF、Word、JPG、PNG 格式文件'
});

// 修复文件名编码问题
function fixFilenameEncoding(filename) {
  if (!filename) return filename;
  try {
    const buf = Buffer.from(filename, 'latin1');
    const fixed = buf.toString('utf8');
    if (fixed.includes('Ã') || fixed.includes('Â') || fixed.includes('§')) {
      const buf2 = Buffer.from(fixed, 'latin1');
      return buf2.toString('utf8');
    }
    return fixed;
  } catch (e) {
    return filename;
  }
}

// 确保面试表已初始化
async function ensureInterviewTables(userId) {
  const dbName = `lstwin_personal_user_${userId}`;
  const mysql = require('mysql2/promise');

  const rootConnectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_ROOT_USER || 'root',
    password: process.env.DB_ROOT_PASSWORD || 'rootpassword',
    multipleStatements: true
  };

  let rootConnection;
  try {
    rootConnection = await mysql.createConnection(rootConnectionConfig);
    await rootConnection.query(`USE \`${dbName}\``);

    // 创建面试相关表
    await rootConnection.query(`
      CREATE TABLE IF NOT EXISTS \`personal_positions\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`user_id\` BIGINT NOT NULL,
        \`position_name\` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        \`description\` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        \`company_name\` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        \`work_years\` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        \`salary_range\` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        \`skills\` JSON,
        \`usage_count\` INT DEFAULT 0,
        \`last_used_at\` DATETIME,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_last_used\` (\`last_used_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await rootConnection.query(`
      CREATE TABLE IF NOT EXISTS \`interview_resumes\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`user_id\` BIGINT NOT NULL,
        \`file_name\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        \`file_blob\` LONGBLOB,
        \`mime_type\` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        \`size\` BIGINT,
        \`parsed_text\` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        \`parse_status\` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await rootConnection.query(`
      CREATE TABLE IF NOT EXISTS \`interview_sessions\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`user_id\` BIGINT NOT NULL,
        \`resume_id\` VARCHAR(36) NOT NULL,
        \`position_id\` VARCHAR(36),
        \`position_info\` JSON NOT NULL,
        \`difficulty\` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
        \`mode\` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'text',
        \`total_questions\` INT DEFAULT 10,
        \`current_question\` INT DEFAULT 0,
        \`status\` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'in_progress',
        \`start_time\` DATETIME,
        \`end_time\` DATETIME,
        \`duration\` INT COMMENT 'Duration in seconds',
        \`conversation\` JSON COMMENT 'Array of Q&A pairs',
        \`scoring\` JSON COMMENT 'Scoring results',
        \`final_score\` DECIMAL(5,2),
        \`grade\` VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        \`metadata\` JSON,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_status\` (\`status\`),
        INDEX \`idx_start_time\` (\`start_time\`),
        INDEX \`idx_resume_id\` (\`resume_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await rootConnection.query(`
      CREATE TABLE IF NOT EXISTS \`interview_stats\` (
        \`user_id\` BIGINT PRIMARY KEY,
        \`total_sessions\` INT DEFAULT 0,
        \`completed_sessions\` INT DEFAULT 0,
        \`average_score\` DECIMAL(5,2),
        \`highest_score\` DECIMAL(5,2),
        \`lowest_score\` DECIMAL(5,2),
        \`total_duration\` INT DEFAULT 0 COMMENT 'Total duration in seconds',
        \`position_stats\` JSON COMMENT 'Statistics by position',
        \`dimension_averages\` JSON COMMENT 'Average scores by dimension',
        \`trend\` JSON COMMENT 'Score trend over time',
        \`weak_areas\` JSON COMMENT 'Identified weak areas',
        \`last_session_time\` DATETIME,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log(`[面试表初始化] 用户 ${userId} 的面试表已确保创建`);
  } catch (error) {
    console.error('[面试表初始化] 失败:', error.message);
    throw error;
  } finally {
    if (rootConnection) {
      await rootConnection.end();
    }
  }
}

function createPersonalInterviewRouter({ authMiddleware }) {
  const router = express.Router();

  // 所有路由需要认证
  router.use(authMiddleware);

  // 中间件：确保面试表已初始化
  router.use(async (req, res, next) => {
    try {
      const userId = req.user.id;
      await ensureInterviewTables(userId);
      next();
    } catch (error) {
      console.error('[面试路由] 表初始化失败:', error.message);
      res.status(500).json({ message: '服务初始化失败，请稍后重试' });
    }
  });

  // ==================== 岗位管理 ====================

  // POST /api/personal/interview/positions - 创建岗位
  router.post('/positions', async (req, res) => {
    const userId = req.user.id;
    const { positionName, description, companyName, workYears, salaryRange, skills } = req.body;

    if (!positionName || !description) {
      return res.status(400).json({ message: '岗位名称和描述为必填项' });
    }

    try {
      const pool = getPersonalUserDB(userId);
      const position = await positionService.create(userId, {
        positionName,
        description,
        companyName,
        workYears,
        salaryRange,
        skills
      }, pool);

      res.status(201).json(position);
    } catch (error) {
      console.error('[创建岗位] 失败:', error.message);
      res.status(500).json({ message: '创建岗位失败，请稍后重试' });
    }
  });

  // GET /api/personal/interview/positions - 获取岗位列表
  router.get('/positions', async (req, res) => {
    const userId = req.user.id;

    try {
      const pool = getPersonalUserDB(userId);
      const positions = await positionService.getByUserId(userId, pool);
      res.json(positions);
    } catch (error) {
      console.error('[获取岗位列表] 失败:', error.message);
      res.status(500).json({ message: '获取岗位列表失败，请稍后重试' });
    }
  });

  // GET /api/personal/interview/positions/:id - 获取单个岗位
  router.get('/positions/:id', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const pool = getPersonalUserDB(userId);
      const position = await positionService.getById(id, pool);

      if (!position) {
        return res.status(404).json({ message: '岗位不存在' });
      }

      res.json(position);
    } catch (error) {
      console.error('[获取岗位详情] 失败:', error.message);
      res.status(500).json({ message: '获取岗位详情失败，请稍后重试' });
    }
  });

  // PUT /api/personal/interview/positions/:id - 更新岗位
  router.put('/positions/:id', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    try {
      const pool = getPersonalUserDB(userId);
      const position = await positionService.update(id, updateData, pool);

      if (!position) {
        return res.status(404).json({ message: '岗位不存在' });
      }

      res.json(position);
    } catch (error) {
      console.error('[更新岗位] 失败:', error.message);
      res.status(500).json({ message: '更新岗位失败，请稍后重试' });
    }
  });

  // DELETE /api/personal/interview/positions/:id - 删除岗位
  router.delete('/positions/:id', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const pool = getPersonalUserDB(userId);
      const deleted = await positionService.delete(id, pool);

      if (!deleted) {
        return res.status(404).json({ message: '岗位不存在' });
      }

      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      console.error('[删除岗位] 失败:', error.message);
      res.status(500).json({ message: '删除岗位失败，请稍后重试' });
    }
  });

  // ==================== 面试会话 ====================

  // POST /api/personal/interview/sessions - 创建面试会话（含简历上传）
  router.post('/sessions', upload.single('resume'), async (req, res) => {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: '请上传简历文件' });
    }

    try {
      const pool = getPersonalUserDB(userId);

      // 解析岗位信息
      let positionInfo;
      try {
        positionInfo = typeof req.body.positionInfo === 'string'
          ? JSON.parse(req.body.positionInfo)
          : req.body.positionInfo;
      } catch (e) {
        return res.status(400).json({ message: '岗位信息格式错误' });
      }

      if (!positionInfo || !positionInfo.positionName || !positionInfo.description) {
        return res.status(400).json({ message: '岗位名称和描述为必填项' });
      }

      // 解析配置
      const difficulty = req.body.difficulty || 'medium';
      const totalQuestions = parseInt(req.body.totalQuestions, 10) || 10;

      // 修复文件名编码
      req.file.originalname = fixFilenameEncoding(req.file.originalname);

      // 上传并解析简历
      const resume = await resumeService.uploadAndParse(userId, req.file, pool);

      // 创建面试会话
      const session = await sessionService.create(userId, resume.id, positionInfo, {
        difficulty,
        totalQuestions
      }, pool);

      // 获取简历文本并生成第一个问题
      const firstQuestion = await sessionService.start(session.id, resume.parsedText, pool);

      res.status(201).json({
        session: {
          id: session.id,
          positionInfo: session.positionInfo,
          difficulty: session.difficulty,
          totalQuestions: session.totalQuestions,
          status: session.status
        },
        firstQuestion,
        resume: {
          id: resume.id,
          fileName: resume.fileName,
          parseStatus: resume.parseStatus
        }
      });
    } catch (error) {
      console.error('[创建面试会话] 失败:', error.message);
      res.status(500).json({ message: error.message || '创建面试会话失败，请稍后重试' });
    }
  });

  // GET /api/personal/interview/sessions - 获取面试历史列表
  router.get('/sessions', async (req, res) => {
    const userId = req.user.id;
    const { status, limit, offset } = req.query;

    try {
      const pool = getPersonalUserDB(userId);
      const sessions = await sessionService.getByUserId(userId, {
        status,
        limit: parseInt(limit, 10) || 20,
        offset: parseInt(offset, 10) || 0
      }, pool);

      res.json(sessions);
    } catch (error) {
      console.error('[获取面试历史] 失败:', error.message);
      res.status(500).json({ message: '获取面试历史失败，请稍后重试' });
    }
  });

  // GET /api/personal/interview/sessions/:id - 获取会话详情
  router.get('/sessions/:id', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const pool = getPersonalUserDB(userId);
      const session = await sessionService.getById(id, pool);

      if (!session) {
        return res.status(404).json({ message: '面试会话不存在' });
      }

      // 验证权限
      if (session.userId !== userId) {
        return res.status(403).json({ message: '无权访问此会话' });
      }

      res.json(session);
    } catch (error) {
      console.error('[获取会话详情] 失败:', error.message);
      res.status(500).json({ message: '获取会话详情失败，请稍后重试' });
    }
  });

  // PATCH /api/personal/interview/sessions/:id - 提交回答
  router.patch('/sessions/:id', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { questionId, answer } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({ message: '问题ID和回答内容为必填项' });
    }

    if (answer.trim().length < 10) {
      return res.status(400).json({ message: '回答内容至少需要10个字符' });
    }

    try {
      const pool = getPersonalUserDB(userId);

      // 获取会话和简历
      const session = await sessionService.getById(id, pool);
      if (!session) {
        return res.status(404).json({ message: '面试会话不存在' });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: '无权访问此会话' });
      }

      // 获取简历文本
      const resume = await resumeService.getById(session.resumeId, pool);
      if (!resume) {
        return res.status(404).json({ message: '简历不存在' });
      }

      // 提交回答
      const result = await sessionService.submitAnswer(id, questionId, answer, resume.parsedText, pool);

      res.json(result);
    } catch (error) {
      console.error('[提交回答] 失败:', error.message);
      res.status(500).json({ message: error.message || '提交回答失败，请稍后重试' });
    }
  });

  // POST /api/personal/interview/sessions/:id/complete - 完成面试
  router.post('/sessions/:id/complete', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const pool = getPersonalUserDB(userId);

      // 验证权限
      const session = await sessionService.getById(id, pool);
      if (!session) {
        return res.status(404).json({ message: '面试会话不存在' });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: '无权访问此会话' });
      }

      // 完成面试
      const result = await sessionService.complete(id, pool);

      // 更新统计数据
      await statsService.updateStats(userId, result, pool);

      res.json(result);
    } catch (error) {
      console.error('[完成面试] 失败:', error.message);
      res.status(500).json({ message: error.message || '完成面试失败，请稍后重试' });
    }
  });

  // DELETE /api/personal/interview/sessions/:id - 删除面试记录
  router.delete('/sessions/:id', async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const pool = getPersonalUserDB(userId);

      // 验证权限
      const session = await sessionService.getById(id, pool);
      if (!session) {
        return res.status(404).json({ message: '面试会话不存在' });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ message: '无权访问此会话' });
      }

      // 删除面试会话
      const deleted = await sessionService.delete(id, pool);

      if (!deleted) {
        return res.status(400).json({ message: '删除失败' });
      }

      // 同时删除关联的简历（如果存在）
      if (session.resumeId) {
        try {
          await resumeService.delete(session.resumeId, userId, pool);
        } catch (err) {
          console.log('[删除面试] 简历删除失败:', err.message);
        }
      }

      // 更新统计数据
      await statsService.recalculateStats(userId, pool);

      res.json({ success: true, message: '面试记录已删除' });
    } catch (error) {
      console.error('[删除面试] 失败:', error.message);
      res.status(500).json({ message: '删除面试记录失败，请稍后重试' });
    }
  });

  // ==================== 统计数据 ====================

  // GET /api/personal/interview/stats - 获取统计数据
  router.get('/stats', async (req, res) => {
    const userId = req.user.id;

    try {
      const pool = getPersonalUserDB(userId);
      const stats = await statsService.getStats(userId, pool);
      res.json(stats);
    } catch (error) {
      console.error('[获取统计数据] 失败:', error.message);
      res.status(500).json({ message: '获取统计数据失败，请稍后重试' });
    }
  });

  return router;
}

module.exports = createPersonalInterviewRouter;
