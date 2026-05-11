# 企业端面试访谈模块优化计划

基于审查报告，按优先级分4个阶段实施。已解决的问题已跳过。

---

## 阶段一：P1 关键功能修复（预计 2-3 天）

### 1.1 修复8维度评分计算 [P1-3.7]
**文件**: `client/src/utils/interviewScoring.js`

当前 `calculateScore` 仅使用4个维度（relevance, depth, clarity, professionalism），需扩展为8维度。

**改动**:
- 在 `calculateScore` 方法中增加 evidence, actionability, selfAwareness, growthMindset 四个维度的计算
- 更新权重分配: relevance×0.20 + depth×0.20 + clarity×0.15 + professionalism×0.15 + evidence×0.10 + actionability×0.08 + selfAwareness×0.07 + growthMindset×0.05
- 在 `analyzeDimension` 中为4个新维度添加分析逻辑
- 在 `dimensionKeywords` 中为4个新维度添加关键词映射
- **向后兼容**: 旧数据只有4维度时，缺失维度按默认分(60)填充

### 1.2 接入虚拟人面试模式 [P1-2.4]
**文件**: `client/src/pages/ChatPage.js`, `client/src/components/ChatPage/VirtualHumanPanel.jsx`

当前 VirtualHumanSDK 暴露了 startInterview/askQuestion 但从未被 ChatPage 调用。

**改动**:
- 在 ChatPage 中监听虚拟人连接状态
- 当虚拟人已连接且面试进行中 → 调用 `askQuestion(question)` 让虚拟人提问
- 当虚拟人断开 → 自动降级为 LLM 文本模式，显示提示
- 在 VirtualHumanPanel 中添加面试模式切换按钮
- 面试结束时调用 `endInterview()`

---

## 阶段二：P2 架构与安全修复（预计 2-3 天）

### 2.1 拆分 interviewScoring.js [P2-2.3]
**文件**: `client/src/utils/interviewScoring.js` (510行) → 拆分为模块

**目标结构**:
```
client/src/utils/interview/
├── scoringCriteria.js      // 权重、维度定义、默认分
├── dimensionAnalyzer.js    // 维度分析引擎
├── keywordAnalyzer.js      // 关键词匹配与否定检测
├── positionTemplates.js    // 岗位权重和题库
├── difficultyConfig.js     // 难度等级配置
├── reportGenerator.js      // 报告生成（录用建议、追问、背调）
└── index.js                // 统一导出，保持 InterviewScoring 接口不变
```

**关键**: `index.js` 重新导出 InterviewScoring 类，所有现有 import 无需修改。

### 2.2 Memory 切换确认弹窗 [P2-3.5]
**文件**: `client/src/pages/ChatPage.js`

**改动**:
- 在 `handleMemoryToggleChange` 中添加 `Modal.confirm`
- 面试进行中时提示："切换记忆模式可能影响面试上下文连续性，是否继续？"
- 非面试状态下简单确认即可

### 2.3 AI 超时时间调整 [P2-4.3]
**文件**: `server/services/interviewAnalysisService.js`

**改动**:
- `AI_TIMEOUT_MS` 从 5000ms 改为 30000ms
- 添加环境变量 `AI_TIMEOUT_MS` 支持自定义配置
- 区分本地模型和云端模型超时: 本地 30s，云端 15s

### 2.4 Chat API 添加认证 [P2-4.6]
**文件**: `routes/chat.routes.js`

**改动**:
- 在 `/message` 和 `/interview/*` 路由上添加 `authMiddleware`
- 从 `req.user` 获取用户信息用于日志记录
- 保持 `/health` 端点无需认证

---

## 阶段三：P3 代码质量修复（预计 1-2 天）

### 3.1 useInterviewState 闭包风险 [P3-3.4]
**文件**: `client/src/components/VirtualHumanSDK/useInterviewState.js`

**改动**:
- 添加 `const questionsRef = useRef(questions)` 并在 questions 变化时同步
- 在 `askQuestion` 等回调中从 `questionsRef.current` 读取，避免闭包陈旧

### 3.2 connectAvatar 依赖问题 [P3-4.2]
**文件**: `client/src/components/VirtualHumanSDK/VirtualHumanSDK.js`

**改动**:
- 使用 `useRef` 跟踪连接状态（isLoading, isConnected）
- `connectAvatar` 的 useCallback 依赖改为 ref，避免因状态变化导致回调重建

### 3.3 图片压缩 [P3-4.5]
**文件**: `client/src/pages/ChatPage.js`

**改动**:
- 发送图片前进行客户端压缩: 最大宽度 1920px，JPEG quality 0.7
- 使用 Canvas API 进行 resize
- 添加 `compressImage(file, maxWidth, quality)` 工具函数

### 3.4 删除废弃文件 [P3-3.1]
**文件**: `client/src/pages/InterviewPage.js`

**改动**:
- 确认无任何引用后删除 InterviewPage.js
- 同时清理相关 import 和路由配置

---

## 阶段四：低优先级优化（可选，预计 1 天）

### 4.1 命名规范化
- `reAskCurrentQuestion` → `reaskCurrentQuestion`

### 4.2 面试计时器
- 在 useInterview 中添加 elapsed time 跟踪
- ChatPage UI 显示已用时间

### 4.3 心跳保存
- 面试进行中每60秒自动保存进度到 localStorage
- 防止浏览器崩溃导致数据丢失

### 4.4 消息结构统一
- 统一 ChatPage 和旧 InterviewPage 的消息数据格式

---

## 实施顺序与依赖关系

```
阶段一 (P1)
  1.1 8维度评分 ← 无依赖，可独立开始
  1.2 虚拟人接入 ← 依赖 3.1 (闭包修复后更安全)

阶段二 (P2)
  2.1 拆分 scoring ← 依赖 1.1 (先修评分再拆分)
  2.2 确认弹窗 ← 无依赖
  2.3 超时调整 ← 无依赖
  2.4 API 认证 ← 无依赖

阶段三 (P3)
  3.1 闭包修复 ← 无依赖，建议提前
  3.2 连接状态 ← 无依赖
  3.3 图片压缩 ← 无依赖
  3.4 删除废弃 ← 无依赖

阶段四 (低优先级)
  4.1-4.4 ← 各自独立
```

**建议并行策略**:
- 阶段一的 1.1 和阶段三的 3.1/3.2/3.3/3.4 可并行
- 阶段二的 2.2/2.3/2.4 可并行
- 2.1 需等 1.1 完成后进行
