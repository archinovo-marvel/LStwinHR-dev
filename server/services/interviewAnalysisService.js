'use strict';

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://host.docker.internal:8002';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2-7b-gguf';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:14b';
const { withAIConcurrencyLimit } = require('../utils/aiConcurrencyGate');

// P2-4: 区分本地模型和Ollama的超时策略
const LOCAL_AI_TIMEOUT_MS = 30000;
const OLLAMA_AI_TIMEOUT_MS = 30000;
const DEFAULT_DIMENSION_SCORE = 5;

// ========================================
// P0改进：扩展为8维度评分体系
// 新增维度：evidence、actionability、selfAwareness、growthMindset
// ========================================
const SYSTEM_PROMPT = `你是专业AI面试评分员，负责评估候选人综合素质（IQ/EQ/AQ/MQ）。

问题：{question}
回答：{answer}

【评分维度】（每项0-10分）

【原有维度】
- relevance（相关性）：回答是否切题，是否回应问题核心
- depth（深度）：是否有具体行为细节和反思深度
- clarity（清晰度）：表达是否清晰流畅，逻辑是否完整
- professionalism（专业性）：是否展示成熟心态和专业素养

【新增维度】
- evidence（证据性）：是否有具体数据、案例、成果支撑
  * 8-10分：提供具体数据（如"提升30%"）、可验证案例、第三方认可
  * 4-7分：有案例描述但缺乏数据，或数据模糊（如"大幅提升"）
  * 0-3分：纯理论描述，无具体案例或数据

- actionability（可执行性）：方案是否具体可落地
  * 8-10分：有具体步骤、时间节点、资源需求、风险预案
  * 4-7分：有基本思路但缺乏细节，或过于理想化
  * 0-3分：空泛理论，无法落地

- selfAwareness（自我认知）：对自身能力和局限的认知深度
  * 8-10分：坦诚承认不足，有具体改进计划，客观评价优劣势
  * 4-7分：能说出部分优缺点，但分析不够深入
  * 0-3分：回避缺点、过度自信或缺乏反思

- growthMindset（成长思维）：从失败中学习、持续改进的心态
  * 8-10分：主动分享失败教训，展现持续学习行动
  * 4-7分：能接受失败，学习转化不明显
  * 0-3分：回避失败、归咎外因、固定型思维

【评分标准总览】
8-10分：表现优秀，有具体证据和深刻反思
5-7分：表现一般，有基本描述但不够深入
0-4分：表现不足，回避问题或缺乏实质内容

请返回纯JSON（无markdown代码块）：
{
  "relevance": 8,
  "depth": 9,
  "clarity": 7,
  "professionalism": 8,
  "evidence": 7,
  "actionability": 6,
  "selfAwareness": 8,
  "growthMindset": 9,
  "comment": "一句话评语"
}`;

function buildEvalPrompt(question, answer) {
  const safeQuestion = JSON.stringify(String(question || ''));
  const safeAnswer = JSON.stringify(String(answer || ''));
  return SYSTEM_PROMPT
    .replace('{question}', safeQuestion)
    .replace('{answer}', safeAnswer);
}

function getDefaultScores() {
  // P0改进：默认分数包含8个维度
  return {
    relevance: DEFAULT_DIMENSION_SCORE,
    depth: DEFAULT_DIMENSION_SCORE,
    clarity: DEFAULT_DIMENSION_SCORE,
    professionalism: DEFAULT_DIMENSION_SCORE,
    evidence: DEFAULT_DIMENSION_SCORE,
    actionability: DEFAULT_DIMENSION_SCORE,
    selfAwareness: DEFAULT_DIMENSION_SCORE,
    growthMindset: DEFAULT_DIMENSION_SCORE,
    comment: '评分服务异常，使用默认分'
  };
}

// P0改进：定义所有期望的评分维度
const REQUIRED_DIMENSIONS = [
  'relevance', 'depth', 'clarity', 'professionalism',
  'evidence', 'actionability', 'selfAwareness', 'growthMindset'
];

function parseAIResponse(text) {
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);

    // 检查核心维度是否存在（至少要有原有的4个维度）
    const hasCoreDimensions = ['relevance', 'depth', 'clarity', 'professionalism']
      .every(dim => typeof parsed[dim] === 'number');

    if (!hasCoreDimensions) {
      return null;
    }

    // 构建结果对象，填充缺失的维度（向后兼容）
    const result = {};
    REQUIRED_DIMENSIONS.forEach(dim => {
      if (typeof parsed[dim] === 'number') {
        result[dim] = Math.max(0, Math.min(10, Math.round(parsed[dim])));
      } else {
        // 缺失的维度使用默认值
        result[dim] = DEFAULT_DIMENSION_SCORE;
        console.warn(`评分维度 "${dim}" 缺失，已使用默认值 ${DEFAULT_DIMENSION_SCORE}`);
      }
    });

    result.comment = String(parsed.comment || '无评语').slice(0, 200);

    return result;
  } catch {
    return null;
  }
}

async function callLocalModel(question, answer) {
  const prompt = buildEvalPrompt(question, answer);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_AI_TIMEOUT_MS);

  try {
    const response = await withAIConcurrencyLimit('local', async () => fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_LLM_MODEL,
        stream: false,
        temperature: 0.1,
        max_tokens: 256,
        messages: [
          { role: 'user', content: prompt }
        ]
      }),
      signal: controller.signal
    }));
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Local LLM request failed: ${response.status}`);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || '';
    if (!content) {
      throw new Error('Local LLM returned empty content');
    }
    return content;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function callOllamaModel(question, answer) {
  const prompt = buildEvalPrompt(question, answer);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_AI_TIMEOUT_MS);

  try {
    const response = await withAIConcurrencyLimit('ollama', async () => fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.1 },
        prompt
      }),
      signal: controller.signal
    }));
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const result = await response.json();
    const content = result?.response || '';
    if (!content) {
      throw new Error('Ollama returned empty content');
    }
    return content;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function evaluateSingleAnswer(question, answer) {
  if (!question || !answer) {
    return getDefaultScores();
  }

  const questionStr = String(question).trim();
  const answerStr = String(answer).trim();

  if (!questionStr || !answerStr) {
    return getDefaultScores();
  }

  // Try local model first
  try {
    const content = await callLocalModel(questionStr, answerStr);
    const parsed = parseAIResponse(content);
    if (parsed) return parsed;
  } catch (error) {
    console.warn('Local model evaluation failed, trying Ollama:', error.message);
  }

  // Fallback to Ollama
  try {
    const content = await callOllamaModel(questionStr, answerStr);
    const parsed = parseAIResponse(content);
    if (parsed) return parsed;
  } catch (error) {
    console.warn('Ollama evaluation failed, using default scores:', error.message);
  }

  // All failed, return default scores
  return getDefaultScores();
}

// P1-1: 8维度加权计算（所有维度参与最终得分）
// 权重分配：原4维各0.20，新4维各0.05
const DIMENSION_WEIGHTS_8D = {
  relevance: 0.20,
  depth: 0.20,
  clarity: 0.20,
  professionalism: 0.20,
  evidence: 0.05,
  actionability: 0.05,
  selfAwareness: 0.05,
  growthMindset: 0.05,
};

function calculateSingleQuestionScore(scores) {
  const { relevance = 5, depth = 5, clarity = 5, professionalism = 5,
          evidence = 5, actionability = 5, selfAwareness = 5, growthMindset = 5 } = scores;
  return (
    relevance * DIMENSION_WEIGHTS_8D.relevance +
    depth * DIMENSION_WEIGHTS_8D.depth +
    clarity * DIMENSION_WEIGHTS_8D.clarity +
    professionalism * DIMENSION_WEIGHTS_8D.professionalism +
    evidence * DIMENSION_WEIGHTS_8D.evidence +
    actionability * DIMENSION_WEIGHTS_8D.actionability +
    selfAwareness * DIMENSION_WEIGHTS_8D.selfAwareness +
    growthMindset * DIMENSION_WEIGHTS_8D.growthMindset
  ) * 10; // 归一化到0-100比例
}

function calculateTotalScore(questionScores) {
  if (!questionScores || questionScores.length === 0) return 0;
  const totalContributions = questionScores.reduce((sum, qs) => sum + calculateSingleQuestionScore(qs), 0);
  return Math.round((totalContributions / questionScores.length / 40) * 90);
}

function buildSummary(questionScores, totalScore) {
  if (!questionScores || questionScores.length === 0) {
    return '面试评分完成，未提供有效问答数据。';
  }
  const eqScores = questionScores.filter((_, i) => i < 3);
  const aqScores = questionScores.filter((_, i) => i >= 3 && i < 6);
  const mqScores = questionScores.filter((_, i) => i >= 6 && i < 9);
  const avg = (arr, key) => arr.length > 0 ? arr.reduce((s, q) => s + (q[key] || 0), 0) / arr.length : 0;
  const eqAvg = avg(eqScores, 'depth');
  const aqAvg = avg(aqScores, 'depth');
  const mqAvg = avg(mqScores, 'depth');
  const strengths = [];
  const concerns = [];
  if (eqAvg >= 7) strengths.push('情商表现优秀');
  else if (eqAvg < 4) concerns.push('情商维度有待加强');
  if (aqAvg >= 7) strengths.push('逆商表现优秀');
  else if (aqAvg < 4) concerns.push('逆商维度有待加强');
  if (mqAvg >= 7) strengths.push('德商表现优秀');
  else if (mqAvg < 4) concerns.push('德商维度有待加强');
  const strengthStr = strengths.length > 0 ? strengths.join('，') + '。' : '';
  const concernStr = concerns.length > 0 ? '建议：' + concerns.join('，') + '。' : '';
  return `面试总分${totalScore}/90分。${strengthStr}${concernStr}`.trim();
}

async function evaluateInterview(conversationData) {
  const { questions = [], candidateAnswers = [] } = conversationData;

  if (!Array.isArray(questions) || !Array.isArray(candidateAnswers)) {
    return {
      totalScore: 0,
      questionScores: [],
      summary: '面试评分失败：数据格式错误',
      evaluatedAt: new Date().toISOString()
    };
  }

  const questionScores = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i] || '';
    const answer = candidateAnswers[i] || '';
    const scores = await evaluateSingleAnswer(question, answer);
    questionScores.push({
      questionIndex: i,
      question: String(question),
      answer: String(answer),
      relevance: scores.relevance,
      depth: scores.depth,
      clarity: scores.clarity,
      professionalism: scores.professionalism,
      comment: scores.comment
    });
  }

  const totalScore = calculateTotalScore(questionScores);
  const summary = buildSummary(questionScores, totalScore);

  return {
    totalScore,
    questionScores,
    summary,
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  evaluateSingleAnswer,
  evaluateInterview
};
