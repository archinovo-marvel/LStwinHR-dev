const scoringService = require('./scoringService');
const compositeScoreService = require('./compositeScoreService');
const { getPositionConfig } = require('./positionConfig');
const { ANALYSIS_FALLBACKS } = require('./analysisConfig');

class ReportService {
  buildResumeAnalysisResult({ analysis, position, positionConfig, mbtiScore, interviewScore }) {
    const normalizedAnalysis = this.ensureScoreSnapshot(analysis, position, positionConfig);
    const extractedContent = normalizedAnalysis.extractedContent || {};
    const resolvedPositionConfig = getPositionConfig(position, positionConfig);
    const aiInterviewSuggestions = this.normalizeInterviewSuggestions(
      normalizedAnalysis.smartInsights?.interviewSuggestions || normalizedAnalysis.interviewSuggestions
    );

    const education = this.normalizeEducation(extractedContent.education || []);
    const workExperience = this.normalizeWorkExperience(extractedContent.workExperience || []);
    const projectExperience = this.normalizeProjectExperience(extractedContent.projectExperience || []);
    const campusExperience = this.normalizeCampusExperience(extractedContent.campusExperience || []);
    const skills = this.normalizeSkills(normalizedAnalysis, resolvedPositionConfig);
    const risks = this.normalizeRisks(normalizedAnalysis.risks || []);
    const scores = this.normalizeScores(normalizedAnalysis, mbtiScore, interviewScore);
    const summary = this.buildSummary({
      scores,
      skills,
      education,
      workExperience,
      projectExperience,
      campusExperience,
      risks,
      aiInterviewSuggestions
    });

    return {
      summary,
      education,
      workExperience,
      projectExperience,
      campusExperience,
      skills,
      risks,
      scores,
      status: this.buildStatus(normalizedAnalysis, education, workExperience, projectExperience, campusExperience, skills),
      metadata: {
        analyzedAt: normalizedAnalysis.metadata?.analyzedAt || new Date().toISOString(),
        parseStatus: normalizedAnalysis.parseStatus || 'UNKNOWN',
        position: position || '',
        hasContent: this.hasValidContent({ education, workExperience, projectExperience, campusExperience, skills, normalizedAnalysis })
      }
    };
  }

  ensureScoreSnapshot(analysis, position, positionConfig) {
    const safeAnalysis = analysis || {};

    if (!safeAnalysis.extractedContent) {
      return {
        ...safeAnalysis,
        extractedContent: {
          basicInfo: { name: '', phone: '', email: '', jobIntention: '' },
          personalInfo: { name: '', phone: '', email: '' },
          education: [],
          workExperience: [],
          projectExperience: [],
          skills: [],
          campusExperience: [],
          evaluation: ''
        },
        risks: Array.isArray(safeAnalysis.risks) ? safeAnalysis.risks : [],
        scores: {
          educationScore: 0,
          workScore: 0,
          projectScore: 0,
          skillScore: 0,
          expressionScore: 0,
          riskPenalty: 0,
          resumeScore: 0
        },
        scoreModel: []
      };
    }

    // 如果 analysis.scores 已经有完整的细则评分（来自VL模型），直接使用
    // 不再调用 scoringService 重新计算，避免因字段名不匹配导致分数丢失
    const existingScores = safeAnalysis.scores || {};
    const hasValidScores = existingScores.resumeScore > 0 ||
      (existingScores.educationScore > 0 || existingScores.workScore > 0 ||
       existingScores.projectScore > 0 || existingScores.skillScore > 0);

    if (hasValidScores) {
      // 确保 resumeScore 是细则评分之和
      const resumeScore = existingScores.resumeScore ||
        (Number(existingScores.educationScore) || 0) +
        (Number(existingScores.workScore) || 0) +
        (Number(existingScores.projectScore) || 0) +
        (Number(existingScores.skillScore) || 0) +
        (Number(existingScores.expressionScore) || 0);

      return {
        ...safeAnalysis,
        totalScore: safeAnalysis.totalScore || resumeScore,
        scores: {
          ...existingScores,
          resumeScore
        }
      };
    }

    // 只有在没有有效分数时才调用 scoringService
    const scoreResult = scoringService.calculateTotalScore({
      extractedContent: safeAnalysis.extractedContent,
      skillMatch: safeAnalysis.matchResult || safeAnalysis.skillMatch,
      skillEvidence: safeAnalysis.skillEvidence || [],
      educationMatch: safeAnalysis.educationMatch,
      experienceMatch: safeAnalysis.experienceMatch,
      risks: safeAnalysis.risks || []
    }, position, { positionConfig });

    return {
      ...safeAnalysis,
      totalScore: scoreResult.totalScore,
      grade: scoreResult.grade,
      recommendation: scoreResult.recommendation,
      dimensionScores: scoreResult.dimensionScores,
      scoreModel: scoreResult.scoreModel,
      scores: scoreResult.scoreSummary
    };
  }

  hasValidContent({ education, workExperience, projectExperience, campusExperience, skills, normalizedAnalysis }) {
    return (
      education.length > 0 ||
      workExperience.length > 0 ||
      projectExperience.length > 0 ||
      campusExperience.length > 0 ||
      skills.matchedSkills.length > 0 ||
      skills.bonusSkills.length > 0 ||
      Boolean(normalizedAnalysis.extractedContent?.evaluation)
    );
  }

  normalizeEducation(educationList) {
    return [...educationList]
      .map(item => {
        const { startDate, endDate } = this.parseTimeRange(item.timeRange || '');
        const extra = [item.englishLevel, item.coreCourses, item.awards].filter(Boolean);
        const degree = item.degree || '';
        const degreeSource = item.degreeSource || (degree ? 'explicit' : 'unknown');
        const degreeLabel = degree
          ? (degreeSource === 'inferred' ? `${degree}（推断）` : degree)
          : '未明确标注';

        return {
          school: item.school || ANALYSIS_FALLBACKS.notSpecified,
          major: item.major || ANALYSIS_FALLBACKS.notSpecified,
          degree: degree || '未明确标注',
          degreeSource,
          degreeLabel,
          startDate,
          endDate,
          gpa: item.gpa || ANALYSIS_FALLBACKS.notSpecified,
          extra: extra.length > 0 ? extra : [ANALYSIS_FALLBACKS.notMentioned]
        };
      })
      .sort((a, b) => this.extractSortableDate(b.startDate || b.endDate) - this.extractSortableDate(a.startDate || a.endDate));
  }

  normalizeWorkExperience(workList) {
    return workList.map(item => {
      const { startDate, endDate } = this.parseTimeRange(item.timeRange || '');
      const responsibilities = this.toArray(item.responsibilities || item.description);

      return {
        company: item.companyOrOrg || item.company || ANALYSIS_FALLBACKS.notSpecified,
        position: item.role || item.position || ANALYSIS_FALLBACKS.notSpecified,
        startDate,
        endDate,
        responsibilities: responsibilities.length > 0 ? responsibilities : [ANALYSIS_FALLBACKS.notMentioned],
        relevance: item.relevance || (responsibilities.length > 0 ? '可在复筛中进一步核实岗位相关度' : '相关性待补充')
      };
    });
  }

  normalizeProjectExperience(projectList) {
    const projectItems = (projectList || []).map(item => ({
      projectName: item.projectName || item.name || ANALYSIS_FALLBACKS.notSpecified,
      role: item.role || ANALYSIS_FALLBACKS.notSpecified,
      timeRange: item.timeRange || '',
      description: item.description,
      relevance: item.relevance || '',
      contribution: item.responsibilities || item.description || ''
    }));

    return projectItems.map(item => {
      const { startDate, endDate } = this.parseTimeRange(item.timeRange || '');
      const description = this.toArray(item.description);
      const contribution = this.toArray(item.contribution);

      return {
        projectName: item.projectName || ANALYSIS_FALLBACKS.notSpecified,
        role: item.role || ANALYSIS_FALLBACKS.notSpecified,
        startDate,
        endDate,
        description: description.length > 0 ? description : [ANALYSIS_FALLBACKS.notMentioned],
        contribution: contribution.length > 0 ? contribution : [ANALYSIS_FALLBACKS.notMentioned],
        relevance: item.relevance || '建议结合岗位追问具体场景'
      };
    });
  }

  normalizeCampusExperience(campusList) {
    return (campusList || []).map(item => {
      const { startDate, endDate } = this.parseTimeRange(item.timeRange || '');
      const description = this.toArray(item.description);
      const achievements = this.toArray(item.achievements);

      return {
        organization: item.organization || ANALYSIS_FALLBACKS.notSpecified,
        role: item.role || ANALYSIS_FALLBACKS.notSpecified,
        startDate,
        endDate,
        description: description.length > 0 ? description : [ANALYSIS_FALLBACKS.notMentioned],
        achievements: achievements.length > 0 ? achievements : []
      };
    });
  }

  normalizeSkills(analysis, positionConfig) {
    const extractedSkills = Array.isArray(analysis.extractedContent?.skills)
      ? analysis.extractedContent.skills.map(item => item.name || item.skill || item).filter(Boolean)
      : [];
    const matchedSkills = [
      ...(analysis.matchResult?.coreSkills || []).map(item => item.skill || item),
      ...(analysis.matchResult?.businessSkills || []).map(item => item.skill || item)
    ];
    const uniqueMatchedSkills = [...new Set(matchedSkills)];
    const coreSkills = Array.isArray(positionConfig?.coreSkills) ? positionConfig.coreSkills : [];
    const missingSkills = coreSkills.filter(skill => !uniqueMatchedSkills.includes(skill));
    const bonusSkills = extractedSkills.filter(skill => {
      return !coreSkills.includes(skill) &&
        !(Array.isArray(positionConfig?.businessSkills) && positionConfig.businessSkills.includes(skill));
    });

    const positionTags = [];
    if (uniqueMatchedSkills.length >= Math.max(3, Math.ceil(coreSkills.length * 0.5))) {
      positionTags.push('核心技能覆盖较好');
    }
    if (bonusSkills.length > 0) {
      positionTags.push('存在可迁移加分项');
    }
    if ((analysis.extractedContent?.workExperience || []).length === 0) {
      positionTags.push('偏校招/潜力型履历');
    }

    return {
      coreSkills,
      matchedSkills: uniqueMatchedSkills,
      missingSkills,
      bonusSkills: [...new Set(bonusSkills)].slice(0, 8),
      positionTags
    };
  }

  normalizeRisks(risks) {
    // 定义要过滤掉的风险关键词（时间相关、存疑相关）
    const filteredRiskKeywords = [
      '时间', '时长', '日期', '周期', '时长存疑', '时间逻辑',
      '存疑', '逻辑存疑', '实习时间', '工作时间', '经历时间',
      '时间线', '时间跨度', '断档', '空窗期', '时间冲突'
    ];

    // 先转换为标准格式
    const allItems = risks.map(item => ({
      title: item.title || item.message || '待核实风险项',
      description: item.description || item.suggestion || ANALYSIS_FALLBACKS.notMentioned,
      severity: item.severity || 'low',
      suggestion: item.suggestion || ''
    }))
    // 过滤掉时间相关和存疑相关的风险项
    .filter(item => {
      const titleLower = item.title.toLowerCase();
      const descLower = item.description.toLowerCase();

      const shouldFilter = filteredRiskKeywords.some(keyword =>
        titleLower.includes(keyword) || descLower.includes(keyword)
      );

      return !shouldFilter;
    });

    // 去重：基于title去重，保留第一个出现的风险项
    const seenTitles = new Set();
    const items = allItems.filter(item => {
      const normalizedTitle = item.title.trim().toLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);
      return true;
    });

    const highCount = items.filter(item => item.severity === 'high').length;
    const mediumCount = items.filter(item => item.severity === 'medium').length;

    return {
      level: highCount > 0 ? 'high' : mediumCount > 1 ? 'medium' : items.length > 0 ? 'medium' : 'low',
      items
    };
  }

  normalizeScores(analysis, mbtiScore, interviewScore) {
    const analysisScores = analysis.scores || {};
    const calculatedResumeScore = [
      analysisScores.educationScore || 0,
      analysisScores.workScore || 0,
      analysisScores.projectScore || 0,
      analysisScores.skillScore || 0,
      analysisScores.expressionScore || 0
    ].reduce((sum, value) => sum + Number(value || 0), 0);
    const normalizedMbtiScore = compositeScoreService.normalizeScore(mbtiScore) ?? 0;
    const normalizedInterviewScore = compositeScoreService.normalizeScore(interviewScore) ?? 0;
    const hasInterview = interviewScore !== null && interviewScore !== undefined && interviewScore !== '';
    const finalScoreResult = compositeScoreService.calculateFinalScore({
      resumeScore: calculatedResumeScore,
      mbtiScore: normalizedMbtiScore,
      interviewScore: normalizedInterviewScore
    });

    return {
      educationScore: analysisScores.educationScore || 0,
      workScore: analysisScores.workScore || 0,
      projectScore: analysisScores.projectScore || 0,
      skillScore: analysisScores.skillScore || 0,
      expressionScore: analysisScores.expressionScore || 0,
      riskPenalty: analysisScores.riskPenalty || 0,
      resumeScore: calculatedResumeScore,
      mbtiScore: normalizedMbtiScore,
      interviewScore: normalizedInterviewScore,
      hasInterview,
      finalScore: finalScoreResult.finalScore,
      normalizedWeights: finalScoreResult.normalizedWeights,
      missingFields: finalScoreResult.missingFields,
      hasPartialData: finalScoreResult.hasPartialData,
      note: finalScoreResult.note
    };
  }

  buildSummary({ scores, skills, education, workExperience, projectExperience, campusExperience, risks, aiInterviewSuggestions }) {
    const matchLevel = this.getMatchLevel(scores.finalScore, risks.level);
    const recommendation = this.getRecommendationLabel(scores.resumeScore);
    const reasons = this.buildReasons(scores, skills, education, workExperience, projectExperience, campusExperience);
    const interviewSuggestions = aiInterviewSuggestions.length > 0
      ? aiInterviewSuggestions
      : this.buildInterviewSuggestions({
          scores,
          skills,
          education,
          workExperience,
          projectExperience,
          campusExperience,
          risks
        });

    return {
      matchLevel,
      recommendation,
      reasons,
      interviewSuggestions
    };
  }

  normalizeInterviewSuggestions(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return [...new Set(
      items
        .map(item => this.ensureQuestionStyle(String(item || '').replace(/\s+/g, ' ').trim()))
        .filter(Boolean)
    )].slice(0, 5);
  }

  ensureQuestionStyle(text) {
    const normalized = String(text || '').trim().replace(/[。；;!！]+$/g, '');
    if (!normalized) {
      return '';
    }

    if (/[？?]$/.test(normalized)) {
      return normalized;
    }

    if (/^(请|你|能否|是否|为什么|如何|围绕|介绍一下|你的|如果)/.test(normalized)) {
      return `${normalized}？`;
    }

    return `请具体说说${normalized.replace(/^[：:]/, '')}？`;
  }

  buildStatus(analysis, education, workExperience, projectExperience, campusExperience, skills) {
    if (analysis.parseStatus && analysis.parseStatus !== 'SUCCESS') {
      return {
        state: 'error',
        title: '简历解析存在异常',
        message: analysis.error || ANALYSIS_FALLBACKS.emptyResume
      };
    }

    const hasContent = this.hasValidContent({ education, workExperience, projectExperience, campusExperience, skills, normalizedAnalysis: analysis });
    if (!hasContent) {
      return {
        state: 'empty',
        title: '暂无有效简历内容',
        message: ANALYSIS_FALLBACKS.emptyResume
      };
    }

    return {
      state: 'ready',
      title: '简历分析完成',
      message: '已生成结构化解析、岗位匹配与综合评分'
    };
  }

  getMatchLevel(finalScore, riskLevel) {
    if (finalScore >= 82 && riskLevel === 'low') return 'high';
    if (finalScore >= 65) return 'medium';
    if (finalScore >= 50) return 'low';
    return 'reject';
  }

  getRecommendationLabel(resumeScore) {
    if (resumeScore >= 75) return '强烈推荐';
    if (resumeScore >= 60) return '推荐';
    if (resumeScore >= 45) return '待考虑';
    return '建议淘汰';
  }

  buildReasons(scores, skills, education, workExperience, projectExperience, campusExperience) {
    const reasons = [];

    reasons.push(`简历评分为${scores.resumeScore}分，${scores.resumeScore >= 75 ? '履历贴合度较高' : scores.resumeScore >= 60 ? '具备一定岗位匹配度' : scores.resumeScore >= 45 ? '仍需面试重点核实' : '当前履历竞争力偏弱'}。`);

    const projectSourceText = projectExperience.length > 0
      ? `识别到${projectExperience.length}段项目/活动经历`
      : (campusExperience.length > 0 ? '暂无正式项目经历，当前更多依赖校园经历补充背景信息' : '项目经历信息较少');

    if (education.length > 0) {
      reasons.push(`${projectSourceText}，教育背景中已识别出${education[0].school || ANALYSIS_FALLBACKS.notSpecified}等关键信息。`);
    } else {
      reasons.push(`${projectSourceText}，但教育信息仍有待补充。`);
    }

    if (skills.matchedSkills.length > 0) {
      reasons.push(`已命中${skills.matchedSkills.length}项岗位相关技能，建议在面试中继续核实真实应用深度。`);
    }

    return reasons.slice(0, 3);
  }

  buildInterviewSuggestions({ scores, skills, education, workExperience, projectExperience, campusExperience, risks }) {
    const suggestions = [];

    if (workExperience.length === 0 && projectExperience.length === 0 && campusExperience.length === 0) {
      suggestions.push('请补充介绍 1 到 2 段最能证明你能力的实习、项目、兼职或作品经历');
    }

    if (workExperience.length === 0 && projectExperience.length === 0 && campusExperience.length > 0) {
      suggestions.push('请具体介绍一段最有代表性的校园经历，你负责了什么、和谁协作、最终产出了什么结果');
    }

    if (education.length === 0 || education.every(item => !item.major || item.major === ANALYSIS_FALLBACKS.notSpecified)) {
      suggestions.push('你的专业方向、核心课程和自学内容分别是什么，哪些内容最能支撑当前岗位');
    }

    if (skills.missingSkills.length > 0) {
      suggestions.push(`请说说${skills.missingSkills.slice(0, 3).join('、')}这些关键技能你分别在什么场景下用过，能举一个实际案例吗`);
    }

    if (skills.matchedSkills.length > 0) {
      suggestions.push(`请说说简历里提到的${skills.matchedSkills.slice(0, 3).join('、')}，你实际在哪个项目或任务中使用过，具体负责了哪一部分`);
    }

    if (scores.expressionScore <= 3) {
      suggestions.push('请你按背景、任务、行动、结果的顺序，完整复盘一个最能代表你能力的案例');
    }

    if (scores.resumeScore < 60) {
      suggestions.push('如果让你选一段最贴近目标岗位的经历来证明自己，你会选哪一段，为什么');
    }

    return [...new Set(suggestions.map(item => this.ensureQuestionStyle(item)))].slice(0, 6);
  }

  parseTimeRange(timeRange) {
    if (!timeRange) {
      return {
        startDate: ANALYSIS_FALLBACKS.notSpecified,
        endDate: ANALYSIS_FALLBACKS.notSpecified
      };
    }

    const normalized = String(timeRange).trim();
    const rangeMatch = normalized.match(/((?:20\d{2}[年\/.\-]?\d{0,2}[月]?))\s*[-~—至]\s*((?:20\d{2}[年\/.\-]?\d{0,2}[月]?|至今|今|现在))/);
    if (rangeMatch) {
      return {
        startDate: rangeMatch[1] || ANALYSIS_FALLBACKS.notSpecified,
        endDate: rangeMatch[2] || ANALYSIS_FALLBACKS.notSpecified
      };
    }

    return {
      startDate: normalized || ANALYSIS_FALLBACKS.notSpecified,
      endDate: ANALYSIS_FALLBACKS.notSpecified
    };
  }

  extractSortableDate(value) {
    const match = String(value || '').match(/(20\d{2})/);
    return match ? Number(match[1]) : 0;
  }

  toArray(value) {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (!value) return [];

    return String(value)
      .split(/[；;。]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
}

module.exports = new ReportService();
