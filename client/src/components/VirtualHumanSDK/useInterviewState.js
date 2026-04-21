import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Interview State Hook
 * Manages the interview state machine, questions, and flow
 */

// 默认面试问题列表（确保至少12个）
const defaultInterviewQuestions = [
  "请做一个简单的自我介绍。",
  "谈谈您求学经历中令您感到成功的事例及成功的因素。",
  "你如何看待加班？",
  "你未来3-5年的职业规划是什么？",
  "你有什么问题想问我们吗？",
  "请描述一个你过去处理过的棘手项目以及你是如何解决的。",
  "你认为自己的最大优势和需要改进的地方是什么？",
  "请举例说明你是如何处理团队冲突的？",
  "你为什么选择应聘这个岗位？",
  "你如何看待工作压力？",
  "请描述一次你主动学习新技能的经历。",
  "你对薪资待遇有什么期望？"
];

/**
 * Hook for interview state management
 */
export const useInterviewState = ({
  externalInterviewQuestions,
  avatarPlatformRef,
  onVirtualHumanReply,
  onVirtualHumanReplyRef,
}) => {
  const [interviewState, setInterviewState] = useState({
    currentQuestionIndex: 0,
    isWaitingForAnswer: false,
    isAIResponding: false,
    isInterviewComplete: false,
    isAutoQuestionEnabled: false,
    isAIEvaluating: false // 新增：AI是否在给出评价
  });
  const interviewStateRef = useRef(interviewState);

  useEffect(() => {
    interviewStateRef.current = interviewState;
  }, [interviewState]);

  // 使用外部传入的问题或默认问题
  const interviewQuestions = externalInterviewQuestions && externalInterviewQuestions.length > 0
    ? externalInterviewQuestions
    : defaultInterviewQuestions;

  // 面试相关功能函数
  const askQuestion = useCallback(async (questionIndex, options = {}) => {
    const force = options.force === true;

    if (!avatarPlatformRef.current) {
      console.warn('❌ 虚拟人未连接，无法提问');
      return false;
    }

    if (questionIndex >= interviewQuestions.length) {
      console.log('面试问题已全部问完');
      setInterviewState(prev => ({
        ...prev,
        isWaitingForAnswer: false,
        isInterviewComplete: true
      }));
      return false;
    }

    const question = interviewQuestions[questionIndex];
    console.log(`🎯 发送面试问题 ${questionIndex + 1}: ${question}`, { force });

    setInterviewState(prev => ({
      ...prev,
      currentQuestionIndex: questionIndex,
      isWaitingForAnswer: true,
      isAIEvaluating: false
    }));

    try {
      // 直接使用面试问题文本
      const interviewQuestionText = question;

      // 先等待一下，确保上一个消息完全处理完成
      if (!force) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 先在页面上显示问题消息
      if (onVirtualHumanReplyRef.current) {
        onVirtualHumanReplyRef.current(interviewQuestionText);
      }

      await avatarPlatformRef.current.writeText(interviewQuestionText, {
        nlp: false, // 关闭语义理解，只进行文本播报
        avatar_dispatch: {
          interactive_mode: 1 // 打断模式
        }
      });
      console.log('✅ 面试问题发送成功');

      // 问题发送完成后，重置AI回答状态
      setInterviewState(prev => ({
        ...prev,
        isAIResponding: false,
        isWaitingForAnswer: true
      }));
      return true;
    } catch (error) {
      console.error('❌ 发送面试问题失败:', error);
      setInterviewState(prev => ({
        ...prev,
        isWaitingForAnswer: false
      }));
      return false;
    }
  }, [avatarPlatformRef, interviewQuestions, onVirtualHumanReplyRef]);

  const handleNextQuestion = useCallback((options = {}) => {
    const force = options.force === true;
    console.log('🎯 handleNextQuestion 被调用');
    const currentState = interviewStateRef.current;

    // 防止重复调用
    if (currentState.isAIResponding && !force) {
      console.log('🎯 AI正在回答中，跳过handleNextQuestion调用');
      return false;
    }

    const nextIndex = (currentState.currentQuestionIndex || 0) + 1;
    console.log(`🎯 当前问题索引: ${currentState.currentQuestionIndex}, 下一个索引: ${nextIndex}, 总问题数: ${interviewQuestions.length}`);

    if (nextIndex < interviewQuestions.length) {
      console.log(`⏭️ 准备发送下一个问题 (${nextIndex + 1}/${interviewQuestions.length})`);

      // 设置AI回答状态，防止重复调用
      setInterviewState(prev => ({
        ...prev,
        isAIEvaluating: false,
        isAIResponding: true
      }));

      // 延迟发送下一个问题，给用户时间阅读
      setTimeout(() => {
        console.log(`🎯 开始发送下一个问题: ${interviewQuestions[nextIndex]}`);
        askQuestion(nextIndex, { force: true });
      }, force ? 0 : 1000); // 手动点击时立即推进，自动流程保留缓冲
      return true;
    } else {
      // 面试结束，发送感谢结束语
      console.log('🎉 面试问题已全部完成，发送结束语');
      setInterviewState(prev => ({
        ...prev,
        isWaitingForAnswer: false,
        isInterviewComplete: true,
        isAIEvaluating: false,
        isAIResponding: false
      }));

      // 发送感谢结束语
      const closingMessage = '感谢您参与本次面试，您的回答已记录。如果您的成绩符合我们的要求，我们会在近期联系您进行下一轮沟通。祝您求职顺利！';
      if (onVirtualHumanReplyRef.current) {
        onVirtualHumanReplyRef.current(closingMessage);
      }

      return false;
    }
  }, [askQuestion, interviewQuestions]);

  const reAskCurrentQuestion = useCallback(() => {
    const currentIndex = interviewStateRef.current.currentQuestionIndex || 0;
    return askQuestion(currentIndex, { force: true });
  }, [askQuestion]);

  // 开始面试
  const startInterview = useCallback(() => {
    console.log('🚀 开始面试');
    setInterviewState(prev => ({
      ...prev,
      currentQuestionIndex: 0,
      isWaitingForAnswer: false,
      isAIResponding: false,
      isInterviewComplete: false,
      isAutoQuestionEnabled: true
    }));
    askQuestion(0, { force: true });
  }, [askQuestion]);

  // 停止面试
  const stopInterview = useCallback(() => {
    console.log('⏹️ 停止面试');
    setInterviewState(prev => ({
      ...prev,
      isWaitingForAnswer: false,
      isAutoQuestionEnabled: false
    }));
  }, []);

  // 处理面试者回答完成
  const handleCandidateAnswerComplete = useCallback(() => {
    console.log('👤 面试者回答完成，设置AI评价状态');
    if (interviewState.isAutoQuestionEnabled && !interviewState.isInterviewComplete) {
      // 设置AI评价状态，等待AI完成评价
      setInterviewState(prev => ({
        ...prev,
        isAIEvaluating: true,
        isWaitingForAnswer: false
      }));

      // 不在这里设置自动进入下一个问题，而是等待AI真正完成评价
      console.log('⏳ 等待AI完成评价，不自动进入下一个问题');
    }
  }, [interviewState.isAutoQuestionEnabled, interviewState.isInterviewComplete]);

  // 添加全局用户交互监听器
  useEffect(() => {
    const handleGlobalInteraction = async () => {
      // This effect is handled in the main component
      // since it needs access to resumePlayback
    };

    return () => {};
  }, []);

  return {
    interviewState,
    interviewStateRef,
    setInterviewState,
    interviewQuestions,
    askQuestion,
    handleNextQuestion,
    reAskCurrentQuestion,
    startInterview,
    stopInterview,
    handleCandidateAnswerComplete,
  };
};

export default useInterviewState;
