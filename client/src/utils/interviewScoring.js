/* eslint-disable no-console */
// 面试对话评分系统

// =============================
// 评分器超详细调试开关（代码级）
// 只需要改这两个变量即可控制是否打印。
// - enabled: 是否输出“超详细”打分明细
// - flat: 为 true 时不使用 console.group，全部平铺 console.log，便于导出日志
// =============================
const INTERVIEW_SCORING_DEBUG = {
  enabled: true,
  flat: true
};

class InterviewScoring {
  constructor() {
    // 面试评分标准 - 满分100分
    this.scoringCriteria = {
      // 回答质量评分 (40分) - 核心评分，基于每个问题的回答
      answerQuality: {
        weight: 40,
        criteria: {
          relevance: { weight: 15, description: '回答相关性' },
          depth: { weight: 10, description: '回答深度' },
          clarity: { weight: 10, description: '表达清晰度' },
          completeness: { weight: 5, description: '回答完整性' }
        }
      },
      // 沟通能力评分 (25分)
      communication: {
        weight: 25,
        criteria: {
          fluency: { weight: 10, description: '语言流畅度' },
          logic: { weight: 8, description: '逻辑性' },
          confidence: { weight: 7, description: '自信度' }
        }
      },
      // 专业能力评分 (20分)
      professionalism: {
        weight: 20,
        criteria: {
          knowledge: { weight: 10, description: '专业知识' },
          experience: { weight: 6, description: '经验展示' },
          problemSolving: { weight: 4, description: '问题解决能力' }
        }
      },
      // 态度和动机评分 (15分)
      attitude: {
        weight: 15,
        criteria: {
          enthusiasm: { weight: 6, description: '积极性' },
          motivation: { weight: 5, description: '动机明确' },
          adaptability: { weight: 4, description: '适应性' }
        }
      }
    };

    // 关键词评分规则 - 优化正向关键词权重
    this.keywordScoring = {
      positive: {
        keywords: ['经验', '学习', '成长', '挑战', '团队', '创新', '目标', '规划', '责任', '贡献', '成功', '完成', '实现'],
        score: 2
      },
      negative: {
        keywords: ['不知道', '不清楚', '没有', '不会', '失败', '放弃', '没办法'],
        score: -2
      },
      professional: {
        keywords: ['技能', '能力', '项目', '成果', '数据', '分析', '优化', '改进', '效率', '方案', '解决', '设计', '架构'],
        score: 3
      },
      leadership: {
        keywords: ['带领', '负责', '主导', '指导', '协调', '组织', '管理'],
        score: 3
      }
    };

    // 调试开关：默认关闭（优先使用文件顶部的 INTERVIEW_SCORING_DEBUG）。
    // 也可用运行时方式开启（可选）：
    // 1) 控制台执行：localStorage.setItem('interview_scoring_debug', '1') 然后刷新
    // 2) 控制台执行：window.__INTERVIEW_SCORING_DEBUG__ = true 然后刷新
    this._debugSessionCounter = 0;
  }

  // 是否开启调试
  isDebugEnabled() {
    // 代码级开关优先，便于你稳定复现并导出日志
    if (INTERVIEW_SCORING_DEBUG?.enabled === true) return true;
    try {
      if (typeof window !== 'undefined') {
        if (window.__INTERVIEW_SCORING_DEBUG__ === true) return true;
        try {
          return window.localStorage?.getItem('interview_scoring_debug') === '1';
        } catch (e) {
          return false;
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  // 是否使用“平铺输出”（不使用 console.group），保证导出的日志也包含全部明细
  isDebugFlat() {
    if (INTERVIEW_SCORING_DEBUG?.enabled !== true) {
      // 如果没通过代码级开关启用调试，则 flat 仅由代码级配置决定。
      //（避免你误开 localStorage 时影响导出格式）
      return INTERVIEW_SCORING_DEBUG?.flat === true;
    }
    return INTERVIEW_SCORING_DEBUG?.flat === true;
  }

  // 安全的 debug 打印（避免在某些环境 console.group 不存在）
  debugGroup(title) {
    if (!this.isDebugEnabled()) return;
    try {
      if (this.isDebugFlat()) {
        console.log(title);
        return;
      }
      if (console.groupCollapsed) console.groupCollapsed(title);
      else if (console.group) console.group(title);
      else console.log(title);
    } catch (e) {
      // ignore
    }
  }

  debugGroupEnd() {
    if (!this.isDebugEnabled()) return;
    try {
      if (this.isDebugFlat()) return;
      if (console.groupEnd) console.groupEnd();
    } catch (e) {
      // ignore
    }
  }

  debugLog(label, value) {
    if (!this.isDebugEnabled()) return;
    try {
      // flat 模式下把对象 stringify，确保导出日志里不会只显示“Object”
      if (this.isDebugFlat() && value !== null && typeof value === 'object') {
        let text;
        try {
          text = JSON.stringify(value);
        } catch (e) {
          try {
            // 尝试去环：退化为浅拷贝
            text = JSON.stringify(JSON.parse(JSON.stringify(value)));
          } catch (e2) {
            text = String(value);
          }
        }
        console.log(`${label} ${text}`);
        return;
      }

      console.log(label, value);
    } catch (e) {
      // ignore
    }
  }

  // 统一“加分/扣分”记录
  debugDelta(deltaLabel, deltaValue, context = {}) {
    if (!this.isDebugEnabled()) return;
    this.debugLog(`  • Δ ${deltaLabel}:`, { delta: deltaValue, ...context });
  }

  // 将任意输入规范化为字符串（避免 undefined/null 导致 split/includes 报错）
  normalizeText(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try {
      return String(value);
    } catch (e) {
      return '';
    }
  }

  // 计算面试评分（兼容旧调用方式）
  calculateScore(conversationData) {
    return this.analyzeInterviewConversation(conversationData);
  }

  // 分析面试对话记录
  analyzeInterviewConversation(conversationData) {
    // 注意：conversationData 可能来自不同页面/存储结构，务必做输入规范化。
    let safeConversation;
    try {
      safeConversation = JSON.parse(JSON.stringify(conversationData || {}));
    } catch (e) {
      safeConversation = conversationData || {};
    }
    const debugEnabled = this.isDebugEnabled();
    const debugSessionId = ++this._debugSessionCounter;
    if (debugEnabled) {
      this.debugGroup(`🧮 InterviewScoring 调试会话 #${debugSessionId}（超详细）`);
      this.debugLog('[0] 原始输入 conversationData:', safeConversation);
    }

    const questions = Array.isArray(conversationData?.questions)
      ? conversationData.questions.map(q => this.normalizeText(q))
      : [];
    const candidateAnswers = Array.isArray(conversationData?.candidateAnswers)
      ? conversationData.candidateAnswers.map(a => this.normalizeText(a))
      : [];

    if (debugEnabled) {
      this.debugGroup('[1] 输入规范化结果');
      this.debugLog('questions（规范化）:', questions);
      this.debugLog('candidateAnswers（规范化）:', candidateAnswers);
      this.debugLog('计数:', {
        questionsCount: questions.length,
        answersCount: candidateAnswers.length
      });
      this.debugGroupEnd();
    }

    const normalizedConversationData = {
      questions,
      candidateAnswers
    };
    const analysis = {
      totalScore: 0,
      categoryScores: {},
      detailedAnalysis: {},
      recommendations: [],
      conversationSummary: '',
      strengths: [],
      weaknesses: [],
      timestamp: new Date().toISOString()
    };

    if (debugEnabled) {
      this.debugGroup('[2] 评分权重与规则');
      this.debugLog('scoringCriteria:', this.scoringCriteria);
      this.debugLog('keywordScoring:', this.keywordScoring);
      this.debugGroupEnd();
    }

    // 1. 分析回答质量
    analysis.categoryScores.answerQuality = this.analyzeAnswerQuality(normalizedConversationData);
    
    // 2. 分析沟通能力
    analysis.categoryScores.communication = this.analyzeCommunication(normalizedConversationData);
    
    // 3. 分析专业能力
    analysis.categoryScores.professionalism = this.analyzeProfessionalism(normalizedConversationData);
    
    // 4. 分析态度和动机
    analysis.categoryScores.attitude = this.analyzeAttitude(normalizedConversationData);

    if (debugEnabled) {
      this.debugGroup('[3] 各维度原始得分（当前实现返回值）');
      this.debugLog('answerQuality:', analysis.categoryScores.answerQuality);
      this.debugLog('communication:', analysis.categoryScores.communication);
      this.debugLog('professionalism:', analysis.categoryScores.professionalism);
      this.debugLog('attitude:', analysis.categoryScores.attitude);
      this.debugGroupEnd();
    }

    // 5. 计算总分
    analysis.totalScore = this.calculateTotalScore(analysis.categoryScores);

    if (debugEnabled) {
      this.debugGroup('[4] 总分');
      this.debugLog('totalScore（最终）:', analysis.totalScore);
      this.debugGroupEnd();
    }

    // 6. 生成详细分析
    analysis.detailedAnalysis = this.generateDetailedAnalysis(analysis.categoryScores);

    // 7. 生成推荐建议
    analysis.recommendations = this.generateRecommendations(analysis.categoryScores);

    // 8. 生成对话摘要
    analysis.conversationSummary = this.generateConversationSummary(normalizedConversationData);

    // 9. 识别优势和劣势
    analysis.strengths = this.identifyStrengths(analysis.categoryScores);
    analysis.weaknesses = this.identifyWeaknesses(analysis.categoryScores);

    if (debugEnabled) {
      this.debugGroup('[5] 结果摘要（不影响评分，仅展示）');
      this.debugLog('detailedAnalysis:', analysis.detailedAnalysis);
      this.debugLog('recommendations:', analysis.recommendations);
      this.debugLog('strengths:', analysis.strengths);
      this.debugLog('weaknesses:', analysis.weaknesses);
      this.debugLog('conversationSummary:', analysis.conversationSummary);
      this.debugGroupEnd();

      this.debugGroupEnd(); // 结束会话根 group
    }

    return analysis;
  }

  // 分析回答质量
  analyzeAnswerQuality(conversationData) {
    let score = 0;
    const details = {};

    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('🟦 [A] 回答质量（逐题）');
      this.debugLog('候选人回答数:', (conversationData.candidateAnswers || []).length);
    }

    // 分析每个回答
    (conversationData.candidateAnswers || []).forEach((answer, index) => {
      const question = (conversationData.questions || [])[index] || '';
      const answerScore = this.evaluateSingleAnswer(answer, question);
      score += answerScore.score;
      details[`answer_${index + 1}`] = answerScore;

      if (debugEnabled) {
        this.debugGroup(`  - 第${index + 1}题（单题得分：${answerScore.score}/10）`);
        this.debugLog('question:', question);
        this.debugLog('answer:', answer);
        this.debugLog('details:', answerScore.details);
        this.debugGroupEnd();
      }
    });

    // 计算平均分（单题满分 10）
    const averageScore = conversationData.candidateAnswers.length > 0
      ? score / conversationData.candidateAnswers.length
      : 0;

    // 维度原始分：保持在 0..10（每题平均）
    const rawScore = Math.min(Math.max(averageScore, 0), 10);
    // 维度贡献分：按该维度权重折算到 0..weight（例如 40 分）
    const weight = this.scoringCriteria.answerQuality.weight;
    const points = (rawScore / 10) * weight;

    if (debugEnabled) {
      this.debugGroup('🟦 [A] 回答质量（汇总）');
      this.debugLog('rawSum(逐题相加，单题满分10):', score);
      this.debugLog('average(每题平均):', averageScore);
      this.debugLog('rawScore(维度原始分 clamp 0..10):', rawScore);
      this.debugLog('points(折算到 0..40): (rawScore/10)*40 =', points);
      this.debugLog('averageLength:', this.calculateAverageAnswerLength(conversationData.candidateAnswers));
      this.debugGroupEnd();
      this.debugGroupEnd();
    }

    return {
      rawScore,
      score: points,
      details: details,
      averageLength: this.calculateAverageAnswerLength(conversationData.candidateAnswers)
    };
  }

  // 分析沟通能力
  analyzeCommunication(conversationData) {
    let score = 0;
    const details = {};

    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('🟩 [B] 沟通能力（含加权过程）');
    }

    // 语言流畅度分析
    const fluencyScore = this.analyzeFluency(conversationData.candidateAnswers);
    details.fluency = fluencyScore;
    score += fluencyScore.score * 0.4; // 40%权重
    if (debugEnabled) this.debugDelta('fluency * 0.4', fluencyScore.score * 0.4, { raw: fluencyScore.score });

    // 逻辑性分析
    const logicScore = this.analyzeLogic(conversationData.candidateAnswers);
    details.logic = logicScore;
    score += logicScore.score * 0.32; // 32%权重
    if (debugEnabled) this.debugDelta('logic * 0.32', logicScore.score * 0.32, { raw: logicScore.score });

    // 自信度分析
    const confidenceScore = this.analyzeConfidence(conversationData.candidateAnswers);
    details.confidence = confidenceScore;
    score += confidenceScore.score * 0.28; // 28%权重
    if (debugEnabled) this.debugDelta('confidence * 0.28', confidenceScore.score * 0.28, { raw: confidenceScore.score });

    // 维度原始分：当前实现的加权和（大致 0..10-ish）
    const rawScore = Math.min(Math.max(score, 0), 10);
    // 维度贡献分：按该维度权重折算到 0..weight（例如 25 分）
    const weight = this.scoringCriteria.communication.weight;
    const points = (rawScore / 10) * weight;
    if (debugEnabled) {
      this.debugLog('rawWeightedSum:', score);
      this.debugLog('rawScore(维度原始分 clamp 0..10):', rawScore);
      this.debugLog('points(折算到 0..25): (rawScore/10)*25 =', points);
      this.debugLog('details:', details);
      this.debugGroupEnd();
    }

    return {
      rawScore,
      score: points,
      details: details
    };
  }

  // 分析专业能力
  analyzeProfessionalism(conversationData) {
    let score = 0;
    const details = {};

    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('🟧 [C] 专业能力（含加权过程）');
    }

    // 专业知识分析
    const knowledgeScore = this.analyzeKnowledge(conversationData.candidateAnswers);
    details.knowledge = knowledgeScore;
    score += knowledgeScore.score * 0.5; // 50%权重
    if (debugEnabled) this.debugDelta('knowledge * 0.5', knowledgeScore.score * 0.5, { raw: knowledgeScore.score });

    // 经验展示分析
    const experienceScore = this.analyzeExperience(conversationData.candidateAnswers);
    details.experience = experienceScore;
    score += experienceScore.score * 0.3; // 30%权重
    if (debugEnabled) this.debugDelta('experience * 0.3', experienceScore.score * 0.3, { raw: experienceScore.score });

    // 问题解决能力分析
    const problemSolvingScore = this.analyzeProblemSolving(conversationData.candidateAnswers);
    details.problemSolving = problemSolvingScore;
    score += problemSolvingScore.score * 0.2; // 20%权重
    if (debugEnabled) this.debugDelta('problemSolving * 0.2', problemSolvingScore.score * 0.2, { raw: problemSolvingScore.score });

    // 维度原始分：当前实现的加权和（大致 0..10-ish）
    const rawScore = Math.min(Math.max(score, 0), 10);
    // 维度贡献分：按该维度权重折算到 0..weight（例如 20 分）
    const weight = this.scoringCriteria.professionalism.weight;
    const points = (rawScore / 10) * weight;
    if (debugEnabled) {
      this.debugLog('rawWeightedSum:', score);
      this.debugLog('rawScore(维度原始分 clamp 0..10):', rawScore);
      this.debugLog('points(折算到 0..20): (rawScore/10)*20 =', points);
      this.debugLog('details:', details);
      this.debugGroupEnd();
    }

    return {
      rawScore,
      score: points,
      details: details
    };
  }

  // 分析态度和动机
  analyzeAttitude(conversationData) {
    let score = 0;
    const details = {};

    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('🟥 [D] 态度与动机（含加权过程）');
    }

    // 积极性分析
    const enthusiasmScore = this.analyzeEnthusiasm(conversationData.candidateAnswers);
    details.enthusiasm = enthusiasmScore;
    score += enthusiasmScore.score * 0.4; // 40%权重
    if (debugEnabled) this.debugDelta('enthusiasm * 0.4', enthusiasmScore.score * 0.4, { raw: enthusiasmScore.score });

    // 动机分析
    const motivationScore = this.analyzeMotivation(conversationData.candidateAnswers);
    details.motivation = motivationScore;
    score += motivationScore.score * 0.33; // 33%权重
    if (debugEnabled) this.debugDelta('motivation * 0.33', motivationScore.score * 0.33, { raw: motivationScore.score });

    // 适应性分析
    const adaptabilityScore = this.analyzeAdaptability(conversationData.candidateAnswers);
    details.adaptability = adaptabilityScore;
    score += adaptabilityScore.score * 0.27; // 27%权重
    if (debugEnabled) this.debugDelta('adaptability * 0.27', adaptabilityScore.score * 0.27, { raw: adaptabilityScore.score });

    // 维度原始分：当前实现的加权和（大致 0..10-ish）
    const rawScore = Math.min(Math.max(score, 0), 10);
    // 维度贡献分：按该维度权重折算到 0..weight（例如 15 分）
    const weight = this.scoringCriteria.attitude.weight;
    const points = (rawScore / 10) * weight;
    if (debugEnabled) {
      this.debugLog('rawWeightedSum:', score);
      this.debugLog('rawScore(维度原始分 clamp 0..10):', rawScore);
      this.debugLog('points(折算到 0..15): (rawScore/10)*15 =', points);
      this.debugLog('details:', details);
      this.debugGroupEnd();
    }

    return {
      rawScore,
      score: points,
      details: details
    };
  }

  // 评估单个回答 - 满分10分
  evaluateSingleAnswer(answer, question) {
    let score = 5; // 基础分5分
    const details = {};

    const debugEnabled = this.isDebugEnabled();

    const safeAnswer = this.normalizeText(answer);
    const safeQuestion = this.normalizeText(question);

    if (debugEnabled) {
      this.debugGroup('    [A1] 单题评分过程（evaluateSingleAnswer）');
      this.debugLog('safeQuestion:', safeQuestion);
      this.debugLog('safeAnswer:', safeAnswer);
    }

    // 1. 回答长度分析 (最多+/-2分)
    const length = safeAnswer.length;
    details.length = length;

    if (length < 10) {
      score -= 3; // 回答过短，大幅扣分
      if (debugEnabled) this.debugDelta('长度<10（回答过短）', -3, { length });
    } else if (length < 30) {
      score -= 1; // 回答较短
      if (debugEnabled) this.debugDelta('长度<30（回答较短）', -1, { length });
    } else if (length > 100) {
      score += 1; // 回答较详细
      if (debugEnabled) this.debugDelta('长度>100（回答较详细）', +1, { length });
    } else if (length > 200) {
      score += 2; // 回答非常详细
      if (debugEnabled) this.debugDelta('长度>200（回答非常详细）', +2, { length });
    }

    // 2. 关键词分析 (最多+/-3分)
    const keywordScore = this.analyzeKeywords(safeAnswer);
    details.keywords = keywordScore;
    const keywordDelta = Math.min(Math.max(keywordScore.score, -3), 3);
    score += keywordDelta;
    if (debugEnabled) this.debugDelta('关键词得分（限制+/-3）', keywordDelta, { foundKeywords: keywordScore.foundKeywords });

    // 3. 相关性分析 (最多+2分)
    const relevanceScore = this.analyzeRelevance(safeAnswer, safeQuestion);
    details.relevance = relevanceScore;
    const relevanceDelta = Math.min(relevanceScore.score, 2);
    score += relevanceDelta;
    if (debugEnabled) this.debugDelta('相关性得分（限制+2）', relevanceDelta, relevanceScore);

    // 4. 结构化表达加分 (最多+1分)
    const structureScore = this.analyzeStructure(safeAnswer);
    details.structure = structureScore;
    if (structureScore.hasStructure) {
      score += 1;
      if (debugEnabled) this.debugDelta('结构化表达加分', +1, structureScore);
    }

    // 限制在0-10分
    const finalScore = Math.min(Math.max(Math.round(score), 0), 10);

    if (debugEnabled) {
      this.debugLog('rawSum(未 clamp):', score);
      this.debugLog('finalScore(clamp 0..10):', finalScore);
      this.debugGroupEnd();
    }

    return {
      score: finalScore,
      details: details
    };
  }

  // 分析回答结构
  analyzeStructure(text) {
    const safeText = this.normalizeText(text);
    const structureIndicators = {
      hasNumbering: /^[一二三四五六七八九十1-9]/m.test(safeText) || /[首先其次然后最后]/.test(safeText),
      hasLogic: /因为.*所以|如果.*那么|虽然.*但是/.test(safeText),
      hasSummary: /总之|综上所述|总结/.test(safeText)
    };

    return {
      hasStructure: structureIndicators.hasNumbering || structureIndicators.hasLogic,
      details: structureIndicators
    };
  }

  // 分析关键词
  analyzeKeywords(text) {
    const safeText = this.normalizeText(text);
    let score = 0;
    const foundKeywords = [];

    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('      [A1.1] 关键词命中（analyzeKeywords）');
      this.debugLog('text:', safeText);
    }

    Object.keys(this.keywordScoring).forEach(category => {
      this.keywordScoring[category].keywords.forEach(keyword => {
        // 统计关键词出现次数
        const regex = new RegExp(keyword, 'g');
        const matches = safeText.match(regex);
        if (matches) {
          const count = matches.length;
          const categoryScore = this.keywordScoring[category].score * Math.min(count, 2); // 同一关键词最多计2次
          score += categoryScore;
          foundKeywords.push({ keyword, category, count, score: categoryScore });
          if (debugEnabled) this.debugDelta(`命中「${keyword}」x${count}(${category})`, categoryScore);
        }
      });
    });

    if (debugEnabled) {
      this.debugLog('keywordTotalScore:', score);
      this.debugLog('foundKeywords:', foundKeywords);
      this.debugGroupEnd();
    }

    return {
      score: score,
      foundKeywords: foundKeywords
    };
  }

  // 分析相关性
  analyzeRelevance(answer, question) {
    // 简单的相关性分析，基于关键词匹配
    const questionKeywords = this.extractKeywords(question);
    const answerKeywords = this.extractKeywords(answer);

    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('      [A1.2] 相关性匹配（analyzeRelevance）');
      this.debugLog('question:', question);
      this.debugLog('answer:', answer);
      this.debugLog('questionKeywords:', questionKeywords);
      this.debugLog('answerKeywords:', answerKeywords);
    }
    
    let matchCount = 0;
    questionKeywords.forEach(qKeyword => {
      if (answerKeywords.some(aKeyword => aKeyword.includes(qKeyword) || qKeyword.includes(aKeyword))) {
        matchCount++;
        if (debugEnabled) this.debugLog(`        ✓ 匹配关键词:`, { qKeyword });
      }
    });

    const relevanceScore = (matchCount / Math.max(questionKeywords.length, 1)) * 5;

    if (debugEnabled) {
      this.debugLog('matchCount:', matchCount);
      this.debugLog('questionKeywords.length:', questionKeywords.length);
      this.debugLog('relevanceScore(公式: matchCount/max(len,1)*5):', relevanceScore);
      this.debugGroupEnd();
    }
    
    return {
      score: relevanceScore,
      matchCount: matchCount,
      totalKeywords: questionKeywords.length
    };
  }

  // 提取关键词
  extractKeywords(text) {
    // 简单的关键词提取，移除常见停用词
    const stopWords = ['的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '或', '但', '因为', '所以', '如果', '虽然', '但是'];

    const safeText = this.normalizeText(text);
    if (!safeText.trim()) return [];

    return safeText.split(/[，。！？；：\s]+/)
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 10); // 取前10个关键词
  }

  // 计算总分
  calculateTotalScore(categoryScores) {
    let totalScore = 0;
    const debugEnabled = this.isDebugEnabled();
    if (debugEnabled) {
      this.debugGroup('🧩 [T] 总分计算（逐项贡献）');
      try {
        this.debugLog('categoryScores:', JSON.parse(JSON.stringify(categoryScores)));
      } catch (e) {
        this.debugLog('categoryScores:', categoryScores);
      }
    }
    // 现在约定：categoryScores[category].score 已经是“折算到该维度满分”的贡献分
    // 例如 answerQuality.score ∈ [0,40]，communication.score ∈ [0,25] ...
    Object.keys(categoryScores).forEach(category => {
      const weight = this.scoringCriteria[category].weight;
      const points = Number(categoryScores?.[category]?.score || 0);
      totalScore += points;

      if (debugEnabled) {
        const rawScore = categoryScores?.[category]?.rawScore;
        this.debugLog(`  - contrib(${category}) = points (已折算到 0..${weight})`, {
          category,
          rawScore,
          weight,
          points
        });
      }
    });

    // 按 1 位小数保留（例如 66.4），再 clamp 到 0..100
    totalScore = Math.min(Math.max(Number(totalScore.toFixed(1)), 0), 100);

    if (debugEnabled) {
      this.debugLog('totalScore(toFixed(1) + clamp 0..100):', totalScore);
      this.debugGroupEnd();
    }
    return totalScore;
  }

  // 生成详细分析
  generateDetailedAnalysis(categoryScores) {
    const analysis = {};
    
    Object.keys(categoryScores).forEach(category => {
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      
      analysis[category] = {
        score: score,
        maxScore: maxScore,
        percentage: Math.round(percentage),
        level: this.getScoreLevel(percentage)
      };
    });

    return analysis;
  }

  // 获取分数等级
  getScoreLevel(percentage) {
    if (percentage >= 90) return '优秀';
    if (percentage >= 80) return '良好';
    if (percentage >= 70) return '中等';
    if (percentage >= 60) return '及格';
    return '待提升';
  }

  // 生成推荐建议
  generateRecommendations(categoryScores) {
    const recommendations = [];
    
    Object.keys(categoryScores).forEach(category => {
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      
      if (percentage < 60) {
        recommendations.push({
          category: category,
          issue: this.getCategoryIssue(category),
          suggestion: this.getCategorySuggestion(category),
          priority: percentage < 40 ? '高' : '中'
        });
      }
    });

    return recommendations;
  }

  // 获取分类问题描述
  getCategoryIssue(category) {
    const issues = {
      answerQuality: '回答质量有待提升',
      communication: '沟通表达能力需要加强',
      professionalism: '专业能力展示不足',
      attitude: '态度和动机不够明确'
    };
    return issues[category] || '需要改进';
  }

  // 获取分类建议
  getCategorySuggestion(category) {
    const suggestions = {
      answerQuality: '建议在回答时更加具体和详细，提供更多实例',
      communication: '建议提高语言表达的清晰度和逻辑性',
      professionalism: '建议更好地展示专业知识和相关经验',
      attitude: '建议更明确地表达职业目标和动机'
    };
    return suggestions[category] || '建议进一步改进';
  }

  // 生成对话摘要
  generateConversationSummary(conversationData) {
    const totalQuestions = conversationData.questions.length;
    const totalAnswers = conversationData.candidateAnswers.length;
    const avgAnswerLength = this.calculateAverageAnswerLength(conversationData.candidateAnswers);
    
    return `本次面试共进行了${totalQuestions}个问题的交流，候选人回答了${totalAnswers}个问题，平均回答长度为${avgAnswerLength}字。`;
  }

  // 计算平均回答长度
  calculateAverageAnswerLength(answers) {
    if (answers.length === 0) return 0;
    const totalLength = answers.reduce((sum, answer) => sum + this.normalizeText(answer).length, 0);
    return Math.round(totalLength / answers.length);
  }

  // 识别优势
  identifyStrengths(categoryScores) {
    const strengths = [];
    
    Object.keys(categoryScores).forEach(category => {
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      
      if (percentage >= 80) {
        strengths.push({
          category: category,
          description: this.getCategoryStrength(category),
          score: percentage
        });
      }
    });

    return strengths;
  }

  // 识别劣势
  identifyWeaknesses(categoryScores) {
    const weaknesses = [];
    
    Object.keys(categoryScores).forEach(category => {
      const score = categoryScores[category].score;
      const maxScore = this.scoringCriteria[category].weight;
      const percentage = (score / maxScore) * 100;
      
      if (percentage < 60) {
        weaknesses.push({
          category: category,
          description: this.getCategoryWeakness(category),
          score: percentage
        });
      }
    });

    return weaknesses;
  }

  // 获取分类优势描述
  getCategoryStrength(category) {
    const strengths = {
      answerQuality: '回答质量优秀，内容详实',
      communication: '沟通表达能力强，逻辑清晰',
      professionalism: '专业能力突出，经验丰富',
      attitude: '态度积极，动机明确'
    };
    return strengths[category] || '表现优秀';
  }

  // 获取分类劣势描述
  getCategoryWeakness(category) {
    const weaknesses = {
      answerQuality: '回答质量有待提升',
      communication: '沟通表达能力需要加强',
      professionalism: '专业能力展示不足',
      attitude: '态度和动机不够明确'
    };
    return weaknesses[category] || '需要改进';
  }

  // 各种分析方法的实现（简化版）
  analyzeFluency(answers) {
    // 基于回答长度和结构分析流畅度
    const avgLength = this.calculateAverageAnswerLength(answers);
    let score = 0;
    
    if (avgLength > 50) score += 3;
    if (avgLength > 100) score += 2;
    
    return { score: Math.min(score, 10), details: { avgLength } };
  }

  analyzeLogic(answers) {
    // 基于关键词和结构分析逻辑性
    let score = 0;
    answers.forEach(answer => {
      const a = this.normalizeText(answer);
      if (a.includes('首先') || a.includes('然后') || a.includes('最后')) score += 1;
      if (a.includes('因为') || a.includes('所以')) score += 1;
    });
    
    return { score: Math.min(score, 8), details: { logicalWords: score } };
  }

  analyzeConfidence(answers) {
    // 基于积极词汇分析自信度
    let score = 0;
    const positiveWords = ['能够', '可以', '有信心', '擅长', '熟悉', '掌握'];
    
    answers.forEach(answer => {
      const a = this.normalizeText(answer);
      positiveWords.forEach(word => {
        if (a.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 7), details: { positiveWords: score } };
  }

  analyzeKnowledge(answers) {
    // 基于专业词汇分析专业知识
    let score = 0;
    const professionalWords = ['技术', '技能', '经验', '项目', '数据', '分析', '优化', '管理'];
    
    answers.forEach(answer => {
      const a = this.normalizeText(answer);
      professionalWords.forEach(word => {
        if (a.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 10), details: { professionalWords: score } };
  }

  analyzeExperience(answers) {
    // 基于经验描述分析经验展示
    let score = 0;
    const experienceWords = ['做过', '参与', '负责', '完成', '实现', '解决', '处理'];
    
    answers.forEach(answer => {
      const a = this.normalizeText(answer);
      experienceWords.forEach(word => {
        if (a.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 6), details: { experienceWords: score } };
  }

  analyzeProblemSolving(answers) {
    // 基于问题解决描述分析问题解决能力
    let score = 0;
    const problemSolvingWords = ['解决', '处理', '分析', '优化', '改进', '创新'];
    
    answers.forEach(answer => {
      problemSolvingWords.forEach(word => {
        if (answer.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 4), details: { problemSolvingWords: score } };
  }

  analyzeEnthusiasm(answers) {
    // 基于积极词汇分析积极性
    let score = 0;
    const enthusiasmWords = ['喜欢', '热爱', '感兴趣', '愿意', '积极', '主动'];
    
    answers.forEach(answer => {
      enthusiasmWords.forEach(word => {
        if (answer.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 6), details: { enthusiasmWords: score } };
  }

  analyzeMotivation(answers) {
    // 基于目标描述分析动机
    let score = 0;
    const motivationWords = ['目标', '规划', '发展', '成长', '学习', '提升', '挑战'];
    
    answers.forEach(answer => {
      motivationWords.forEach(word => {
        if (answer.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 5), details: { motivationWords: score } };
  }

  analyzeAdaptability(answers) {
    // 基于适应性描述分析适应性
    let score = 0;
    const adaptabilityWords = ['适应', '学习', '调整', '变化', '灵活', '开放'];
    
    answers.forEach(answer => {
      adaptabilityWords.forEach(word => {
        if (answer.includes(word)) score += 1;
      });
    });
    
    return { score: Math.min(score, 4), details: { adaptabilityWords: score } };
  }
}

export default InterviewScoring;



