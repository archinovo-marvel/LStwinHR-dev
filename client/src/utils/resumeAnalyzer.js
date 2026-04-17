/**
 * 简历分析结果展示工具
 * 职责：格式化后端返回的分析结果，提供展示辅助功能
 * 注意：所有核心分析逻辑已移至后端服务模块
 */
class ResumeAnalyzerHelper {
  constructor() {
    this.parseStatusMap = {
      'SUCCESS': { label: '解析成功', color: 'success', icon: 'check-circle' },
      'PARSE_FAILED': { label: '解析失败', color: 'error', icon: 'error' },
      'OCR_LOW_CONFIDENCE': { label: '识别置信度低', color: 'warning', icon: 'warning' },
      'TEXT_TOO_SHORT': { label: '文本内容过短', color: 'warning', icon: 'warning' },
      'UNSUPPORTED_FILE_TYPE': { label: '不支持的文件类型', color: 'error', icon: 'error' },
      'DEPENDENCY_MISSING': { label: '依赖缺失', color: 'error', icon: 'error' }
    };
    this.riskSeverityMap = {
      'high': { label: '高风险', color: 'error', weight: 15 },
      'medium': { label: '中风险', color: 'warning', weight: 8 },
      'low': { label: '低风险', color: 'info', weight: 3 }
    };
    this.dimensionLabels = {
      basicInfo: '基础信息完整度',
      education: '教育匹配度',
      coreSkills: '核心技能匹配度',
      experience: '经验匹配度',
      projectQuality: '项目质量',
      bonus: '岗位加分项',
      riskPenalty: '风险惩罚项'
    };
  }
  getParseStatusInfo(status) {
    return this.parseStatusMap[status] || { label: '未知状态', color: 'default', icon: 'help' };
  }
  getRiskSeverityInfo(severity) {
    return this.riskSeverityMap[severity] || { label: '未知', color: 'default', weight: 0 };
  }
  getDimensionLabel(dimensionKey) {
    return this.dimensionLabels[dimensionKey] || dimensionKey;
  }
  formatAnalysisResult(backendResult) {
    if (!backendResult) {
      return this.getEmptyResult();
    }
    return {
      parseStatus: backendResult.parseStatus || 'UNKNOWN',
      parseStatusInfo: this.getParseStatusInfo(backendResult.parseStatus),
      summary: backendResult.summary || '',
      totalScore: backendResult.totalScore || 0,
      scoreLevel: this.getScoreLevel(backendResult.totalScore),
      dimensionScores: this.formatDimensionScores(backendResult.dimensionScores),
      strengths: backendResult.strengths || [],
      risks: this.formatRisks(backendResult.risks),
      suggestions: backendResult.suggestions || [],
      extractedContent: backendResult.extractedContent || {},
      evidences: backendResult.evidences || [],
      matchResult: backendResult.matchResult || {},
      metadata: backendResult.metadata || {}
    };
  }
  getScoreLevel(score) {
    if (score >= 85) return { level: '优秀', color: 'success', description: '高度匹配，强烈推荐' };
    if (score >= 70) return { level: '良好', color: 'primary', description: '较为匹配，建议面试' };
    if (score >= 55) return { level: '一般', color: 'warning', description: '基本匹配，可考虑面试' };
    if (score >= 40) return { level: '较差', color: 'warning', description: '匹配度较低，需进一步评估' };
    return { level: '不匹配', color: 'error', description: '不推荐面试' };
  }
  formatDimensionScores(dimensionScores) {
    if (!dimensionScores) return [];
    const formatted = [];
    Object.entries(dimensionScores).forEach(([key, value]) => {
      formatted.push({
        key: key,
        label: this.getDimensionLabel(key),
        score: typeof value === 'object' ? (value.score || 0) : value,
        maxScore: typeof value === 'object' ? (value.maxScore || 100) : 100,
        weight: typeof value === 'object' ? (value.weight || 1) : 1,
        details: typeof value === 'object' ? (value.details || []) : []
      });
    });
    return formatted;
  }
  formatRisks(risks) {
    if (!risks || !Array.isArray(risks)) return [];
    return risks.map(risk => ({
      type: risk.type || 'UNKNOWN',
      description: risk.description || '',
      severity: risk.severity || 'low',
      severityInfo: this.getRiskSeverityInfo(risk.severity),
      evidence: risk.evidence || '',
      suggestion: risk.suggestion || ''
    }));
  }
  getEmptyResult() {
    return {
      parseStatus: 'EMPTY',
      parseStatusInfo: this.getParseStatusInfo('PARSE_FAILED'),
      summary: '暂无分析结果',
      totalScore: 0,
      scoreLevel: this.getScoreLevel(0),
      dimensionScores: [],
      strengths: [],
      risks: [],
      suggestions: ['请上传简历文件进行分析'],
      extractedContent: {},
      evidences: [],
      matchResult: {},
      metadata: {}
    };
  }
  formatExtractedContent(extractedContent) {
    if (!extractedContent) return {};
    return {
      personalInfo: {
        name: extractedContent.personalInfo?.name || '',
        phone: extractedContent.personalInfo?.phone || '',
        email: extractedContent.personalInfo?.email || '',
        hasAllBasicInfo: !!(extractedContent.personalInfo?.name && 
                           extractedContent.personalInfo?.phone && 
                           extractedContent.personalInfo?.email)
      },
      education: this.formatEducationList(extractedContent.education || []),
      workExperience: this.formatExperienceList(extractedContent.workExperience || []),
      projects: this.formatProjectList(extractedContent.projects || []),
      skills: extractedContent.skills || [],
      achievements: extractedContent.achievements || []
    };
  }
  formatEducationList(educationList) {
    if (!Array.isArray(educationList)) return [];
    return educationList.map(edu => {
      if (typeof edu === 'string') {
        return { raw: edu, school: '', major: '', degree: '' };
      }
      return {
        raw: edu.raw || '',
        school: edu.school || '',
        major: edu.major || '',
        degree: edu.degree || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || ''
      };
    });
  }
  formatExperienceList(experienceList) {
    if (!Array.isArray(experienceList)) return [];
    return experienceList.map(exp => {
      if (typeof exp === 'string') {
        return { raw: exp, company: '', position: '', description: '' };
      }
      return {
        raw: exp.raw || '',
        company: exp.company || '',
        position: exp.position || '',
        description: exp.description || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || ''
      };
    });
  }
  formatProjectList(projectList) {
    if (!Array.isArray(projectList)) return [];
    return projectList.map(proj => {
      if (typeof proj === 'string') {
        return { raw: proj, name: '', role: '', description: '' };
      }
      return {
        raw: proj.raw || '',
        name: proj.name || '',
        role: proj.role || '',
        description: proj.description || '',
        technologies: proj.technologies || []
      };
    });
  }
  generateSummaryText(result) {
    const parts = [];
    if (result.totalScore > 0) {
      parts.push(`综合评分 ${result.totalScore} 分，${result.scoreLevel.description}`);
    }
    if (result.strengths.length > 0) {
      parts.push(`优势：${result.strengths.slice(0, 2).join('、')}`);
    }
    if (result.risks.length > 0) {
      const highRisks = result.risks.filter(r => r.severity === 'high');
      if (highRisks.length > 0) {
        parts.push(`风险：${highRisks.map(r => r.description).join('、')}`);
      }
    }
    return parts.join('。');
  }
  calculateMatchPercentage(result) {
    if (!result || result.totalScore === undefined) return 0;
    return Math.min(100, Math.max(0, result.totalScore));
  }
  getRecommendationAction(result) {
    if (result.totalScore >= 70) {
      return { action: 'recommend_interview', label: '推荐面试', priority: 'high' };
    } else if (result.totalScore >= 55) {
      return { action: 'consider_interview', label: '可考虑面试', priority: 'medium' };
    } else if (result.totalScore >= 40) {
      return { action: 'further_evaluation', label: '需进一步评估', priority: 'low' };
    } else {
      return { action: 'not_recommended', label: '不推荐面试', priority: 'none' };
    }
  }
  exportAnalysisReport(result, format = 'text') {
    const formatted = this.formatAnalysisResult(result);
    if (format === 'json') {
      return JSON.stringify(formatted, null, 2);
    }
    const lines = [];
    lines.push('=== 简历分析报告 ===');
    lines.push(`解析状态：${formatted.parseStatusInfo.label}`);
    lines.push(`综合评分：${formatted.totalScore} 分 (${formatted.scoreLevel.level})`);
    lines.push('');
    if (formatted.strengths.length > 0) {
      lines.push('【优势】');
      formatted.strengths.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      lines.push('');
    }
    if (formatted.risks.length > 0) {
      lines.push('【风险】');
      formatted.risks.forEach((r, i) => lines.push(`  ${i + 1}. [${r.severityInfo.label}] ${r.description}`));
      lines.push('');
    }
    if (formatted.suggestions.length > 0) {
      lines.push('【建议】');
      formatted.suggestions.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
    }
    return lines.join('\n');
  }
}
const resumeAnalyzerHelper = new ResumeAnalyzerHelper();
export default resumeAnalyzerHelper;
export { ResumeAnalyzerHelper };
