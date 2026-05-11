/**
 * 个人面试 API 工具函数
 * 用于与后端 /api/personal/interview 路由交互
 */
import axios from 'axios';

// 获取认证 token
const getToken = () => localStorage.getItem('token');

// 创建带认证头的 axios 实例
const createAuthAxios = () => {
  const token = getToken();
  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
};

// ==================== 岗位管理 ====================

/**
 * 创建岗位
 * @param {Object} data - 岗位数据
 * @returns {Promise<Object>} - 创建的岗位
 */
export const createPosition = async (data) => {
  const api = createAuthAxios();
  const response = await api.post('/api/personal/interview/positions', data);
  return response.data;
};

/**
 * 获取岗位列表
 * @returns {Promise<Array>} - 岗位列表
 */
export const getPositions = async () => {
  const api = createAuthAxios();
  const response = await api.get('/api/personal/interview/positions');
  return response.data;
};

/**
 * 获取单个岗位
 * @param {string} id - 岗位ID
 * @returns {Promise<Object>} - 岗位信息
 */
export const getPositionById = async (id) => {
  const api = createAuthAxios();
  const response = await api.get(`/api/personal/interview/positions/${id}`);
  return response.data;
};

/**
 * 更新岗位
 * @param {string} id - 岗位ID
 * @param {Object} data - 更新数据
 * @returns {Promise<Object>} - 更新后的岗位
 */
export const updatePosition = async (id, data) => {
  const api = createAuthAxios();
  const response = await api.put(`/api/personal/interview/positions/${id}`, data);
  return response.data;
};

/**
 * 删除岗位
 * @param {string} id - 岗位ID
 * @returns {Promise<Object>} - 删除结果
 */
export const deletePosition = async (id) => {
  const api = createAuthAxios();
  const response = await api.delete(`/api/personal/interview/positions/${id}`);
  return response.data;
};

// ==================== 面试会话 ====================

/**
 * 创建面试会话（含简历上传）
 * @param {File} file - 简历文件
 * @param {Object} positionInfo - 岗位信息
 * @param {Object} config - 配置 (difficulty, totalQuestions)
 * @returns {Promise<Object>} - 会话信息和第一个问题
 */
export const createSession = async (file, positionInfo, config = {}) => {
  const token = getToken();
  const formData = new FormData();
  formData.append('resume', file);
  formData.append('positionInfo', JSON.stringify(positionInfo));
  formData.append('difficulty', config.difficulty || 'medium');
  formData.append('totalQuestions', config.totalQuestions || 10);

  const response = await axios.post('/api/personal/interview/sessions', formData, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * 获取面试历史列表
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Array>} - 面试历史列表
 */
export const getSessions = async (filters = {}) => {
  const api = createAuthAxios();
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  const response = await api.get(`/api/personal/interview/sessions?${params.toString()}`);
  return response.data;
};

/**
 * 获取会话详情
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Object>} - 会话详情
 */
export const getSessionById = async (sessionId) => {
  const api = createAuthAxios();
  const response = await api.get(`/api/personal/interview/sessions/${sessionId}`);
  return response.data;
};

/**
 * 提交回答
 * @param {string} sessionId - 会话ID
 * @param {string} questionId - 问题ID
 * @param {string} answer - 回答内容
 * @returns {Promise<Object>} - 评估结果和下一问题
 */
export const submitAnswer = async (sessionId, questionId, answer) => {
  const api = createAuthAxios();
  const response = await api.patch(`/api/personal/interview/sessions/${sessionId}`, {
    questionId,
    answer
  });
  return response.data;
};

/**
 * 完成面试
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Object>} - 面试结果
 */
export const completeSession = async (sessionId) => {
  const api = createAuthAxios();
  const response = await api.post(`/api/personal/interview/sessions/${sessionId}/complete`);
  return response.data;
};

/**
 * 取消面试
 * @param {string} sessionId - 会话ID
 * @returns {Promise<Object>} - 取消结果
 */
export const cancelSession = async (sessionId) => {
  const api = createAuthAxios();
  const response = await api.delete(`/api/personal/interview/sessions/${sessionId}`);
  return response.data;
};

// ==================== 统计数据 ====================

/**
 * 获取统计数据
 * @returns {Promise<Object>} - 统计数据
 */
export const getStats = async () => {
  const api = createAuthAxios();
  const response = await api.get('/api/personal/interview/stats');
  return response.data;
};

// ==================== 辅助函数 ====================

/**
 * 格式化时长（秒转为 mm:ss）
 * @param {number} seconds - 秒数
 * @returns {string} - 格式化后的时长
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 格式化日期时间
 * @param {string|Date} date - 日期
 * @returns {string} - 格式化后的日期时间
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 获取等级标签
 * @param {string} grade - 等级
 * @returns {string} - 等级标签
 */
export const getGradeLabel = (grade) => {
  const gradeMap = {
    A: '优秀',
    B: '良好',
    C: '中等',
    D: '及格',
    E: '待提升'
  };
  return gradeMap[grade] || '未知';
};

/**
 * 获取等级颜色
 * @param {string} grade - 等级
 * @returns {string} - 颜色值
 */
export const getGradeColor = (grade) => {
  const colorMap = {
    A: '#22C55E', // 绿色
    B: '#3B82F6', // 蓝色
    C: '#F59E0B', // 橙色
    D: '#EF4444', // 红色
    E: '#6B7280'  // 灰色
  };
  return colorMap[grade] || '#6B7280';
};

/**
 * 获取难度标签
 * @param {string} difficulty - 难度
 * @returns {string} - 难度标签
 */
export const getDifficultyLabel = (difficulty) => {
  const difficultyMap = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };
  return difficultyMap[difficulty] || '中等';
};

/**
 * 获取难度颜色
 * @param {string} difficulty - 难度
 * @returns {string} - 颜色值
 */
export const getDifficultyColor = (difficulty) => {
  const colorMap = {
    easy: '#22C55E',
    medium: '#F59E0B',
    hard: '#EF4444'
  };
  return colorMap[difficulty] || '#F59E0B';
};

/**
 * 获取状态标签
 * @param {string} status - 状态
 * @returns {string} - 状态标签
 */
export const getStatusLabel = (status) => {
  const statusMap = {
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  };
  return statusMap[status] || '未知';
};

/**
 * 获取状态颜色
 * @param {string} status - 状态
 * @returns {string} - 颜色值
 */
export const getStatusColor = (status) => {
  const colorMap = {
    in_progress: '#3B82F6',
    completed: '#22C55E',
    cancelled: '#6B7280'
  };
  return colorMap[status] || '#6B7280';
};

/**
 * 维度名称映射
 */
export const dimensionLabels = {
  relevance: '回答相关性',
  clarity: '表达清晰度',
  depth: '回答深度',
  professionalism: '专业性',
  authenticity: '真实性'
};

/**
 * 获取维度标签
 * @param {string} dimension - 维度
 * @returns {string} - 维度标签
 */
export const getDimensionLabel = (dimension) => {
  return dimensionLabels[dimension] || dimension;
};

export default {
  // 岗位管理
  createPosition,
  getPositions,
  getPositionById,
  updatePosition,
  deletePosition,

  // 面试会话
  createSession,
  getSessions,
  getSessionById,
  submitAnswer,
  completeSession,
  cancelSession,

  // 统计数据
  getStats,

  // 辅助函数
  formatDuration,
  formatDateTime,
  getGradeLabel,
  getGradeColor,
  getDifficultyLabel,
  getDifficultyColor,
  getStatusLabel,
  getStatusColor,
  getDimensionLabel,
  dimensionLabels
};
