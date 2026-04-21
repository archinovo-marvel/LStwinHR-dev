const express = require('express');

function createInterviewSessionRouter({
  authMiddleware,
  getCurrentInterviewSessionForUser,
  listInterviewSessionsForUser,
  createInterviewSessionForUser,
  upsertInterviewSessionForUser,
  deleteInterviewSessionById,
  deleteTemporaryInterviewSessionsForUser
}) {
  const router = express.Router();

  router.get('/interview-sessions/current', authMiddleware, async (req, res) => {
    try {
      const session = await getCurrentInterviewSessionForUser(req.user.id);
      res.json({ success: true, session });
    } catch (error) {
      console.error('获取当前面试会话失败:', error);
      res.status(500).json({ message: '获取当前面试会话失败' });
    }
  });

  router.get('/interview-sessions', authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10);
      const sessions = await listInterviewSessionsForUser(req.user.id, { limit });
      res.json({ success: true, sessions });
    } catch (error) {
      console.error('获取面试会话列表失败:', error);
      res.status(500).json({ message: '获取面试会话列表失败' });
    }
  });

  router.post('/interview-sessions', authMiddleware, async (req, res) => {
    try {
      const session = await createInterviewSessionForUser(req.user.id, req.body);
      res.json({ success: true, session });
    } catch (error) {
      console.error('创建面试会话失败:', error);
      res.status(error.statusCode || 500).json({ message: error.message || '创建面试会话失败' });
    }
  });

  router.patch('/interview-sessions/:id', authMiddleware, async (req, res) => {
    try {
      const session = await upsertInterviewSessionForUser(req.user.id, {
        id: req.params.id,
        ...req.body
      });
      res.json({ success: true, session });
    } catch (error) {
      console.error('更新面试会话失败:', error);
      res.status(error.statusCode || 500).json({ message: error.message || '更新面试会话失败' });
    }
  });

  router.delete('/interview-sessions/temp', authMiddleware, async (req, res) => {
    try {
      const deletedCount = await deleteTemporaryInterviewSessionsForUser(req.user.id);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('清理临时面试会话失败:', error);
      res.status(500).json({ message: '清理临时面试会话失败' });
    }
  });

  router.delete('/interview-sessions/:id', authMiddleware, async (req, res) => {
    try {
      const deletedCount = await deleteInterviewSessionById(req.user.id, req.params.id);
      if (!deletedCount) {
        return res.status(404).json({ message: '面试会话不存在' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('删除面试会话失败:', error);
      res.status(500).json({ message: '删除面试会话失败' });
    }
  });

  return router;
}

module.exports = {
  createInterviewSessionRouter
};
