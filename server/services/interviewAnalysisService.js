'use strict';

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://host.docker.internal:8002';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2-7b-gguf';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:14b';

const AI_TIMEOUT_MS = 10000;
const DEFAULT_DIMENSION_SCORE = 5;

const SYSTEM_PROMPT = '你是专业AI面试评分员。请对以下问答进行评分。\n\n问题：{question}\n回答：{answer}\n\n评分维度（每项0-10分）：\n- relevance: 相关性（回答是否切题）\n- depth: 深度（是否有专业深度）\n- clarity: 清晰度（表达是否清晰流畅）\n- completeness: 完整性（回答是否完整）\n\n请返回纯JSON（无markdown）：\n{"relevance":8,"depth":9,"clarity":7,"completeness":8,"comment":"一句话评语"}';

function buildEvalPrompt(question, answer) {
  return SYSTEM_PROMPT
    .replace('{question}', question)
    .replace('{answer}', answer);
}

function getDefaultScores() {
  return {
    relevance: DEFAULT_DIMENSION_SCORE,
    depth: DEFAULT_DIMENSION_SCORE,
    clarity: DEFAULT_DIMENSION_SCORE,
    completeness: DEFAULT_DIMENSION_SCORE,
    comment: '评分服务异常，使用默认分'
  };
}

function parseAIResponse(text) {
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.relevance !== 'number' || typeof parsed.depth !== 'number' ||
        typeof parsed.clarity !== 'number' || typeof parsed.completeness !== 'number') {
      return null;
    }
    return {
      relevance: Math.max(0, Math.min(10, Math.round(parsed.relevance))),
      depth: Math.max(0, Math.min(10, Math.round(parsed.depth))),
      clarity: Math.max(0, Math.min(10, Math.round(parsed.clarity))),
      completeness: Math.max(0, Math.min(10, Math.round(parsed.completeness))),
      comment: String(parsed.comment || '无评语').slice(0, 200)
    };
  } catch {
    return null;
  }
}

async function callLocalModel(question, answer) {
  const prompt = buildEvalPrompt(question, answer);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
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
    });
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
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.1 },
        prompt
      }),
      signal: controller.signal
    });
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

function calculateSingleQuestionScore(scores) {
  const { relevance, depth, clarity, completeness } = scores;
  return (relevance + depth + clarity + completeness) / 4;
}

function calculateTotalScore(questionScores) {
  if (!questionScores || questionScores.length === 0) return 0;
  const totalContributions = questionScores.reduce((sum, qs) => sum + calculateSingleQuestionScore(qs), 0);
  return Math.round((totalContributions / questionScores.length / 40) * 100);
}

function buildSummary(questionScores, totalScore) {
  if (!questionScores || questionScores.length === 0) {
    return '面试评分完成，未提供有效问答数据。';
  }
  const avgDepth = questionScores.reduce((sum, qs) => sum + (qs.depth || 0), 0) / questionScores.length;
  const avgCompleteness = questionScores.reduce((sum, qs) => sum + (qs.completeness || 0), 0) / questionScores.length;
  const strengths = [];
  const concerns = [];
  if (avgDepth >= 7) strengths.push('专业深度较好');
  else if (avgDepth < 4) concerns.push('专业深度有待加强');
  if (avgCompleteness >= 7) strengths.push('回答完整性较高');
  else if (avgCompleteness < 4) concerns.push('部分问题回答不够完整');
  const strengthStr = strengths.length > 0 ? strengths.join('，') + '。' : '';
  const concernStr = concerns.length > 0 ? '建议：' + concerns.join('，') + '。' : '';
  return `面试总分${totalScore}分。${strengthStr}${concernStr}`.trim();
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
      completeness: scores.completeness,
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
