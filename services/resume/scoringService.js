/**
 * 评分服务
 * 负责简历综合评分计算，采用100分制多维度评分
 *
 * 前端细则评分范围（SCORE_LIMITS）：
 * - educationScore: 0-20分
 * - workScore: 0-20分
 * - projectScore: 0-30分
 * - skillScore: 0-25分
 * - expressionScore: 0-5分
 * - riskPenalty: 0-20分
 * - resumeScore: 0-100分
 */
const { getPositionConfig } = require('./positionConfig');

// 与前端 CandidateDetailModal 和 resumeAnalysisService 保持一致的分数限制
const SCORE_LIMITS = {
  educationScore: 20,
  workScore: 20,
  projectScore: 30,
  skillScore: 25,
  expressionScore: 5,
  riskPenalty: 20,
  resumeScore: 100
};

class ScoringService {
  calculateTotalScore(analysisData, position) {
    const config = getPositionConfig(position);
    const weights = config.weights;
    const dimensionScores = {
      basicInfo: this.scoreBasicInfo(analysisData.extractedContent),
      education: this.scoreEducation(analysisData.educationMatch, config),
      coreSkills: this.scoreCoreSkills(analysisData.skillMatch, config),
      experience: this.scoreExperience(analysisData.experienceMatch, analysisData.extractedContent),
      projectQuality: this.scoreProjectQuality(analysisData.extractedContent),
      bonus: this.scoreBonus(analysisData, position),
      penalty: 0
    };
    dimensionScores.penalty = this.calculatePenalty(analysisData, dimensionScores);
    const totalScore = this.calculateWeightedScore(dimensionScores, weights);

    // 构建前端期望的 scoreSummary（细则评分，满分100分解构）
    const scoreSummary = this.buildScoreSummary(dimensionScores, analysisData);

    return {
      totalScore: Math.min(100, Math.max(0, totalScore)),
      dimensionScores,
      grade: this.getGrade(totalScore),
      recommendation: this.getRecommendation(totalScore, dimensionScores),
      scoreSummary
    };
  }

  /**
   * 构建 scoreSummary 对象，分数范围与前端期望一致
   * @param {Object} dimensionScores - 各维度评分（0-100范围）
   * @param {Object} analysisData - 分析数据
   * @returns {Object} scoreSummary
   */
  buildScoreSummary(dimensionScores, analysisData) {
    // 将 dimensionScores (0-100) 转换为细则评分范围
    const educationScore = Math.round((dimensionScores.education.score / 100) * SCORE_LIMITS.educationScore);
    const workScore = Math.round((dimensionScores.experience.score / 100) * SCORE_LIMITS.workScore);
    const projectScore = Math.round((dimensionScores.projectQuality.score / 100) * SCORE_LIMITS.projectScore);
    const skillScore = Math.round((dimensionScores.coreSkills.score / 100) * SCORE_LIMITS.skillScore);

    // 表达完整性评分：基于基本信息完整度和项目描述质量
    const expressionScore = this.calculateExpressionScore(analysisData, dimensionScores);

    // 风险扣分：直接使用 penalty，但限制在最大范围内
    const riskPenalty = Math.min(dimensionScores.penalty, SCORE_LIMITS.riskPenalty);

    // 简历总分：各细则评分之和
    const resumeScore = Math.min(SCORE_LIMITS.resumeScore,
      educationScore + workScore + projectScore + skillScore + expressionScore
    );

    return {
      educationScore,
      workScore,
      projectScore,
      skillScore,
      expressionScore,
      riskPenalty,
      resumeScore
    };
  }

  /**
   * 计算表达完整性评分（0-5分）
   * 基于简历结构完整性和内容清晰度
   */
  calculateExpressionScore(analysisData, dimensionScores) {
    let score = 0;

    // 基本信息完整度贡献（最多2分）
    if (dimensionScores.basicInfo.score >= 75) {
      score += 2;
    } else if (dimensionScores.basicInfo.score >= 50) {
      score += 1;
    }

    // 有教育经历描述（最多1分）
    if (analysisData.extractedContent?.education?.length > 0) {
      score += 1;
    }

    // 有工作或项目经历描述（最多1分）
    const hasExperience = (analysisData.extractedContent?.workExperience?.length > 0) ||
                          (analysisData.extractedContent?.projects?.length > 0);
    if (hasExperience) {
      score += 1;
    }

    // 项目描述详实（最多1分）
    if (dimensionScores.projectQuality.score >= 50) {
      score += 1;
    }

    return Math.min(score, SCORE_LIMITS.expressionScore);
  }
  scoreBasicInfo(extractedContent) {
    if (!extractedContent || !extractedContent.personalInfo) {
      return { score: 0, details: '缺少基本信息' };
    }
    const info = extractedContent.personalInfo;
    let score = 0;
    const details = [];
    if (info.name) {
      score += 25;
      details.push('姓名完整');
    }
    if (info.phone) {
      score += 25;
      details.push('电话完整');
    }
    if (info.email) {
      score += 25;
      details.push('邮箱完整');
    }
    if (info.location || info.age || info.gender) {
      score += 25;
      details.push('其他信息完整');
    }
    return {
      score,
      maxScore: 100,
      details: details.join('、') || '基本信息不完整'
    };
  }
  scoreEducation(educationMatch, config) {
    if (!educationMatch) {
      return { score: 0, details: '未检测到教育背景' };
    }
    let score = 0;
    const details = [];
    if (educationMatch.isMatch) {
      score += 70;
      details.push('专业匹配');
      if (educationMatch.matchedMajors && educationMatch.matchedMajors.length > 0) {
        details.push(`匹配专业: ${educationMatch.matchedMajors.map(m => m.major).join(', ')}`);
      }
    } else {
      score += 30;
      details.push('专业不完全匹配');
    }
    if (educationMatch.hasConflict) {
      score -= 30;
      details.push('⚠️ 专业与岗位存在冲突');
    }
    if (educationMatch.educationInfo && educationMatch.educationInfo.length > 0) {
      const hasHighDegree = educationMatch.educationInfo.some(e => 
        ['硕士', '博士'].includes(e.degree)
      );
      if (hasHighDegree) {
        score += 20;
        details.push('高学历加分');
      }
    }
    return {
      score: Math.max(0, score),
      maxScore: 100,
      details: details.join('、')
    };
  }
  scoreCoreSkills(skillMatch, config) {
    if (!skillMatch) {
      return { score: 0, details: '未检测到技能匹配' };
    }
    const coreCount = skillMatch.coreSkills ? skillMatch.coreSkills.length : 0;
    const businessCount = skillMatch.businessSkills ? skillMatch.businessSkills.length : 0;
    const totalRequired = config.coreSkills.length + config.businessSkills.length;
    const matchRatio = (coreCount + businessCount) / totalRequired;
    let score = Math.round(matchRatio * 80);
    const details = [];
    if (coreCount > 0) {
      details.push(`核心技能匹配${coreCount}项`);
      score += 10;
    }
    if (businessCount > 0) {
      details.push(`商业技能匹配${businessCount}项`);
      score += 10;
    }
    if (matchRatio >= 0.5) {
      score += 10;
      details.push('技能覆盖率高');
    }
    return {
      score: Math.min(100, score),
      maxScore: 100,
      details: details.join('、') || '技能匹配度低'
    };
  }
  scoreExperience(experienceMatch, extractedContent) {
    if (!experienceMatch && !extractedContent) {
      return { score: 0, details: '未检测到工作经历' };
    }
    let score = 0;
    const details = [];
    const workCount = extractedContent.workExperience ? extractedContent.workExperience.length : 0;
    const projectCount = extractedContent.projects ? extractedContent.projects.length : 0;
    if (experienceMatch && experienceMatch.isMatch) {
      score += 40;
      details.push('经历与岗位相关');
    }
    if (workCount > 0) {
      const workScore = Math.min(30, workCount * 10);
      score += workScore;
      details.push(`${workCount}段工作经历`);
    }
    if (projectCount > 0) {
      const projectScore = Math.min(30, projectCount * 8);
      score += projectScore;
      details.push(`${projectCount}个项目经历`);
    }
    return {
      score: Math.min(100, score),
      maxScore: 100,
      details: details.join('、') || '工作经历不足'
    };
  }
  scoreProjectQuality(extractedContent) {
    if (!extractedContent || !extractedContent.projects) {
      return { score: 0, details: '未检测到项目经历' };
    }
    const projects = extractedContent.projects;
    let score = 0;
    const details = [];
    projects.forEach(project => {
      const descLength = project.description ? project.description.join('').length : 0;
      if (descLength > 100) {
        score += 25;
        details.push(`项目"${project.name || '未命名'}"描述详实`);
      } else if (descLength > 50) {
        score += 15;
        details.push(`项目"${project.name || '未命名'}"描述适中`);
      } else {
        score += 5;
        details.push(`项目"${project.name || '未命名'}"描述简单`);
      }
    });
    return {
      score: Math.min(100, score),
      maxScore: 100,
      details: details.slice(0, 5).join('、') || '项目描述不够详实'
    };
  }
  scoreBonus(analysisData, position) {
    let score = 0;
    const details = [];
    if (analysisData.skillMatch && analysisData.skillMatch.abilityKeywords) {
      const abilityCount = analysisData.skillMatch.abilityKeywords.length;
      if (abilityCount >= 3) {
        score += 10;
        details.push('能力关键词丰富');
      }
    }
    if (analysisData.extractedContent && analysisData.extractedContent.achievements) {
      const achievementCount = analysisData.extractedContent.achievements.length;
      if (achievementCount > 0) {
        score += achievementCount * 5;
        details.push(`${achievementCount}项荣誉成就`);
      }
    }
    if (analysisData.skillEvidence) {
      const highQualityCount = analysisData.skillEvidence.filter(e => e.evidenceQuality === 'high').length;
      if (highQualityCount > 0) {
        score += highQualityCount * 5;
        details.push(`${highQualityCount}项技能有充分证据支撑`);
      }
    }
    return {
      score: Math.min(30, score),
      maxScore: 30,
      details: details.join('、') || '无额外加分项'
    };
  }
  calculatePenalty(analysisData, dimensionScores) {
    let penalty = 0;
    if (dimensionScores.basicInfo.score < 50) {
      penalty += 10;
    }
    if (analysisData.educationMatch && analysisData.educationMatch.hasConflict) {
      penalty += 15;
    }
    if (analysisData.risks && analysisData.risks.length > 0) {
      analysisData.risks.forEach(risk => {
        if (risk.severity === 'high') {
          penalty += 10;
        } else if (risk.severity === 'medium') {
          penalty += 5;
        }
      });
    }
    return penalty;
  }
  calculateWeightedScore(dimensionScores, weights) {
    const basicInfoScore = (dimensionScores.basicInfo.score / 100) * 10;
    const educationScore = (dimensionScores.education.score / 100) * (weights.educationMatch * 100);
    const skillScore = (dimensionScores.coreSkills.score / 100) * (weights.skillMatch * 100);
    const experienceScore = (dimensionScores.experience.score / 100) * (weights.experienceMatch * 100);
    const projectScore = (dimensionScores.projectQuality.score / 100) * (weights.projectMatch * 100);
    const bonusScore = dimensionScores.bonus.score;
    const penalty = dimensionScores.penalty;
    return Math.round(
      basicInfoScore + 
      educationScore + 
      skillScore + 
      experienceScore + 
      projectScore + 
      bonusScore - 
      penalty
    );
  }
  getGrade(score) {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'E';
  }
  getRecommendation(score, dimensionScores) {
    if (score >= 85) {
      return {
        level: '强烈推荐',
        reason: '简历与岗位高度匹配，建议优先面试',
        color: 'success'
      };
    } else if (score >= 70) {
      return {
        level: '推荐',
        reason: '简历与岗位较为匹配，建议安排面试',
        color: 'primary'
      };
    } else if (score >= 55) {
      return {
        level: '待考虑',
        reason: '简历基本匹配，可考虑面试或进一步评估',
        color: 'warning'
      };
    } else if (score >= 40) {
      return {
        level: '不推荐',
        reason: '简历匹配度较低，建议谨慎考虑',
        color: 'danger'
      };
    } else {
      return {
        level: '不建议',
        reason: '简历与岗位要求差距较大',
        color: 'danger'
      };
    }
  }
}
module.exports = new ScoringService();
