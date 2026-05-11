/**
 * 统计数据服务
 * 负责用户训练统计的获取和更新
 */
const scoringService = require('./scoringService');

class StatsService {
  /**
   * 获取用户统计数据
   * @param {number} userId - 用户ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 统计数据
   */
  async getStats(userId, pool) {
    // 尝试从统计表获取
    const [statsRows] = await pool.execute(
      'SELECT * FROM interview_stats WHERE user_id = ?',
      [userId]
    );

    if (statsRows.length > 0) {
      return this.formatStats(statsRows[0]);
    }

    // 如果统计表没有数据，从会话表计算
    const calculatedStats = await this.calculateStatsFromSessions(userId, pool);
    if (calculatedStats.totalSessions > 0) {
      await this.saveStatsSnapshot(userId, calculatedStats, pool);
    }
    return calculatedStats;
  }

  /**
   * 从会话记录计算统计数据
   * @param {number} userId - 用户ID
   * @param {Object} pool - 数据库连接池
   * @returns {Promise<Object>} - 统计数据
   */
  async calculateStatsFromSessions(userId, pool) {
    const [sessions] = await pool.execute(
      `SELECT start_time, final_score, duration, scoring, position_info FROM interview_sessions
       WHERE user_id = ? AND status = 'completed'
       ORDER BY start_time DESC`,
      [userId]
    );

    if (sessions.length === 0) {
      return this.getEmptyStats();
    }

    const completedSessions = sessions.length;
    const scores = sessions
      .filter(s => s.final_score !== null)
      .map(s => Number(s.final_score));

    const averageScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    const totalDuration = sessions
      .filter(s => s.duration)
      .reduce((sum, s) => sum + Number(s.duration), 0);

    // 计算各维度平均分
    const dimensionAverages = this.calculateDimensionAverages(sessions);

    // 计算岗位分布
    const positionStats = this.calculatePositionStats(sessions);

    // 计算趋势
    const trend = this.calculateTrend(sessions);

    // 识别薄弱领域
    const weakAreas = scoringService.identifyWeakAreas(dimensionAverages);

    return {
      totalSessions: sessions.length,
      completedSessions,
      averageScore,
      highestScore,
      lowestScore,
      totalDuration,
      positionStats,
      dimensionAverages,
      trend,
      weakAreas,
      lastSessionTime: sessions[0]?.start_time || null
    };
  }

  /**
   * 更新用户统计数据
   * @param {number} userId - 用户ID
   * @param {Object} sessionData - 会话数据
   * @param {Object} pool - 数据库连接池
   */
  async updateStats(userId, sessionData, pool) {
    const currentStats = await this.getStats(userId, pool);

    // 更新统计
    const newTotalSessions = currentStats.totalSessions + 1;
    const newCompletedSessions = sessionData.status === 'completed'
      ? currentStats.completedSessions + 1
      : currentStats.completedSessions;

    // 重新计算平均分
    const [sessions] = await pool.execute(
      `SELECT final_score FROM interview_sessions
       WHERE user_id = ? AND status = 'completed' AND final_score IS NOT NULL`,
      [userId]
    );

    const scores = sessions.map(s => Number(s.final_score));
    const averageScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : 0;

    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Upsert 统计表
    await pool.execute(
      `INSERT INTO interview_stats
       (user_id, total_sessions, completed_sessions, average_score, highest_score, lowest_score, total_duration, last_session_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         total_sessions = VALUES(total_sessions),
         completed_sessions = VALUES(completed_sessions),
         average_score = VALUES(average_score),
         highest_score = VALUES(highest_score),
         lowest_score = VALUES(lowest_score),
         last_session_time = NOW()`,
      [userId, newTotalSessions, newCompletedSessions, averageScore, highestScore, lowestScore, currentStats.totalDuration + (sessionData.duration || 0)]
    );
  }

  /**
   * 重新计算用户统计数据（删除面试记录后调用）
   * @param {number} userId - 用户ID
   * @param {Object} pool - 数据库连接池
   */
  async recalculateStats(userId, pool) {
    // 从会话表重新计算所有统计
    const stats = await this.calculateStatsFromSessions(userId, pool);

    await this.saveStatsSnapshot(userId, stats, pool);
  }

  async saveStatsSnapshot(userId, stats, pool) {
    await pool.execute(
      `INSERT INTO interview_stats
       (user_id, total_sessions, completed_sessions, average_score, highest_score, lowest_score, total_duration, position_stats, dimension_averages, trend, weak_areas, last_session_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_sessions = VALUES(total_sessions),
         completed_sessions = VALUES(completed_sessions),
         average_score = VALUES(average_score),
         highest_score = VALUES(highest_score),
         lowest_score = VALUES(lowest_score),
         total_duration = VALUES(total_duration),
         position_stats = VALUES(position_stats),
         dimension_averages = VALUES(dimension_averages),
         trend = VALUES(trend),
         weak_areas = VALUES(weak_areas),
         last_session_time = VALUES(last_session_time)`,
      [
        userId,
        stats.totalSessions,
        stats.completedSessions,
        stats.averageScore,
        stats.highestScore,
        stats.lowestScore,
        stats.totalDuration,
        JSON.stringify(stats.positionStats),
        JSON.stringify(stats.dimensionAverages),
        JSON.stringify(stats.trend),
        JSON.stringify(stats.weakAreas),
        stats.lastSessionTime
      ]
    );
  }

  /**
   * 计算各维度平均分
   */
  calculateDimensionAverages(sessions) {
    const dimensions = ['relevance', 'clarity', 'depth', 'professionalism', 'authenticity'];
    const result = {};

    for (const dimension of dimensions) {
      const scores = [];
      for (const session of sessions) {
        const scoring = this.parseJSON(session.scoring);
        if (scoring?.dimensionAverages?.[dimension]) {
          scores.push(Number(scoring.dimensionAverages[dimension]));
        }
      }
      result[dimension] = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;
    }

    return result;
  }

  /**
   * 计算岗位分布统计
   */
  calculatePositionStats(sessions) {
    const positionCounts = {};

    for (const session of sessions) {
      const positionInfo = this.parseJSON(session.position_info);
      const positionName = positionInfo?.positionName || '未知岗位';
      positionCounts[positionName] = (positionCounts[positionName] || 0) + 1;
    }

    return Object.entries(positionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 计算分数趋势
   */
  calculateTrend(sessions) {
    return sessions
      .filter(s => s.final_score !== null)
      .slice(0, 10)
      .reverse()
      .map(s => ({
        date: s.start_time,
        score: Number(s.final_score)
      }));
  }

  /**
   * 获取空统计数据
   */
  getEmptyStats() {
    return {
      totalSessions: 0,
      completedSessions: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      totalDuration: 0,
      positionStats: [],
      dimensionAverages: {
        relevance: 0,
        clarity: 0,
        depth: 0,
        professionalism: 0,
        authenticity: 0
      },
      trend: [],
      weakAreas: [],
      lastSessionTime: null
    };
  }

  /**
   * 格式化统计数据
   */
  formatStats(row) {
    return {
      totalSessions: row.total_sessions || 0,
      completedSessions: row.completed_sessions || 0,
      averageScore: Number(row.average_score) || 0,
      highestScore: Number(row.highest_score) || 0,
      lowestScore: Number(row.lowest_score) || 0,
      totalDuration: row.total_duration || 0,
      positionStats: this.parseJSON(row.position_stats) || [],
      dimensionAverages: this.parseJSON(row.dimension_averages) || {},
      trend: this.parseJSON(row.trend) || [],
      weakAreas: this.parseJSON(row.weak_areas) || [],
      lastSessionTime: row.last_session_time
    };
  }

  /**
   * 安全解析 JSON
   */
  parseJSON(str) {
    if (!str) return null;
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch {
      return null;
    }
  }
}

module.exports = new StatsService();
