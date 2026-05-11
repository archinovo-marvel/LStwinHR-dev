# AI面试评分系统设计方案

## 背景

现有 `interviewScoring.js` 基于规则匹配（关键词、长度、结构化）评分，导致优秀回答得分偏低。

## 目标

用本地AI直接评判回答质量，替代规则匹配。

---

## 设计

### 核心逻辑

- 每道题单独调用AI评分（同步）
- AI返回4维度评分（JSON）
- 汇总计算面试总分

### 评分维度（每题0-10）

| 维度 | 说明 |
|------|------|
| relevance | 回答与问题的相关性 |
| depth | 回答深度和专业程度 |
| clarity | 表达清晰度 |
| completeness | 回答完整程度 |

### 计分公式

```
单题贡献分 = relevance + depth + clarity + completeness  (0-40)
面试总分 = (sum(单题贡献分) / 题目数 / 40) × 100  (0-100)
```

### 调用引擎

按现有 `chat.routes.js` 配置：
- 优先: qwen2-7b-gguf (8002端口)
- 备选: deepseek-r1:14b (Ollama)

### Prompt设计

```
你是专业AI面试评分员。请对以下问答进行评分。

问题：{question}
回答：{answer}

评分维度（每项0-10分）：
- relevance: 相关性
- depth: 深度
- clarity: 清晰度
- completeness: 完整性

请返回JSON：
{
  "relevance": 8,
  "depth": 9,
  "clarity": 7,
  "completeness": 8,
  "comment": "一句话评语"
}
```

### 容错

- 解析失败 → 每维度默认5分
- 超时（10秒）→ 默认分
- AI返回格式不对 → 降级默认分

### 数据存储

候选人数据新增字段：

```json
{
  "interviewAnalysis": {
    "totalScore": 85,
    "questionScores": [
      {
        "questionIndex": 0,
        "question": "问题文本",
        "answer": "回答文本",
        "relevance": 8,
        "depth": 9,
        "clarity": 7,
        "completeness": 8,
        "comment": "..."
      }
    ],
    "summary": "整体评价",
    "evaluatedAt": "ISO时间"
  }
}
```

### 综合分

`compositeScoreService.js` 保持不变，`interviewScore` 来源替换为AI评分结果。

---

## 实现步骤

1. 新建 `server/services/interviewAnalysisService.js`
   - `evaluateSingleAnswer(question, answer)` — 单题AI评分
   - `evaluateInterview(conversationData)` — 遍历所有问答，汇总总分

2. 修改 `client/src/utils/interviewScoring.js`
   - 新增 `analyzeWithAI(conversationData)` 方法
   - 保留原规则评分作备选（调试模式仍可用）

3. 修改面试结束逻辑
   - 访谈完成 → 调用AI评分 → 存入 `interviewAnalysis`

4. 更新候选人数据读取
   - `CandidateDetailModal` 展示AI评分结果
