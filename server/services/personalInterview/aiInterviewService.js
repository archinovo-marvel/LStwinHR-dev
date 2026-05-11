/**
 * AI 面试服务（核心）
 * 负责生成问题、评估回答、生成报告
 */
const axios = require('axios');
const { withAIConcurrencyLimit, AIOverloadError } = require('../../utils/aiConcurrencyGate');

// 本地 VL 模型配置（Docker 内部访问）
const LOCAL_VL_CONFIG = {
  url: process.env.LOCAL_LLM_VL_URL || 'http://local-llm-vl:8000',
  model: process.env.LOCAL_LLM_VL_MODEL || 'qwen3.5-9b-vlm-gguf',
  timeout: Number(process.env.LOCAL_VL_TIMEOUT_MS || 120000),
  enabled: process.env.LOCAL_LLM_ENABLED === 'true'
};

// 面试官系统 Prompt
const INTERVIEWER_SYSTEM_PROMPT = `你是一位资深专业面试官，擅长从多角度全面考察候选人。你必须只输出JSON格式，不要输出任何其他文字。

核心原则：
1. 问题多样性：每次提问必须从不同维度考察，避免与之前问题在话题、考察点上重复或相似
2. 问题类型轮换：在technical(技术)、behavioral(行为)、experience(经验深挖)、situational(情景假设)、project(项目实战)、career(职业发展)之间轮换
3. 深度递进：后续问题应在前序回答基础上挖掘更深层次的内容，而非简单换种说法问同类问题
4. 具体化：问题应结合候选人简历中的具体经历、技能、项目来提问，避免泛泛而谈

输出格式示例：
{"question":"你的问题","questionType":"technical","intent":"考察意图","followUpHints":["追问1","追问2"]}`;

// 评估回答的 Prompt 模板
const EVALUATION_PROMPT_TEMPLATE = `你是面试评估专家，评估候选人回答并生成下一问题。只输出JSON。

当前问题：{question}
候选人回答：{answer}

评分维度(0-10)：relevance相关性, clarity清晰度, depth深度, professionalism专业性, authenticity真实性

【重要】生成下一问题时必须遵守：
1. 不要生成与已问问题相似或重复的问题
2. 必须从与当前问题不同的维度/类型来提问
3. 问题类型可选：technical(技术)、behavioral(行为)、experience(经验深挖)、situational(情景假设)、project(项目实战)、career(职业发展)
4. 如果候选人的回答有值得深入挖掘的点，设置nextAction为"probe"并生成追问；否则生成全新维度的问题

输出格式：
{
  "scores": {"relevance": 8, "clarity": 7, "depth": 6, "professionalism": 7, "authenticity": 8},
  "totalScore": 7.2,
  "feedback": "评价（30字）",
  "strengths": ["亮点1", "亮点2"],
  "improvements": ["改进点1"],
  "nextAction": "continue",
  "nextQuestion": "下一个面试问题"
}`;

// 生成报告的 Prompt 模板（简化版，确保 JSON 输出）
const REPORT_PROMPT_TEMPLATE = `根据面试记录生成评估报告。严格输出JSON格式，不要输出其他文字。

岗位：{positionInfo}

面试问答记录：
{conversation}

输出JSON格式（最多3个亮点、3个不足、3个建议）：
{"overallScore":75,"grade":"C","summary":"综合评价50字内","strengths":["亮点1","亮点2"],"weaknesses":["不足1","不足2"],"suggestions":["建议1","建议2"]}`;

// 单个问题评估的 Prompt 模板
const QUESTION_EVAL_PROMPT = `评估候选人回答，输出JSON。

问题：{question}
回答：{answer}

输出格式：
{
  "scores": {"relevance": 8, "clarity": 7, "depth": 6, "professionalism": 7, "authenticity": 8},
  "totalScore": 7.2,
  "feedback": "具体评价（50字左右）",
  "strengths": ["回答亮点1", "亮点2"],
  "improvements": ["可改进1"],
  "nextAction": "continue",
  "nextQuestion": "下一个问题"
}`;

class AIInterviewService {
  /**
   * 生成首个面试问题
   * @param {string} resumeText - 简历文本
   * @param {Object} positionInfo - 岗位信息
   * @param {string} difficulty - 难度 (easy/medium/hard)
   * @returns {Promise<Object>} - 问题对象
   */
  async generateFirstQuestion(resumeText, positionInfo, difficulty = 'medium') {
    const prompt = this.buildFirstQuestionPrompt(resumeText, positionInfo, difficulty);
    return this.callAI(prompt, INTERVIEWER_SYSTEM_PROMPT);
  }

  /**
   * 生成下一个面试问题（避免与已问问题重复）
   * @param {string} resumeText - 简历文本
   * @param {Object} positionInfo - 岗位信息
   * @param {string} difficulty - 难度
   * @param {Array} askedQuestions - 已问问题列表
   * @returns {Promise<Object>} - 问题对象
   */
  async generateNextQuestion(resumeText, positionInfo, difficulty, askedQuestions = []) {
    const prompt = this.buildNextQuestionPrompt(resumeText, positionInfo, difficulty, askedQuestions);
    return this.callAI(prompt, INTERVIEWER_SYSTEM_PROMPT);
  }

  /**
   * 评估回答并生成下一问题
   * @param {string} resumeText - 简历文本
   * @param {Object} question - 当前问题
   * @param {string} answer - 候选人回答
   * @param {Object} positionInfo - 岗位信息
   * @param {Array} conversationHistory - 对话历史
   * @returns {Promise<Object>} - 评估结果和下一问题
   */
  async evaluateAnswer(resumeText, question, answer, positionInfo, conversationHistory = []) {
    const evaluationPrompt = EVALUATION_PROMPT_TEMPLATE
      .replace('{question}', question.question)
      .replace('{answer}', answer);
    const contextPrompt = this.buildContextPrompt(resumeText, positionInfo, conversationHistory);
    // 构建已问问题摘要，帮助AI避免重复
    const askedSummary = conversationHistory
      .filter(item => item.question)
      .map((item, i) => `${i + 1}. [${item.questionType || '未知'}] ${item.question}`)
      .join('\n');
    const avoidRepeatSection = askedSummary
      ? `\n\n【已问问题（新问题不得与这些重复或相似）】\n${askedSummary}`
      : '';
    const fullPrompt = `${contextPrompt}${avoidRepeatSection}\n\n${evaluationPrompt}`;
    return this.callAI(fullPrompt, INTERVIEWER_SYSTEM_PROMPT);
  }

  /**
   * 生成面试报告
   * @param {string} resumeText - 简历文本
   * @param {Array} conversation - 完整对话记录
   * @param {Object} positionInfo - 岗位信息
   * @returns {Promise<Object>} - 面试报告
   */
  async generateReport(resumeText, conversation, positionInfo) {
    const conversationText = this.formatConversationForReport(conversation);
    const positionText = `${positionInfo.positionName || '未知岗位'}：${this.truncateText(positionInfo.description || '', 150)}`;

    const prompt = REPORT_PROMPT_TEMPLATE
      .replace('{positionInfo}', positionText)
      .replace('{conversation}', this.truncateText(conversationText, 2000));

    // 使用较少的 max_tokens 避免截断
    return this.callAI(prompt, '你是专业的面试评估专家，严格输出JSON格式的评估报告。', 800);
  }

  /**
   * 构建首个问题的 Prompt
   */
  buildFirstQuestionPrompt(resumeText, positionInfo, difficulty) {
    const difficultyGuide = {
      easy: '从简单的问题开始，帮助候选人放松，可以先问一些基础背景问题。',
      medium: '问题难度适中，既要考察基础能力，也要有一定深度。',
      hard: '问题要有一定挑战性，重点考察候选人的技术深度和解决问题的能力。'
    };
    return `请开始一场模拟面试。

【候选人简历摘要】
${this.truncateText(resumeText, 3000)}

【岗位信息】
- 岗位名称：${positionInfo.positionName}
- 公司名称：${positionInfo.companyName || '未知'}
- 岗位描述：${positionInfo.description}
${positionInfo.skills ? `- 技能要求：${positionInfo.skills.join('、')}` : ''}

【难度设定】
${difficultyGuide[difficulty] || difficultyGuide.medium}

【问题类型指引】
这是第1个问题，建议从experience(经验深挖)或behavioral(行为)类型开始，让候选人先展示背景。

请生成第一个面试问题。记住：严格输出 JSON 格式。`;
  }

  /**
   * 构建下一问题的 Prompt（包含已问问题，避免重复）
   */
  buildNextQuestionPrompt(resumeText, positionInfo, difficulty, askedQuestions) {
    const difficultyGuide = {
      easy: '问题简单，帮助候选人展示基础能力。',
      medium: '问题难度适中，兼顾广度和深度。',
      hard: '问题有挑战性，重点考察深度和解决能力。'
    };
    const askedList = askedQuestions.map((q, i) =>
      `${i + 1}. [${q.questionType || '未知'}] ${q.question}`
    ).join('\n');
    const askedTypes = askedQuestions.map(q => q.questionType).filter(Boolean);
    const typeSuggestions = this.getSuggestedTypes(askedTypes);
    return `请继续模拟面试，生成下一个问题。

【候选人简历摘要】
${this.truncateText(resumeText, 3000)}

【岗位信息】
- 岗位名称：${positionInfo.positionName}
- 公司名称：${positionInfo.companyName || '未知'}
- 岗位描述：${positionInfo.description}
${positionInfo.skills ? `- 技能要求：${positionInfo.skills.join('、')}` : ''}

【难度设定】
${difficultyGuide[difficulty] || difficultyGuide.medium}

【已问问题（必须避免重复或相似话题）】
${askedList || '（无）'}

【已使用的问题类型】
${askedTypes.length > 0 ? askedTypes.join('、') : '无'}

【建议的下一问题类型】
${typeSuggestions}

【重要规则】
1. 新问题绝对不能与已问问题在话题、考察点上重复或相似
2. 优先从建议的类型中选择，确保考察维度多样化
3. 结合候选人简历中的具体经历来提问，让问题更有针对性
4. 随着面试推进，问题应逐渐深入

请生成下一个面试问题。记住：严格输出 JSON 格式。`;
  }

  /**
   * 根据已使用的类型推荐下一问题类型
   */
  getSuggestedTypes(askedTypes) {
    const allTypes = [
      { key: 'technical', label: 'technical(技术)', desc: '考察专业技能、技术理解' },
      { key: 'behavioral', label: 'behavioral(行为)', desc: '考察过往行为模式、软技能' },
      { key: 'experience', label: 'experience(经验深挖)', desc: '深挖简历中的项目经历' },
      { key: 'situational', label: 'situational(情景假设)', desc: '假设场景考察应变能力' },
      { key: 'project', label: 'project(项目实战)', desc: '考察项目设计、架构思维' },
      { key: 'career', label: 'career(职业发展)', desc: '考察职业规划、自我认知' }
    ];
    const usedSet = new Set(askedTypes);
    const unused = allTypes.filter(t => !usedSet.has(t.key));
    if (unused.length > 0) {
      return unused.map(t => `${t.label} - ${t.desc}`).join('；');
    }
    const typeCounts = {};
    askedTypes.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const leastUsed = allTypes.sort((a, b) => (typeCounts[a.key] || 0) - (typeCounts[b.key] || 0));
    return leastUsed.slice(0, 3).map(t => `${t.label} - ${t.desc}`).join('；');
  }

  /**
   * 构建上下文 Prompt
   */
  buildContextPrompt(resumeText, positionInfo, conversationHistory) {
    const recentHistory = conversationHistory.slice(-4);
    const historyText = recentHistory.map(item =>
      `Q: ${item.question}\nA: ${item.answer}`
    ).join('\n\n');

    return `【候选人简历摘要】
${this.truncateText(resumeText, 2000)}

【岗位信息】
岗位名称：${positionInfo.positionName}
岗位描述：${this.truncateText(positionInfo.description, 500)}

【近期对话记录】
${historyText || '（这是第一个问题）'}`;
  }

  /**
   * 格式化对话记录用于报告生成
   */
  formatConversationForReport(conversation) {
    return conversation
      .filter(item => item.answer) // 只保留已回答的
      .map((item, index) => {
        const scores = item.scores ? JSON.stringify(item.scores) : '无';
        return `Q${index + 1}: ${item.question}\nA: ${this.truncateText(item.answer, 300)}\n评分: ${scores}`;
      })
      .join('\n\n');
  }

  /**
   * 调用 AI 模型（带重试机制）
   */
  async callAI(prompt, systemPrompt, maxTokens = 1500, retries = 2) {
    if (!LOCAL_VL_CONFIG.enabled) {
      throw new Error('本地大模型未启用，请设置 LOCAL_LLM_ENABLED=true');
    }

    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[AI Interview] Calling local LLM (attempt ${attempt + 1}/${retries + 1})`);

        const response = await withAIConcurrencyLimit('local', () => axios.post(
          `${LOCAL_VL_CONFIG.url}/v1/chat/completions`,
          {
            model: LOCAL_VL_CONFIG.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.9
          },
          {
            timeout: LOCAL_VL_CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' }
          }
        ));

        const content = response.data?.choices?.[0]?.message?.content || '';
        console.log('[AI Interview] Response received, length:', content.length);

        // 检查响应是否有效
        if (!content.trim() || content.length < 10) {
          throw new Error('AI 返回内容过短或为空');
        }

        return this.parseAIResponse(content);
      } catch (error) {
        lastError = error;
        console.error(`[AI Interview] Attempt ${attempt + 1} failed:`, error.message);

        if (error instanceof AIOverloadError || error.code === 'AI_OVERLOADED') {
          break;
        }

        // 如果还有重试机会，等待一段时间后重试
        if (attempt < retries) {
          console.log('[AI Interview] Retrying in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw new Error(`AI 服务调用失败: ${lastError?.message}`);
  }

  /**
   * 解析 AI 响应
   */
  parseAIResponse(content) {
    if (!content.trim()) {
      throw new Error('AI 返回为空');
    }

    // 尝试提取 JSON
    let jsonStr = content;

    // 移除可能的 Markdown 代码块
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    // 尝试找到 JSON 对象
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.slice(startIdx, endIdx + 1);
    }

    // 尝试修复截断的 JSON
    // 如果 JSON 不完整（缺少闭合括号），尝试补全
    const openBraces = (jsonStr.match(/{/g) || []).length;
    const closeBraces = (jsonStr.match(/}/g) || []).length;
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/]/g) || []).length;

    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      // JSON 可能被截断，尝试修复
      console.log('[AI Interview] JSON appears truncated, attempting to fix...');

      // 尝试截断到最后一个完整的值
      let lastCompleteIdx = jsonStr.length;

      // 找最后一个完整的字符串值或数组
      const lastQuoteIdx = jsonStr.lastIndexOf('"');
      if (lastQuoteIdx > 0) {
        // 检查是否是完整的字符串
        const beforeLastQuote = jsonStr.substring(0, lastQuoteIdx);
        const quoteCount = (beforeLastQuote.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 === 1) {
          // 奇数个引号，说明字符串未闭合
          // 找上一个完整的值
          const patterns = ['",', '],', '},'];
          for (const pattern of patterns) {
            const idx = jsonStr.lastIndexOf(pattern);
            if (idx > 0 && idx < lastCompleteIdx) {
              lastCompleteIdx = idx + 1;
            }
          }
          jsonStr = jsonStr.substring(0, lastCompleteIdx);
        }
      }

      // 补全缺失的括号
      const missingBraces = openBraces - (jsonStr.match(/}/g) || []).length;
      const missingBrackets = openBrackets - (jsonStr.match(/]/g) || []).length;

      for (let i = 0; i < missingBrackets; i++) jsonStr += ']';
      for (let i = 0; i < missingBraces; i++) jsonStr += '}';
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('[AI Interview] JSON parse failed:', e.message);
      console.error('[AI Interview] Raw content:', content.slice(0, 500));
      throw new Error('AI 响应格式解析失败');
    }
  }

  /**
   * 截断文本
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
}

module.exports = new AIInterviewService();
