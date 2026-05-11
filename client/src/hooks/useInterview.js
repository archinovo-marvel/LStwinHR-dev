import { useState, useRef, useCallback, useReducer, useEffect } from 'react';
import InterviewStorage from '../utils/interviewStorage';
import InterviewScoring, { extractResumeSummary, extractPositionInfo } from '../utils/interviewScoring';

const SESSION_HEARTBEAT_INTERVAL_MS = 30000;

// ========================================
// P0-1: 面试状态机 — 从 ChatPage 巨型组件抽离
// ========================================

const ACTIONS = {
  SELECT_CANDIDATE: 'SELECT_CANDIDATE',
  START_INTERVIEW: 'START_INTERVIEW',
  QUESTION_LOADING: 'QUESTION_LOADING',
  QUESTION_READY: 'QUESTION_READY',
  ANSWER_SUBMITTED: 'ANSWER_SUBMITTED',
  NEXT_QUESTION_LOADING: 'NEXT_QUESTION_LOADING',
  NEXT_QUESTION_READY: 'NEXT_QUESTION_READY',
  SCORING_START: 'SCORING_START',
  SCORING_DONE: 'SCORING_DONE',
  END_INTERVIEW: 'END_INTERVIEW',
  RESET: 'RESET',
  RECOVER_SESSION: 'RECOVER_SESSION',
  DISMISS_RECOVERY: 'DISMISS_RECOVERY',
};

function createInitialState() {
  return {
    phase: 'idle',
    candidate: null,
    currentQuestionIndex: -1,
    currentQuestionText: '',
    isWaitingForAnswer: false,
    totalQuestions: 12,
    scoring: null,
    hasRecoverableSession: false,
    recoverableSession: null,
  };
}

function getSessionSyncTimestamp(session) {
  if (!session) return 0;
  const timestamp = session.updatedAt
    || session.metadata?.lastSyncedAt
    || session.metadata?.lastHeartbeatAt
    || session.startTime;
  return timestamp ? new Date(timestamp).getTime() : 0;
}

function getRecoverableSessionProgress(session) {
  if (!session) {
    return {
      answersCount: 0,
      questionCount: 0,
      currentQuestionIndex: -1,
    };
  }

  return {
    answersCount: session.conversation?.candidateAnswers?.length || session.metadata?.totalAnswers || 0,
    questionCount: session.conversation?.questions?.length || 0,
    currentQuestionIndex: Number.isInteger(session.metadata?.currentQuestionIndex)
      ? session.metadata.currentQuestionIndex
      : -1,
  };
}

function choosePreferredRecoverableSession(currentSession, incomingSession) {
  if (!currentSession) return incomingSession;
  if (!incomingSession) return currentSession;

  const currentProgress = getRecoverableSessionProgress(currentSession);
  const incomingProgress = getRecoverableSessionProgress(incomingSession);

  if (incomingProgress.answersCount !== currentProgress.answersCount) {
    return incomingProgress.answersCount > currentProgress.answersCount
      ? incomingSession
      : currentSession;
  }

  if (incomingProgress.currentQuestionIndex !== currentProgress.currentQuestionIndex) {
    return incomingProgress.currentQuestionIndex > currentProgress.currentQuestionIndex
      ? incomingSession
      : currentSession;
  }

  if (incomingProgress.questionCount !== currentProgress.questionCount) {
    return incomingProgress.questionCount > currentProgress.questionCount
      ? incomingSession
      : currentSession;
  }

  return getSessionSyncTimestamp(incomingSession) >= getSessionSyncTimestamp(currentSession)
    ? incomingSession
    : currentSession;
}

function interviewReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SELECT_CANDIDATE:
      return { ...state, candidate: action.payload, phase: 'idle' };

    case ACTIONS.START_INTERVIEW:
      return {
        ...state,
        phase: 'active',
        totalQuestions: action.payload.totalQuestions || state.totalQuestions,
        currentQuestionIndex: -1,
        currentQuestionText: '',
        isWaitingForAnswer: false,
        scoring: null,
      };

    case ACTIONS.QUESTION_LOADING:
      return {
        ...state,
        currentQuestionText: '',
        isWaitingForAnswer: false,
      };

    case ACTIONS.QUESTION_READY:
      return {
        ...state,
        currentQuestionIndex: action.payload.index,
        currentQuestionText: action.payload.question,
        isWaitingForAnswer: true,
      };

    case ACTIONS.ANSWER_SUBMITTED:
      return { ...state, isWaitingForAnswer: false };

    case ACTIONS.NEXT_QUESTION_LOADING:
      return { ...state, currentQuestionText: '', isWaitingForAnswer: false };

    case ACTIONS.NEXT_QUESTION_READY:
      return {
        ...state,
        currentQuestionIndex: action.payload.index,
        currentQuestionText: action.payload.question,
        isWaitingForAnswer: true,
      };

    case ACTIONS.SCORING_START:
      return { ...state, phase: 'scoring', isWaitingForAnswer: false };

    case ACTIONS.SCORING_DONE:
      return { ...state, scoring: action.payload };

    case ACTIONS.END_INTERVIEW:
      return {
        ...state,
        phase: 'completed',
        isWaitingForAnswer: false,
        scoring: action.payload.scoring || state.scoring,
      };

    case ACTIONS.RESET:
      return {
        ...createInitialState(),
        hasRecoverableSession: state.hasRecoverableSession,
        recoverableSession: state.recoverableSession,
      };

    case ACTIONS.RECOVER_SESSION:
      return {
        ...state,
        hasRecoverableSession: true,
        recoverableSession: action.payload,
      };

    case ACTIONS.DISMISS_RECOVERY:
      return {
        ...state,
        hasRecoverableSession: false,
        recoverableSession: null,
      };

    default:
      return state;
  }
}

/**
 * useInterview — 企业端面试状态机 hook
 *
 * @param {Function} options.fetchLLMReply
 * @param {Function} options.addBotMessage
 * @param {Function} options.setIsLoading
 * @param {Function} options.setStreamingMessage
 * @param {Function} options.setShowActiveReplyBubble
 */
export function useInterview({
  fetchLLMReply,
  addBotMessage,
  setIsLoading,
  setStreamingMessage,
  setShowActiveReplyBubble,
}) {
  const [state, dispatch] = useReducer(interviewReducer, null, createInitialState);
  const interviewStorage = useRef(new InterviewStorage());
  const interviewScoringSystem = useRef(new InterviewScoring());
  const completionPromiseRef = useRef(null);

  // 派生值
  const isActive = state.phase === 'active';
  const isScoring = state.phase === 'scoring';
  const isCompleted = state.phase === 'completed';
  const isIdle = state.phase === 'idle';
  const isAnyActive = isActive || isScoring;

  const progressText = isActive
    ? `问题: ${state.currentQuestionIndex + 1} / ${state.totalQuestions}`
    : '';

  const statusText = (() => {
    if (isScoring) return '生成报告中';
    if (!isActive) return '';
    return state.isWaitingForAnswer ? '等待回答' : '生成问题中';
  })();

  const statusColor = state.isWaitingForAnswer ? '#faad14' : '#52c41a';

  const truncatePromptText = useCallback((value, maxLength = 600) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }, []);

  const hasPendingCurrentAnswer = useCallback(() => {
    const session = interviewStorage.current.getCurrentSession();
    const answerCount = session?.conversation?.candidateAnswers?.length || 0;
    return state.isWaitingForAnswer && state.currentQuestionIndex >= answerCount;
  }, [state.currentQuestionIndex, state.isWaitingForAnswer]);

  const getCurrentUserInfo = useCallback(() => {
    try {
      const rawUser = localStorage.getItem('user');
      return rawUser ? JSON.parse(rawUser) : null;
    } catch {
      return null;
    }
  }, []);

  const updateSessionMetadata = useCallback((session, metadataPatch = {}) => {
    if (!session) return null;
    const nextSession = {
      ...session,
      metadata: {
        ...(session.metadata || {}),
        ...metadataPatch,
      },
      updatedAt: new Date().toISOString(),
    };
    interviewStorage.current.updateCurrentSession(nextSession);
    return nextSession;
  }, []);

  const syncSessionCheckpoint = useCallback(async (reason, options = {}) => {
    const token = localStorage.getItem('token');
    const currentUser = getCurrentUserInfo();
    if (!token || !currentUser?.id) return null;

    const baseSession = options.session || interviewStorage.current.getCurrentSession();
    if (!baseSession?.id) return null;

    const now = new Date().toISOString();
    const mergedSession = {
      ...baseSession,
      status: options.status || baseSession.status || 'in_progress',
      scoring: options.scoring !== undefined ? options.scoring : (baseSession.scoring || null),
      metadata: {
        ...(baseSession.metadata || {}),
        ...(options.metadata || {}),
        lastSyncedAt: now,
        lastSyncReason: reason,
        clientPhase: options.clientPhase || state.phase,
      },
      updatedAt: now,
    };

    if (mergedSession.id === interviewStorage.current.getCurrentSession()?.id) {
      interviewStorage.current.updateCurrentSession(mergedSession);
    }

    const payload = {
      id: mergedSession.id,
      ownerUserId: currentUser.id,
      candidateId: mergedSession.candidateId,
      candidateName: mergedSession.candidateName,
      position: mergedSession.position,
      status: mergedSession.status,
      conversation: options.includeConversation === false ? undefined : mergedSession.conversation,
      scoring: options.includeScoring === false
        ? undefined
        : (options.scoring !== undefined ? options.scoring : mergedSession.scoring),
      metadata: mergedSession.metadata,
      startTime: mergedSession.startTime,
      endTime: options.endTime || mergedSession.endTime || null,
      createdAt: mergedSession.createdAt || mergedSession.startTime || now,
      updatedAt: now,
    };

    try {
      const axios = (await import('axios')).default;
      if (options.create) {
        await axios.post('/api/interview-sessions', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.patch(`/api/interview-sessions/${mergedSession.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      return mergedSession;
    } catch (error) {
      console.warn(`面试会话同步失败(${reason}):`, error);
      return null;
    }
  }, [getCurrentUserInfo, state.phase]);

  // 从 AI 输出中提取纯问题
  const extractQuestion = useCallback((rawText) => {
    if (!rawText) return '';
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const questionLine = lines.find(l => l.includes('？') || l.includes('?'));
    if (questionLine) return questionLine;
    return lines[lines.length - 1] || rawText;
  }, []);

  // 固定12题（4维度 x 3题），不再根据工作年限动态调整
  const resolveQuestionCount = useCallback(() => 12, []);

  // P2-2: 检查可恢复的面试会话
  const checkRecoverableSession = useCallback(async () => {
    const existing = interviewStorage.current.getCurrentSession();
    const hasLocalRecovery = existing
      && existing.status === 'in_progress'
      && existing.conversation?.candidateAnswers?.length > 0;

    let preferredSession = hasLocalRecovery ? existing : null;

    const token = localStorage.getItem('token');
    const currentUser = getCurrentUserInfo();
    if (token && currentUser?.id) {
      try {
        const axios = (await import('axios')).default;
        const response = await axios.get('/api/interview-sessions/current', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const backendSession = response?.data?.session || null;
        const hasBackendRecovery = backendSession
          && backendSession.status === 'in_progress'
          && backendSession.conversation?.candidateAnswers?.length > 0;

        if (hasBackendRecovery) {
          const nextPreferredSession = choosePreferredRecoverableSession(preferredSession, backendSession);
          if (nextPreferredSession === backendSession) {
            interviewStorage.current.updateCurrentSession(backendSession);
          }
          preferredSession = nextPreferredSession;
        }
      } catch (error) {
        console.warn('获取后端可恢复面试会话失败:', error);
      }
    }

    if (preferredSession) {
      dispatch({ type: ACTIONS.RECOVER_SESSION, payload: preferredSession });
      return preferredSession;
    }

    return null;
  }, [getCurrentUserInfo]);

  const dismissRecovery = useCallback(() => {
    interviewStorage.current.clearCurrentSession();
    dispatch({ type: ACTIONS.DISMISS_RECOVERY });
  }, []);

  // 恢复面试
  const recoverSession = useCallback(async (session) => {
    if (!session) return;
    dispatch({ type: ACTIONS.DISMISS_RECOVERY });
    dispatch({
      type: ACTIONS.START_INTERVIEW,
      payload: { totalQuestions: session.metadata?.totalQuestions || 12 },
    });
    // 重放已有对话
    const conversation = session.conversation || {};
    const questions = conversation.questions || [];
    const answers = conversation.candidateAnswers || [];
    for (let i = 0; i < Math.max(questions.length, answers.length); i++) {
      if (questions[i]) addBotMessage(questions[i].question || `第${i + 1}题`);
    }
    const lastIdx = Math.max(0, answers.length - 1);
    dispatch({
      type: ACTIONS.QUESTION_READY,
      payload: { index: lastIdx, question: questions[lastIdx]?.question || '面试已恢复' },
    });
  }, [addBotMessage]);

  // 开始面试
  const startInterview = useCallback(async (candidate) => {
    const totalQuestions = resolveQuestionCount(candidate);
    dispatch({ type: ACTIONS.SELECT_CANDIDATE, payload: candidate });

    const startedSession = interviewStorage.current.startSession({
      id: Date.now(),
      candidateId: candidate?.id,
      candidateName: candidate?.name,
      position: candidate?.position,
    });

    updateSessionMetadata(startedSession, {
      totalQuestions,
      currentQuestionIndex: -1,
      lastHeartbeatAt: new Date().toISOString(),
    });

    await syncSessionCheckpoint('start_interview', {
      session: interviewStorage.current.getCurrentSession(),
      create: true,
      metadata: {
        totalQuestions,
        currentQuestionIndex: -1,
      },
      clientPhase: 'preparing',
    });

    dispatch({ type: ACTIONS.START_INTERVIEW, payload: { totalQuestions } });

    setIsLoading(true);
    setShowActiveReplyBubble(true);
    setStreamingMessage('正在生成面试问题...');

    try {
      const prompt = interviewScoringSystem.current.buildDimensionQuestionPrompt(
        'iq', 0,
        extractResumeSummary(candidate),
        extractPositionInfo(candidate),
        []
      );

      const { text: questionText } = await fetchLLMReply(prompt, {
        mode: 'interview',
        onChunk: setStreamingMessage,
      });

      const cleanQuestion = extractQuestion(questionText);
      addBotMessage(cleanQuestion);
      interviewStorage.current.addQuestion(cleanQuestion, 'iq');
      updateSessionMetadata(interviewStorage.current.getCurrentSession(), {
        totalQuestions,
        currentQuestionIndex: 0,
      });

      await syncSessionCheckpoint('question_generated', {
        metadata: {
          totalQuestions,
          currentQuestionIndex: 0,
        },
        clientPhase: 'waiting_answer',
      });

      dispatch({
        type: ACTIONS.QUESTION_READY,
        payload: { index: 0, question: cleanQuestion },
      });
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
    }
  }, [
    fetchLLMReply, addBotMessage, setIsLoading, setStreamingMessage,
    setShowActiveReplyBubble, extractQuestion, resolveQuestionCount,
  ]);

  // P1-1 + P0-2: 实时评分 — 8维度 + await
  const rateAnswerWithAI = useCallback(async (question, answer, questionIndex, answerId = null) => {
    try {
      const candidate = state.candidate;
      const isIQ = questionIndex < 3;
      const dimLabel = questionIndex < 3 ? 'IQ(智商-专业知识)' :
        questionIndex < 6 ? 'EQ(情商)' :
        questionIndex < 9 ? 'AQ(逆商)' : 'MQ(德商)';
      const resumeSummary = truncatePromptText(extractResumeSummary(candidate), 600);
      const positionInfo = extractPositionInfo(candidate);
      const compactQuestion = truncatePromptText(question, 220);
      const compactAnswer = truncatePromptText(answer, 800);

      let scoringGuide = '';
      if (isIQ) {
        scoringGuide = `当前题目属于IQ维度，考察专业知识和经验真实度。
【简历摘要】${resumeSummary || '暂无'}
【目标岗位】${positionInfo.positionName}
评分标准：8-10分专业扎实经验可信；4-7分基本知识细节不够；0-3分知识薄弱`;
      } else {
        const rubricIndex = questionIndex < 6 ? questionIndex - 3 :
          questionIndex < 9 ? questionIndex - 6 : questionIndex - 9;
        const rubricKey = questionIndex < 6 ? `eq${rubricIndex + 1}` :
          questionIndex < 9 ? `aq${rubricIndex + 1}` : `mq${rubricIndex + 1}`;
        const rubrics = interviewScoringSystem.current.dimensionRubrics[rubricKey] || [];
        const rubricText = rubrics.map(r => `${r.range[0]}-${r.range[1]}分：${r.desc}`).join('\n');
        scoringGuide = `当前题目属于${dimLabel}维度。\n评分标准：\n${rubricText || '8-10：具体细节深刻反思；4-7：基本描述部分反思；0-3：回避缺乏反思'}`;
      }

      const prompt = `你是面试评估专家。请评分并给出简短评语。

问题：${compactQuestion}
回答：${compactAnswer}

评分维度（每项1-10分，10最优）：
1.relevance 2.depth 3.clarity 4.professionalism 5.evidence 6.actionability 7.selfAwareness 8.growthMindset

${scoringGuide}

严格按格式输出：
评分：{r}|{d}|{c}|{p}|{e}|{a}|{s}|{g}
评语：{2-3句话}`;

      const { text } = await fetchLLMReply(prompt, { mode: 'general', onChunk: () => {}, timeoutMs: 30000 });

      const scoreMatch8D = text.match(/评分：(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)/);
      const scoreMatch4D = text.match(/评分：(\d+)\|(\d+)\|(\d+)\|(\d+)/);
      const commentMatch = text.match(/评语：(.+)/);

      let score = null;
      if (scoreMatch8D) {
        score = {
          relevance: parseInt(scoreMatch8D[1]), depth: parseInt(scoreMatch8D[2]),
          clarity: parseInt(scoreMatch8D[3]), professionalism: parseInt(scoreMatch8D[4]),
          evidence: parseInt(scoreMatch8D[5]), actionability: parseInt(scoreMatch8D[6]),
          selfAwareness: parseInt(scoreMatch8D[7]), growthMindset: parseInt(scoreMatch8D[8]),
        };
      } else if (scoreMatch4D) {
        score = {
          relevance: parseInt(scoreMatch4D[1]), depth: parseInt(scoreMatch4D[2]),
          clarity: parseInt(scoreMatch4D[3]), professionalism: parseInt(scoreMatch4D[4]),
          evidence: 5, actionability: 5, selfAwareness: 5, growthMindset: 5,
        };
      }

      if (score) {
        const comment = commentMatch ? commentMatch[1].trim() : '';
        const session = interviewStorage.current.getCurrentSession();
        if (session) {
          const answerEntry = answerId
            ? session.conversation.candidateAnswers.find(a => a.id === answerId)
            : session.conversation.candidateAnswers.find(
                a => a.answer === answer && a.realTimeScore === null
              );
          if (answerEntry) {
            interviewStorage.current.updateAnswerRealTimeScore(answerEntry.id, score, comment);
          }
        }
      }
      return score;
    } catch (err) {
      console.warn('实时评分失败:', err);
      return null;
    }
  }, [fetchLLMReply, state.candidate, truncatePromptText]);

  // 提交回答
  const submitAnswer = useCallback(async (answerText) => {
    if (!isActive || !state.isWaitingForAnswer) return { isComplete: false };

    const currentQuestion = state.currentQuestionText;
    dispatch({ type: ACTIONS.ANSWER_SUBMITTED });
    interviewStorage.current.addCandidateAnswer(answerText);
    const latestSession = interviewStorage.current.getCurrentSession();
    const currentAnswerId = latestSession?.conversation?.candidateAnswers?.[latestSession.conversation.candidateAnswers.length - 1]?.id || null;

    const currentIndex = state.currentQuestionIndex;

    updateSessionMetadata(interviewStorage.current.getCurrentSession(), {
      totalQuestions: state.totalQuestions,
      currentQuestionIndex: currentIndex,
      lastHeartbeatAt: new Date().toISOString(),
    });

    await syncSessionCheckpoint('answer_submitted', {
      metadata: {
        totalQuestions: state.totalQuestions,
        currentQuestionIndex: currentIndex,
      },
      clientPhase: 'evaluating',
    });

    // P0-2: 所有题目都 await 评分（修复竞态条件）
    if (currentQuestion && answerText) {
      await rateAnswerWithAI(currentQuestion, answerText, currentIndex, currentAnswerId);
    }

    if (currentIndex >= state.totalQuestions - 1) {
      dispatch({ type: ACTIONS.SCORING_START });
      return { isComplete: true };
    }

    const nextIndex = currentIndex + 1;
    const currentDim = nextIndex < 3 ? 'iq' : nextIndex < 6 ? 'eq' : nextIndex < 9 ? 'aq' : 'mq';
    const dimQuestionIndex = nextIndex < 3 ? nextIndex : nextIndex < 6 ? nextIndex - 3 : nextIndex < 9 ? nextIndex - 6 : nextIndex - 9;

    dispatch({ type: ACTIONS.NEXT_QUESTION_LOADING });
    setIsLoading(true);
    setShowActiveReplyBubble(true);
    setStreamingMessage('正在生成面试问题...');

    try {
      const currentSession = interviewStorage.current.getCurrentSession();
      const previousQA = (currentSession?.conversation?.questions || [])
        .slice(0, nextIndex)
        .map((q, i) => ({
          question: q.question || String(q),
          answer: currentSession.conversation.candidateAnswers?.[i]?.answer || '',
        }));

      const prompt = interviewScoringSystem.current.buildDimensionQuestionPrompt(
        currentDim, dimQuestionIndex,
        extractResumeSummary(state.candidate),
        extractPositionInfo(state.candidate),
        previousQA
      );

      const { text: questionText } = await fetchLLMReply(prompt, {
        mode: 'interview', onChunk: setStreamingMessage,
      });

      const cleanQuestion = extractQuestion(questionText);
      addBotMessage(cleanQuestion);
      interviewStorage.current.addQuestion(cleanQuestion, currentDim);
      updateSessionMetadata(interviewStorage.current.getCurrentSession(), {
        totalQuestions: state.totalQuestions,
        currentQuestionIndex: nextIndex,
      });

      await syncSessionCheckpoint('next_question_generated', {
        metadata: {
          totalQuestions: state.totalQuestions,
          currentQuestionIndex: nextIndex,
        },
        clientPhase: 'waiting_answer',
      });

      dispatch({
        type: ACTIONS.NEXT_QUESTION_READY,
        payload: { index: nextIndex, question: cleanQuestion },
      });
    } catch (error) {
      console.error('生成下一题失败:', error);
      // 不重新抛出，避免 UI 卡死；回退状态让用户重试
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
      dispatch({ type: ACTIONS.QUESTION_READY, payload: { index: currentIndex, question: state.currentQuestionText || '请稍后重试' } });
      return { isComplete: false, error: error.message };
    } finally {
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
    }

    return { isComplete: false };
  }, [
    isActive, state.isWaitingForAnswer, state.currentQuestionText,
    state.currentQuestionIndex, state.totalQuestions, state.candidate,
    rateAnswerWithAI, fetchLLMReply, addBotMessage, setIsLoading,
    setStreamingMessage, setShowActiveReplyBubble, extractQuestion,
  ]);

  useEffect(() => {
    if (!isActive) return undefined;

    const heartbeatTimer = setInterval(() => {
      const currentSession = interviewStorage.current.getCurrentSession();
      if (!currentSession?.id) return;

      const heartbeatAt = new Date().toISOString();
      const nextSession = updateSessionMetadata(currentSession, {
        totalQuestions: state.totalQuestions,
        currentQuestionIndex: state.currentQuestionIndex,
        lastHeartbeatAt: heartbeatAt,
      });

      syncSessionCheckpoint('heartbeat', {
        session: nextSession,
        metadata: {
          totalQuestions: state.totalQuestions,
          currentQuestionIndex: state.currentQuestionIndex,
          lastHeartbeatAt: heartbeatAt,
        },
        clientPhase: state.isWaitingForAnswer ? 'waiting_answer' : 'active',
        includeConversation: false,
        includeScoring: false,
      });
    }, SESSION_HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [
    isActive,
    state.currentQuestionIndex,
    state.isWaitingForAnswer,
    state.totalQuestions,
    syncSessionCheckpoint,
    updateSessionMetadata,
  ]);

  // 完成面试
  const completeInterview = useCallback((candidateOverride) => {
    if (completionPromiseRef.current) {
      return completionPromiseRef.current;
    }

    const completionTask = (async () => {
    if (hasPendingCurrentAnswer()) {
      return { blocked: true, reason: 'pending_answer' };
    }

    const candidate = candidateOverride || state.candidate;
    const session = interviewStorage.current.getCurrentSession();
    let resolvedSession = session;
    let resolvedAnswers = session?.conversation?.candidateAnswers || [];

    if (!resolvedAnswers.length) {
      const history = interviewStorage.current.getInterviewHistory();
      const last = history?.[history.length - 1];
      if (last?.conversation?.candidateAnswers?.length > 0) {
        resolvedAnswers = last.conversation.candidateAnswers;
        resolvedSession = last;
      }
    }

    if (!resolvedAnswers.length) {
      return { scoring: null, report: '' };
    }

    const scoring = interviewScoringSystem.current.calculateScore(
      resolvedSession?.conversation || resolvedSession
    );
    dispatch({ type: ACTIONS.SCORING_DONE, payload: scoring });

    let report = '';
    try {
      const questionComments = (resolvedSession?.conversation?.candidateAnswers || [])
        .map((a, i) => {
          const q = resolvedSession?.conversation?.questions?.[i];
          const qText = truncatePromptText(q?.question || String(q || '未知问题'), 160);
          const ans = truncatePromptText(a?.answer || '（未回答）', 220);
          if (a.realTimeScore && a.realTimeComment) {
            const r = a.realTimeScore;
            return `第${i + 1}题\n问题：${qText}\n回答：${ans}\n评分：${r.relevance}|${r.depth}|${r.clarity}|${r.professionalism}|${r.evidence}|${r.actionability}|${r.selfAwareness}|${r.growthMindset}\n评语：${truncatePromptText(a.realTimeComment, 120)}`;
          }
          return `第${i + 1}题\n问题：${qText}\n回答：${ans}`;
        }).join('\n\n');

      const iqScore = scoring.categoryScores?.iq?.score || 0;
      const eqScore = scoring.categoryScores?.eq?.score || 0;
      const aqScore = scoring.categoryScores?.aq?.score || 0;
      const mqScore = scoring.categoryScores?.mq?.score || 0;
      const strongestDimension = [
        ['IQ', iqScore / 50],
        ['EQ', eqScore / 20],
        ['AQ', aqScore / 15],
        ['MQ', mqScore / 15],
      ].sort((left, right) => right[1] - left[1])[0]?.[0] || 'IQ';
      const weakestDimension = [
        ['IQ', iqScore / 50],
        ['EQ', eqScore / 20],
        ['AQ', aqScore / 15],
        ['MQ', mqScore / 15],
      ].sort((left, right) => left[1] - right[1])[0]?.[0] || 'AQ';

      const reportPrompt = `你是面试评估专家。生成综合总结报告。

候选人：${candidate?.name || '未知'}
岗位：${extractPositionInfo(candidate).positionName}
【简历摘要】${truncatePromptText(extractResumeSummary(candidate), 700) || '暂无'}

各题评语：${questionComments}

综合评分：${scoring.totalScore || 0}/100 IQ:${iqScore}/50 EQ:${eqScore}/20 AQ:${aqScore}/15 MQ:${mqScore}/15

按格式输出（仅输出以下 8 行，不要额外解释，不要换标题名）：
整体评价：{3句话以内，必须覆盖岗位匹配度、表达状态、培养潜力或稳定性判断}
IQ分析：{1-2句话，聚焦专业能力、逻辑和案例真实性}
EQ分析：{1-2句话，聚焦沟通协作、情绪稳定和互动感}
AQ分析：{1-2句话，聚焦抗压、复盘和处理困难的方式}
MQ分析：{1-2句话，聚焦责任感、职业判断和价值观边界}
核心优势：{3点以内，用分号分隔，每点都要具体，避免空泛词}
待提升项：{3点以内，用分号分隔，明确短板或风险点}
录用建议：{2句话以内，先给结论，再指出下一轮最该追问的重点}`;

      const { text: reportText } = await fetchLLMReply(reportPrompt, {
        mode: 'general', onChunk: () => {}, timeoutMs: 60000,
      });
      report = (reportText || '').trim();
    } catch (err) {
      console.warn('生成面试报告失败:', err);
    }

    if (!report) {
      const level = scoring.totalScore >= 80 ? '优秀' : scoring.totalScore >= 70 ? '良好' :
        scoring.totalScore >= 60 ? '一般' : '待提升';
      report = `整体评价：面试总分${scoring.totalScore}分，整体表现${level}，与目标岗位存在一定匹配度。当前${strongestDimension}维度表现相对突出，但${weakestDimension}维度仍建议在后续面试中继续核实。\nIQ分析：专业能力与逻辑表达处于可评估范围内，建议结合项目细节继续验证知识深度和经验真实性。\nEQ分析：沟通表达具备基础，但需要结合追问进一步确认协作意识、反馈方式与稳定性。\nAQ分析：面对压力与困难时已有初步应对思路，建议继续核实复盘能力和抗压韧性。\nMQ分析：职业判断与责任意识有一定基础，但仍需通过更多场景题确认价值观边界。\n核心优势：${strongestDimension}相关表现较为突出；回答中能提供一定经历或案例支撑；具备继续深入评估的基础。\n待提升项：${weakestDimension}相关证据仍不够充分；部分回答细节深度不足；岗位关键场景的实战表现仍需追问。\n录用建议：建议根据目标岗位要求决定是否进入下一轮。下一轮应重点围绕${weakestDimension}维度和真实项目贡献继续深挖。`;
    }

    const completedAt = new Date().toISOString();
    const syncedCompletedSession = {
      ...resolvedSession,
      status: 'completed',
      endTime: completedAt,
      scoring,
      metadata: {
        ...(resolvedSession?.metadata || {}),
        totalQuestions: state.totalQuestions,
        currentQuestionIndex: state.currentQuestionIndex,
        sessionDuration: resolvedSession?.startTime
          ? Math.round((new Date(completedAt) - new Date(resolvedSession.startTime)) / 1000 / 60)
          : resolvedSession?.metadata?.sessionDuration || 0,
      }
    };

    await syncSessionCheckpoint('interview_completed', {
      session: syncedCompletedSession,
      status: 'completed',
      scoring,
      metadata: syncedCompletedSession.metadata,
      endTime: completedAt,
      clientPhase: 'completed',
    });

    // P3: 使用 InterviewStorage 方法
    interviewStorage.current.archiveSession(syncedCompletedSession);
    interviewStorage.current.clearCurrentSession();

    // 保存到后端
    if (candidate?.id) {
      const questionScores = (resolvedSession?.conversation?.candidateAnswers || [])
        .map((a, i) => {
          const q = resolvedSession?.conversation?.questions?.[i];
          return {
            question: q?.question || String(q || ''),
            answer: a?.answer || '',
            relevance: a?.realTimeScore?.relevance ?? null,
            depth: a?.realTimeScore?.depth ?? null,
            clarity: a?.realTimeScore?.clarity ?? null,
            professionalism: a?.realTimeScore?.professionalism ?? null,
            evidence: a?.realTimeScore?.evidence ?? null,
            actionability: a?.realTimeScore?.actionability ?? null,
            selfAwareness: a?.realTimeScore?.selfAwareness ?? null,
            growthMindset: a?.realTimeScore?.growthMindset ?? null,
            comment: a?.realTimeComment || null,
          };
        });

      const dimensions = ['relevance','depth','clarity','professionalism','evidence','actionability','selfAwareness','growthMindset'];
      const evaluationScores = {};
      dimensions.forEach(dim => {
        const valid = questionScores.filter(q => q[dim] !== null && q[dim] !== undefined);
        if (valid.length) evaluationScores[dim] = Math.round(valid.reduce((s,q) => s+q[dim], 0) / valid.length);
      });

      try {
        const token = localStorage.getItem('token');
        const axios = (await import('axios')).default;
        await axios.post('/api/candidates/interview-score', {
          candidateId: candidate.id,
          interviewScore: scoring.totalScore,
          interviewDetails: { totalScore: scoring.totalScore, report, categoryScores: scoring.categoryScores, evaluationScores, questionScores },
          interviewDate: new Date().toISOString(),
        }, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        window.dispatchEvent(new Event('interviewScoreSaved'));
      } catch (err) {
        console.error('面试分保存失败:', err);
      }
    }

    dispatch({ type: ACTIONS.END_INTERVIEW, payload: { scoring } });
    return { scoring, report, candidate };
    })();

    completionPromiseRef.current = completionTask.finally(() => {
      completionPromiseRef.current = null;
    });

    return completionPromiseRef.current;
  }, [state.candidate, state.currentQuestionIndex, state.totalQuestions, fetchLLMReply, syncSessionCheckpoint, hasPendingCurrentAnswer, truncatePromptText]);

  const endInterview = useCallback(async () => {
    if (hasPendingCurrentAnswer()) {
      return { blocked: true, reason: 'pending_answer' };
    }
    return await completeInterview();
  }, [completeInterview, hasPendingCurrentAnswer]);

  const reset = useCallback(() => {
    interviewStorage.current.clearCurrentSession();
    dispatch({ type: ACTIONS.RESET });
  }, []);

  const selectCandidate = useCallback((candidate) => {
    dispatch({ type: ACTIONS.SELECT_CANDIDATE, payload: candidate });
  }, []);

  const getCurrentSession = useCallback(() => {
    return interviewStorage.current.getCurrentSession();
  }, []);

  return {
    state,
    candidate: state.candidate,
    currentQuestionIndex: state.currentQuestionIndex,
    currentQuestionText: state.currentQuestionText,
    isWaitingForAnswer: state.isWaitingForAnswer,
    totalQuestions: state.totalQuestions,
    scoring: state.scoring,
    hasRecoverableSession: state.hasRecoverableSession,
    recoverableSession: state.recoverableSession,
    isActive,
    isScoring,
    isCompleted,
    isIdle,
    isAnyActive,
    progressText,
    statusText,
    statusColor,
    startInterview,
    submitAnswer,
    endInterview,
    completeInterview,
    reset,
    selectCandidate,
    checkRecoverableSession,
    dismissRecovery,
    recoverSession,
    _storage: interviewStorage,
    _scoring: interviewScoringSystem,
    _getCurrentSession: getCurrentSession,
  };
}

export default useInterview;
