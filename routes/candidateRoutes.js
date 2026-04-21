const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

function createCandidateRouter({
  authMiddleware,
  publicSubmissionMiddleware,
  upload,
  createCandidateSubmission,
  saveCandidateInterviewResult,
  listCandidatesForUser,
  deleteCandidateById,
  clearCandidatesForUser,
  getCandidateByIdGlobal,
  ensureDataFile,
  getInvalidCandidates,
  removeCandidateResumeFile,
  DATA_FILE
}) {
  const router = express.Router();

  // 获取工作流列表
  router.get('/workflows', async (req, res) => {
    try {
      const workflows = [
        {
          id: 1,
          title: '简历智能分析',
          description: '上传简历，AI自动分析候选人特点',
          steps: ['上传简历文件', 'AI智能分析', '生成分析报告', '查看匹配度'],
          route: '/resume'
        },
        {
          id: 2,
          title: 'AI智能对话',
          description: '与AI HR进行智能对话，了解企业信息',
          steps: ['选择对话类型', '开始AI对话', '语音/文字交互', '获得专业建议'],
          route: '/chat'
        },
        {
          id: 3,
          title: '候选人管理',
          description: '查看和管理所有候选人信息',
          steps: ['查看候选人列表', '分析简历内容', '查看匹配度', '管理候选人状态'],
          route: '/resume-analysis'
        },
        {
          id: 4,
          title: 'AI面试评估',
          description: '进行AI模拟面试，获得专业评估',
          steps: ['选择面试类型', '开始AI面试', '回答问题', '获得评估报告'],
          route: '/chat'
        }
      ];
      res.json({ workflows });
    } catch (error) {
      console.error('获取工作流失败:', error);
      res.status(500).json({ error: '获取工作流失败' });
    }
  });

  // 简历下载端点
  router.get('/download-resume/:id', async (req, res) => {
    try {
      console.log('收到下载请求:', req.params.id);
      const candidateId = parseInt(req.params.id);

      if (isNaN(candidateId)) {
        console.error('无效的候选人ID:', req.params.id);
        return res.status(400).send('无效的候选人ID');
      }

      // 从数据库获取候选人数据
      const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });

      console.log('找到候选人:', candidate ? candidate.name : '未找到');

      if (!candidate) {
        return res.status(404).send('候选人不存在');
      }

      // 确定文件扩展名
      let ext;
      if (candidate.resumeFileBuffer && candidate.resumeFileName) {
        ext = path.extname(candidate.resumeFileName).toLowerCase();
      } else if (candidate.resumeFilePath) {
        ext = path.extname(candidate.resumeFilePath).toLowerCase();
      } else {
        return res.status(404).send('简历文件不存在');
      }

      let contentType = 'application/octet-stream';
      if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (ext === '.doc') {
        contentType = 'application/msword';
      } else if (ext === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      }

      // 如果有内存中的文件，直接下载
      if (candidate.resumeFileBuffer) {
        const fileName = candidate.resumeFileName || `resume_${candidate.id}${ext}`;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(candidate.resumeFileBuffer);
        console.log('内存文件下载成功');
        return;
      }

      // 如果有文件路径，尝试读取文件
      if (candidate.resumeFilePath) {
        try {
          await fs.access(candidate.resumeFilePath);
          const fileBuffer = await fs.readFile(candidate.resumeFilePath);

          res.setHeader('Content-Type', contentType);
          const fileName = candidate.resumeFileName || `resume_${candidate.id}${ext}`;
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

          res.send(fileBuffer);
          console.log('文件下载成功');
          return;
        } catch (error) {
          console.log('文件不存在:', error.message);
        }
      }

      // 如果没有文件，返回错误信息
      console.log('简历文件不存在');
      res.status(404).send('简历文件不存在');
    } catch (error) {
      console.error('下载简历失败:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).send('下载失败');
    }
  });

  router.post('/candidates', authMiddleware, upload.single('resume'), async (req, res) => {
    res.setTimeout(180000);

    try {
      const candidate = await createCandidateSubmission({
        body: req.body,
        file: req.file,
        owner: req.user,
        source: 'authenticated'
      });

      res.json({ success: true, candidate });
    } catch (error) {
      console.error('保存候选人数据失败:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json(error.payload || {
        success: false,
        error: '保存数据失败',
        message: error.message
      });
    }
  });

  router.post('/public/candidates', publicSubmissionMiddleware, upload.single('resume'), async (req, res) => {
    res.setTimeout(180000);

    try {
      const candidate = await createCandidateSubmission({
        body: req.body,
        file: req.file,
        owner: {
          id: req.publicSubmission.ownerUserId,
          username: req.publicSubmission.ownerUserName,
          email: req.publicSubmission.ownerUserEmail
        },
        source: 'public'
      });

      res.json({ success: true, candidate });
    } catch (error) {
      console.error('公开投递保存失败:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json(error.payload || {
        success: false,
        error: '保存数据失败',
        message: error.message
      });
    }
  });

  router.post('/candidates/interview-score', authMiddleware, async (req, res) => {
    try {
      const data = await saveCandidateInterviewResult({
        user: req.user,
        payload: req.body
      });

      res.json({
        success: true,
        message: '面试分和面试记录保存成功',
        data
      });
    } catch (error) {
      console.error('保存面试分失败:', error);
      res.status(error.statusCode || 500).json({ error: error.message || '保存面试分失败' });
    }
  });

  router.get('/candidates', authMiddleware, async (req, res) => {
    req.setTimeout(60000);
    res.setTimeout(60000);

    try {
      const candidates = await listCandidatesForUser(req.user.id);
      res.json(candidates);
    } catch (error) {
      console.error('获取候选人列表失败:', error);
      res.status(500).json({ error: '获取候选人列表失败' });
    }
  });

  router.delete('/candidates/:id', authMiddleware, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id, 10);
      const deletedCount = await deleteCandidateById(req.user.id, candidateId);

      if (!deletedCount) {
        return res.status(404).json({ error: '候选人不存在' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('删除数据失败:', error);
      res.status(error.statusCode || 500).json({ error: error.message || '删除数据失败' });
    }
  });

  router.delete('/candidates', authMiddleware, async (req, res) => {
    try {
      const deletedCount = await clearCandidatesForUser(req.user.id);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('清空数据失败:', error);
      res.status(500).json({ error: '清空数据失败' });
    }
  });

  // Cleanup endpoints (legacy JSON file management)
  if (getInvalidCandidates && ensureDataFile) {
    router.get('/candidates/cleanup-invalid-preview', async (req, res) => {
      try {
        await ensureDataFile();
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const candidates = JSON.parse(data);
        const invalidCandidates = await getInvalidCandidates(candidates);
        res.json({ success: true, count: invalidCandidates.length, candidates: invalidCandidates });
      } catch (error) {
        console.error('预览无效候选人清理失败:', error);
        res.status(500).json({ error: '预览无效候选人清理失败' });
      }
    });

    router.delete('/candidates/cleanup-invalid', async (req, res) => {
      try {
        await ensureDataFile();
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const candidates = JSON.parse(data);
        const invalidCandidates = await getInvalidCandidates(candidates);
        if (invalidCandidates.length === 0) {
          return res.json({ success: true, removedCount: 0, removedCandidates: [] });
        }
        const invalidIds = new Set(invalidCandidates.map(c => c.id));
        const removedCandidates = candidates.filter(c => invalidIds.has(c.id));
        const validCandidates = candidates.filter(c => !invalidIds.has(c.id));
        for (const candidate of removedCandidates) {
          await removeCandidateResumeFile(candidate);
        }
        await fs.writeFile(DATA_FILE, JSON.stringify(validCandidates, null, 2));
        res.json({ success: true, removedCount: removedCandidates.length, removedCandidates: invalidCandidates });
      } catch (error) {
        console.error('清理无效候选人失败:', error);
        res.status(500).json({ error: '清理无效候选人失败' });
      }
    });
  }

  return router;
}

module.exports = {
  createCandidateRouter
};
