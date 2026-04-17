const express = require('express');

function createCandidateRouter({
  authMiddleware,
  publicSubmissionMiddleware,
  upload,
  createCandidateSubmission,
  saveCandidateInterviewResult,
  listCandidatesForUser,
  deleteCandidateById,
  clearCandidatesForUser
}) {
  const router = express.Router();

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

  return router;
}

module.exports = {
  createCandidateRouter
};
