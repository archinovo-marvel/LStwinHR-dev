# useSDKConnection 旧 interviewState 残余依赖评估

> 评估日期：2026-05-08
> 目标文件：client/src/components/VirtualHumanSDK/useSDKConnection.js

## 1. 评估结论

当前 useSDKConnection 对旧 interviewState 的残余依赖已经很窄，但尚未归零。

当前依赖点主要只有两类：

- 在 frame_start / frame_stop 期间维护 isAIResponding 等标记。
- 在日志中读取 interviewStateRef.current。

因此下一轮要彻底移除 useInterviewState，并不需要大规模重写 SDK 连接层，而是可以做一次小范围接口收敛。

## 2. 当前残余依赖位置

### 2.1 initializeSDK 仍要求注入旧状态

当前 initializeSDK 参数仍包含：

- interviewStateRef
- setInterviewState

这意味着 VirtualHumanSDK 在初始化 SDK 时，仍默认自己掌握一套面试流程状态。

### 2.2 frame_start 事件

当前逻辑会在 AI 开始播报时：

- setInterviewState(prev => ({ ...prev, isAIResponding: true }))

### 2.3 frame_stop 事件

当前逻辑会在播报结束时：

- 读取 interviewStateRef.current 仅用于日志
- setInterviewState(...) 更新 isAIResponding / isAIEvaluating 等标记

这些状态本质上已经不该由 SDK 连接层管理，而应由桥接层或主面试状态机解释。

## 3. 为什么现在还不能直接删除

虽然外部已经不再通过 VirtualHumanSDK 调用旧面试 API，但 useSDKConnection 内部还把“播报过程中的状态切换”绑在旧状态机上。

如果直接粗暴删除：

- frame_start / frame_stop 对 streaming 结束时机的协调可能丢失。
- 某些与 onVirtualHumanStreamingEnd 相关的时序可能变得不稳定。

所以建议下一轮采用“替换依赖”而不是“直接砍掉”。

## 4. 建议替换方向

### 4.1 用桥接层状态替代 interviewState

建议新增一组更窄的 bridge callbacks 传给 useSDKConnection：

- onSpeechStart
- onSpeechEnd
- onSpeechFinalized

这样 useSDKConnection 不需要知道：

- currentQuestionIndex
- isAIEvaluating
- isAutoQuestionEnabled
- isInterviewComplete

它只需要报告“数字人播报开始/结束”。

### 4.2 把 isAIResponding 迁移到 useVirtualHumanBridge

如果页面仍然需要这个状态，建议它属于 useVirtualHumanBridge，而不是 useInterviewState。

### 4.3 日志中移除 interviewStateRef

frame_stop 内的日志可以直接记录：

- latestNlpContentRef 长度
- 当前 SDK 事件类型
- 是否触发 onVirtualHumanStreamingEnd

无需继续打印 interviewStateRef.current。

## 5. 下一轮最小改造步骤

建议按以下顺序执行：

1. 在 useSDKConnection 中新增 onSpeechStart / onSpeechEnd 回调参数。
2. 将 frame_start / frame_stop 中对 setInterviewState 的操作替换为对 bridge callback 的调用。
3. 从 initializeSDK 参数中移除 interviewStateRef 和 setInterviewState。
4. 再从 VirtualHumanSDK 中移除 interviewHook 对 useSDKConnection 的传参。
5. 最后评估 useInterviewState 是否还需要继续存在。

## 6. 可删除判断标准

当以下条件全部满足时，useInterviewState 可以进入删除阶段：

1. useSDKConnection 不再接收 interviewStateRef 和 setInterviewState。
2. VirtualHumanSDK 不再向外暴露旧面试 API。
3. ChatPage 与 useVirtualHumanBridge 已完全承担主流程和桥接职责。

目前条件 2 已满足，条件 1 和 3 仍需继续推进。
