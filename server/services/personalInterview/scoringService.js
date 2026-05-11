/**
 * 评分计算服务
 * 负责实时评分和最终评分计算
 */

// 评分维度权重
const DIMENSION_WEIGHTS = {
  relevance: 0.25,
  clarity: 0.20,
  depth: 0.25,
  professionalism: 0.20,
  authenticity: 0.10
};

// 等级划分
const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A', label: '优秀' },
  { min: 80, grade: 'B', label: '良好' },
  { min: 70, grade: 'C', label: '中等' },
  { min: 60, grade: 'D', label: '及格' },
  { min: 0, grade: 'E', label: '待提升' }
];

class ScoringService {
  /**
   * 计算单题加权得分
   * @param {Object} scores - 各维度分数
   * @returns {number} - 加权总分 (0-10)
   */
  calculateQuestionScore(scores) {
    if (!scores) return 0;

    let totalScore = 0;
    for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      const score = Number(scores[dimension]) || 0;
      totalScore += score * weight;
    }

    return Math.round(totalScore * 10) / 10;
  }

  /**
   * 计算面试最终得分
   * @param {Array} conversation - 对话记录（含评分）
   * @returns {Object} - 最终评分结果
   */
  calculateFinalScore(conversation) {
    if (!conversation || conversation.length === 0) {
      return {
        totalScore: 0,
        grade: 'E',
        dimensionAverages: {}
      };
    }

    // 收集所有评分
    const allScores = conversation
      .filter(item => item.scores)
      .map(item => item.scores);

    if (allScores.length === 0) {
      return {
        totalScore: 0,
        grade: 'E',
        dimensionAverages: {}
      };
    }

    // 计算各维度平均分
    const dimensionAverages = {};
    const dimensions = ['relevance', 'clarity', 'depth', 'professionalism', 'authenticity'];

    for (const dimension of dimensions) {
      const scores = allScores.map(s => Number(s[dimension]) || 0);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      dimensionAverages[dimension] = Math.round(avg * 10) / 10;
    }

    // 计算加权总分 (转换为百分制)
    let weightedTotal = 0;
    for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      weightedTotal += (dimensionAverages[dimension] || 0) * weight;
    }

    const totalScore = Math.round(weightedTotal * 10);

    // 确定等级
    const grade = this.determineGrade(totalScore);

    return {
      totalScore,
      grade,
      dimensionAverages
    };
  }

  /**
   * 根据分数确定等级
   * @param {number} score - 总分
   * @returns {string} - 等级
   */
  determineGrade(score) {
    for (const threshold of GRADE_THRESHOLDS) {
      if (score >= threshold.min) {
        return threshold.grade;
      }
    }
    return 'E';
  }

  /**
   * 获取等级标签
   * @param {string} grade - 等级
   * @returns {string} - 等级标签
   */
  getGradeLabel(grade) {
    const threshold = GRADE_THRESHOLDS.find(t => t.grade === grade);
    return threshold ? threshold.label : '未知';
  }

  /**
   * 生成评分摘要
   * @param {Object} scoring - 评分数据
   * @returns {Object} - 摘要信息
   */
  generateScoringSummary(scoring) {
    if (!scoring) {
      return {
        totalScore: 0,
        grade: 'E',
        gradeLabel: '待提升',
        dimensionAverages: {},
        questionCount: 0,
        answeredCount: 0
      };
    }

    const { totalScore, grade, dimensionAverages } = scoring;

    return {
      totalScore: totalScore || 0,
      grade: grade || 'E',
      gradeLabel: this.getGradeLabel(grade),
      dimensionAverages: dimensionAverages || {},
      questionCount: scoring.questionCount || 0,
      answeredCount: scoring.answeredCount || 0
    };
  }

  /**
   * 计算维度得分趋势
   * @param {Array} sessions - 历史面试会话
   * @returns {Object} - 各维度趋势
   */
  calculateDimensionTrends(sessions) {
    if (!sessions || sessions.length === 0) {
      return {};
    }

    const dimensionTrends = {};
    const dimensions = ['relevance', 'clarity', 'depth', 'professionalism', 'authenticity'];

    for (const dimension of dimensions) {
      const scores = sessions
        .filter(s => s.scoring?.dimensionAverages?.[dimension])
        .map(s => ({
          date: s.start_time,
          score: s.scoring.dimensionAverages[dimension]
        }));

      dimensionTrends[dimension] = scores.slice(-10); // 最近10次
    }

    return dimensionTrends;
  }

  /**
   * 识别薄弱领域
   * @param {Object} dimensionAverages - 各维度平均分
   * @returns {Array} - 薄弱领域列表
   */
  identifyWeakAreas(dimensionAverages) {
    if (!dimensionAverages) return [];

    const dimensionLabels = {
      relevance: '回答相关性',
      clarity: '表达清晰度',
      depth: '回答深度',
      professionalism: '专业性',
      authenticity: '真实性'
    };

    const weakAreas = [];
    const threshold = 7.0; // 低于7分视为薄弱

    for (const [dimension, score] of Object.entries(dimensionAverages)) {
      if (score < threshold) {
        weakAreas.push({
          dimension,
          label: dimensionLabels[dimension] || dimension,
          score,
          gap: threshold - score
        });
      }
    }

    return weakAreas.sort((a, b) => a.score - b.score);
  }
}

module.exports = new ScoringService();
