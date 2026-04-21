const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const {
  listPositionsForUser,
  upsertPositionForUser,
  deletePositionById
} = require('../services/candidateStore');
const { authMiddleware } = require('../middleware/auth.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';

function resolvePositionAccessContext(req) {
  const bearerToken = req.headers.authorization?.split(' ')[1];
  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, JWT_SECRET);
      return {
        ownerUserId: decoded.id,
        ownerUserName: decoded.username || decoded.name || decoded.email || '',
        ownerUserEmail: decoded.email || '',
        isAuthenticated: true
      };
    } catch (error) {}
  }
  return null;
}

function serializePosition(position) {
  return {
    id: position.id,
    name: position.name,
    description: position.description || '',
    config: position.config || {},
    createdAt: position.createdAt || null,
    updatedAt: position.updatedAt || null
  };
}

const router = express.Router();

// GET /api/positions - List all positions for the authenticated user
router.get('/positions', async (req, res) => {
  try {
    const context = await resolvePositionAccessContext(req);
    if (!context?.ownerUserId) {
      return res.status(401).json({ success: false, error: '未授权访问岗位列表' });
    }
    const positions = await listPositionsForUser(context.ownerUserId);
    res.json({ success: true, positions: positions.map(serializePosition) });
  } catch (error) {
    console.error('获取岗位配置失败:', error);
    res.status(500).json({ success: false, error: '获取岗位配置失败', message: error.message });
  }
});

// POST /api/positions - Create a new position
router.post('/positions', authMiddleware, async (req, res) => {
  try {
    const position = await upsertPositionForUser(req.user.id, req.body || {});
    res.json({ success: true, position: serializePosition(position) });
  } catch (error) {
    console.error('新增岗位失败:', error);
    res.status(error.message?.includes('已存在') || error.message?.includes('不能为空') ? 400 : 500).json({
      success: false, error: '新增岗位失败', message: error.message
    });
  }
});

// PUT /api/positions/:id - Update an existing position
router.put('/positions/:id', authMiddleware, async (req, res) => {
  try {
    const position = await upsertPositionForUser(req.user.id, { ...(req.body || {}), id: Number(req.params.id) });
    res.json({ success: true, position: serializePosition(position) });
  } catch (error) {
    console.error('更新岗位失败:', error);
    res.status(error.message?.includes('已存在') || error.message?.includes('不能为空') ? 400 : 500).json({
      success: false, error: '更新岗位失败', message: error.message
    });
  }
});

// DELETE /api/positions/:id - Delete a position
router.delete('/positions/:id', authMiddleware, async (req, res) => {
  try {
    const deletedCount = await deletePositionById(req.user.id, Number(req.params.id));
    if (!deletedCount) {
      return res.status(404).json({ success: false, error: '岗位不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('删除岗位失败:', error);
    res.status(500).json({ success: false, error: '删除岗位失败', message: error.message });
  }
});

module.exports = router;
