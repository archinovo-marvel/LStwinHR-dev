# AI面试评分系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用本地AI替代规则匹配，对每道面试题进行多维度质量评分

**Architecture:** 每题单独调用AI（同步），返回4维度评分并解析入库。面试结束时触发评分流程，评分结果存入候选人数据 `interviewAnalysis` 字段。

**Tech Stack:** Node.js后端, Ollama/本地LLM, JSON解析

---

## 文件映射

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 创建 | `server/services/interviewAnalysisService.js` | AI调用、评分解析、结果汇总 |
| 修改 | `client/src/utils/interviewScoring.js` | 新增 `analyzeWithAI()` 方法 |
| 修改 | `client/src/utils/interviewStorage.js` | 访谈结束触发AI评分 |
| 修改 | `client/src/pages/InterviewPage.js` | 访谈完成时调用评分并存结果 |
| 修改 | `client/src/components/CandidateDetailModal/CandidateDetailModal.js` | 展示AI评分结果 |

---

## Task 1: 创建 interviewAnalysisService.js

**文件:**
- 创建: `server/services/interviewAnalysisService.js`

- [ ] **Step 1: 编写基础框架**

```javascript
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://host.docker.internal:8002';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2-7b-gguf';

class InterviewAnalysisService {
  // 单题AI评分
  async evaluateSingleAnswer(question, answer) {
    // 调用AI，返回 { relevance, depth, clarity, completeness, comment }
  }

  // 面试整体评分
  async evaluateInterview(conversationData) {
    // 遍历所有问答，调用 evaluateSingleAnswer，汇总结果
  }

  // 内部: 调用本地模型
  async callLocalModel(prompt) {
    // 参考 chat.routes.js 的 streamLocalModelResponse，使用同步方式
  }

  // 内部: 调用Ollama
  async callOllama(prompt) {
    // 参考 chat.routes.js 的 streamOllamaResponse，适配同步
  }
}

module.exports = new InterviewAnalysisService();
```

- [ ] **Step 2: 实现 evaluateSingleAnswer**

Prompt:
```
你是专业AI面试评分员。请对以下问答进行评分。

问题：{question}
回答：{answer}

评分维度（每项0-10分）：
- relevance: 相关性（回答是否切题）
- depth: 深度（是否有专业深度）
- clarity: 清晰度（表达是否清晰流畅）
- completeness: 完整性（回答是否完整）

请返回纯JSON（无markdown）：
{"relevance":8,"depth":9,"clarity":7,"completeness":8,"comment":"一句话评语"}
```

- [ ] **Step 3: 实现 callLocalModel（同步）**

```javascript
async callLocalModel(prompt) {
  const response = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LOCAL_LLM_MODEL,
      stream: false,
      max_tokens: 256,
      temperature: 0.1,
      messages: [
        { role: 'system', content: '你是专业AI面试评分员，直接返回JSON，不要多余内容。' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`LLM请求失败: ${response.status}`);
  const result = await response.json();
  return result?.choices?.[0]?.message?.content || '';
}
```

- [ ] **Step 4: 实现 evaluateInterview**

```javascript
async evaluateInterview(conversationData) {
  const questions = conversationData.questions || [];
  const answers = conversationData.candidateAnswers || [];
  const questionScores = [];
  let totalRawScore = 0;

  for (let i = 0; i < answers.length; i++) {
    const q = questions[i] || '';
    const a = answers[i] || '';
    const score = await this.evaluateSingleAnswer(q, a);
    questionScores.push({ questionIndex: i, question: q, answer: a, ...score });
    totalRawScore += score.relevance + score.depth + score.clarity + score.completeness;
  }

  const totalScore = answers.length > 0
    ? Math.round((totalRawScore / answers.length / 40) * 100)
    : 0;

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    questionScores,
    summary: `共${answers.length}题，整体得分${totalScore}分`,
    evaluatedAt: new Date().toISOString()
  };
}
```

- [ ] **Step 5: 实现容错解析**

`evaluateSingleAnswer` 末尾：
```javascript
// 解析JSON，失败则降级默认分
try {
  const text = rawContent.replace(/```json\n?|```\n?/g, '').trim();
  return JSON.parse(text);
} catch (e) {
  return { relevance: 5, depth: 5, clarity: 5, completeness: 5, comment: '评分解析失败，使用默认分' };
}
```

- [ ] **Step 6: 提交**

```bash
git add server/services/interviewAnalysisService.js
git commit -m "feat: add interviewAnalysisService with AI scoring"
```

---

## Task 2: 修改 interviewScoring.js

**文件:**
- 修改: `client/src/utils/interviewScoring.js`

- [ ] **Step 1: 新增 analyzeWithAI 方法**

在 `analyzeInterviewConversation` 方法后添加：

```javascript
// AI评分入口（新增）
async analyzeWithAI(conversationData) {
  try {
    const response = await fetch('/api/interview/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversationData)
    });
    if (!response.ok) throw new Error('AI评分请求失败');
    const result = await response.json();
    return {
      totalScore: result.totalScore,
      categoryScores: {
        answerQuality: { score: result.totalScore * 0.4, rawScore: result.totalScore / 2.5 },
        communication: { score: result.totalScore * 0.25, rawScore: result.totalScore / 4 },
        professionalism: { score: result.totalScore * 0.2, rawScore: result.totalScore / 5 },
        attitude: { score: result.totalScore * 0.15, rawScore: result.totalScore / 6.67 }
      },
      questionScores: result.questionScores,
      summary: result.summary,
      aiEvaluated: true
    };
  } catch (e) {
    // 降级到规则评分
    return this.analyzeInterviewConversation(conversationData);
  }
}
```

- [ ] **Step 2: 确认调用端点**

检查 `server.js` 是否已有 `/api/interview/analyze` 路由。如果没有，需在 `server.js` 添加：

```javascript
const interviewAnalysisService = require('./services/interviewAnalysisService');

app.post('/api/interview/analyze', async (req, res) => {
  try {
    const result = await interviewAnalysisService.evaluateInterview(req.body);
    res.json(result);
  } catch (e) {
    console.error('AI评分失败:', e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 3: 提交**

```bash
git add client/src/utils/interviewScoring.js server.js
git commit -m "feat: integrate AI scoring into interviewScoring"
```

---

## Task 3: 访谈结束触发评分

**文件:**
- 修改: `client/src/pages/InterviewPage.js`

- [ ] **Step 1: 找到访谈结束逻辑**

在 `InterviewPage.js` 中搜索 `onInterviewComplete` 或 `handleFinish` 相关逻辑。

- [ ] **Step 2: 在访谈结束时调用AI评分**

```javascript
// 原有访谈结束逻辑后添加：
const handleInterviewComplete = async (conversationData) => {
  // 原有逻辑...

  // AI评分
  const scoring = new InterviewScoring();
  const aiResult = await scoring.analyzeWithAI(conversationData);

  // 存入候选人数据
  if (candidateId && aiResult.questionScores) {
    await saveCandidateInterviewAnalysis(candidateId, {
      totalScore: aiResult.totalScore,
      questionScores: aiResult.questionScores,
      summary: aiResult.summary,
      evaluatedAt: new Date().toISOString()
    });
  }
};
```

- [ ] **Step 3: 提交**

```bash
git add client/src/pages/InterviewPage.js
git commit -m "feat: trigger AI scoring on interview complete"
```

---

## Task 4: 展示AI评分结果

**文件:**
- 修改: `client/src/components/CandidateDetailModal/CandidateDetailModal.js`

- [ ] **Step 1: 在候选人详情中展示 interviewAnalysis**

在展示区域添加：

```jsx
{candidate.interviewAnalysis && (
  <div className="interview-analysis">
    <h4>AI面试评分</h4>
    <div>总分: {candidate.interviewAnalysis.totalScore}</div>
    {candidate.interviewAnalysis.questionScores?.map((q, i) => (
      <div key={i} className="question-score">
        <div>Q{i+1}: {q.question}</div>
        <div>相关性:{q.relevance} 深度:{q.depth} 清晰:{q.clarity} 完整:{q.completeness}</div>
        <div>评语: {q.comment}</div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: 提交**

```bash
git add client/src/components/CandidateDetailModal/CandidateDetailModal.js
git commit -m "feat: display AI interview scores in candidate detail"
```

---

## 自检清单

- [ ] Task 1: `evaluateSingleAnswer` 解析JSON失败降级默认分
- [ ] Task 1: `evaluateInterview` 计算公式正确 `totalRawScore / n / 40 * 100`
- [ ] Task 2: API端点 `/api/interview/analyze` 已注册
- [ ] Task 2: `analyzeWithAI` 失败时降级到原规则评分
- [ ] Task 3: `saveCandidateInterviewAnalysis` 正确保存到候选人数据
- [ ] Task 4: `interviewAnalysis` 字段正确读取并渲染
