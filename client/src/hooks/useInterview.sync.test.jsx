import React, { forwardRef, useImperativeHandle } from 'react';
import '@testing-library/jest-dom';
import { act, render, waitFor } from '@testing-library/react';
import { useInterview } from './useInterview';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockAxios = require('axios').default;

const HookHost = forwardRef(function HookHost({ options }, ref) {
  const hook = useInterview(options);

  useImperativeHandle(ref, () => hook, [hook]);

  return null;
});

function createHookOptions(fetchLLMReply) {
  return {
    fetchLLMReply,
    addBotMessage: jest.fn(),
    setIsLoading: jest.fn(),
    setStreamingMessage: jest.fn(),
    setShowActiveReplyBubble: jest.fn(),
  };
}

function createSessionFixture() {
  return {
    id: 123456,
    candidateId: 'candidate-1',
    candidateName: '张三',
    position: '前端工程师',
    startTime: '2026-05-08T10:00:00.000Z',
    endTime: null,
    status: 'in_progress',
    conversation: {
      questions: [
        {
          id: 1,
          question: '请介绍一次你主导的项目？',
          type: 'iq',
          timestamp: '2026-05-08T10:01:00.000Z',
          order: 1,
        }
      ],
      candidateAnswers: [
        {
          id: 2,
          answer: '我主导过一个招聘平台重构项目。',
          questionId: null,
          timestamp: '2026-05-08T10:02:00.000Z',
          order: 1,
          length: 16,
          wordCount: 1,
          realTimeScore: {
            relevance: 8,
            depth: 8,
            clarity: 8,
            professionalism: 8,
            evidence: 8,
            actionability: 8,
            selfAwareness: 8,
            growthMindset: 8,
          },
          realTimeComment: '回答结构清晰，案例完整。',
        }
      ],
      aiReplies: [],
      timestamps: [],
    },
    scoring: null,
    metadata: {
      totalQuestions: 8,
      totalAnswers: 1,
      averageAnswerLength: 16,
      sessionDuration: 0,
      currentQuestionIndex: 0,
    },
  };
}

describe('useInterview session sync', () => {
  let hookRef;

  beforeEach(() => {
    hookRef = React.createRef();
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'corp-user-1', name: '企业用户' }));
    mockAxios.get.mockReset();
    mockAxios.post.mockReset();
    mockAxios.patch.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates interview session and syncs first question checkpoint on startInterview', async () => {
    const fetchLLMReply = jest.fn().mockResolvedValue({
      text: '第1题：请介绍一次你主导的项目？'
    });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.startInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
        workYears: '1',
      });
    });

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/api/interview-sessions',
      expect.objectContaining({
        ownerUserId: 'corp-user-1',
        candidateId: 'candidate-1',
        candidateName: '张三',
        status: 'in_progress',
        metadata: expect.objectContaining({
          totalQuestions: 8,
          currentQuestionIndex: -1,
          lastSyncReason: 'start_interview',
        }),
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' }
      })
    );

    expect(mockAxios.patch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/interview-sessions\//),
      expect.objectContaining({
        metadata: expect.objectContaining({
          totalQuestions: 8,
          currentQuestionIndex: 0,
          lastSyncReason: 'question_generated',
        }),
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' }
      })
    );
  });

  it('blocks completing interview while current question is still waiting for an answer', async () => {
    const fetchLLMReply = jest.fn().mockResolvedValue({
      text: '第1题：请介绍一次你主导的项目？'
    });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.startInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
        workYears: '1',
      });
    });

    mockAxios.post.mockClear();
    mockAxios.patch.mockClear();

    let result;
    await act(async () => {
      result = await hookRef.current.endInterview();
    });

    expect(result).toEqual(expect.objectContaining({
      blocked: true,
      reason: 'pending_answer',
    }));
    expect(hookRef.current.isActive).toBe(true);
    expect(hookRef.current.isWaitingForAnswer).toBe(true);
    expect(mockAxios.post).not.toHaveBeenCalled();
    expect(mockAxios.patch).not.toHaveBeenCalled();
  });

  it('syncs answer submission and next question checkpoint on submitAnswer', async () => {
    const fetchLLMReply = jest.fn()
      .mockResolvedValueOnce({ text: '第1题：请介绍一次你主导的项目？' })
      .mockResolvedValueOnce({ text: '评分：8|8|8|8|8|8|8|8\n评语：回答完整，细节较充分。' })
      .mockResolvedValueOnce({ text: '第2题：你如何处理项目冲突？' });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.startInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
        workYears: '1',
      });
    });

    mockAxios.patch.mockClear();

    await act(async () => {
      await hookRef.current.submitAnswer('我主导过一个招聘平台重构项目。');
    });

    expect(mockAxios.patch).toHaveBeenCalledTimes(2);
    expect(mockAxios.patch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^\/api\/interview-sessions\//),
      expect.objectContaining({
        metadata: expect.objectContaining({
          currentQuestionIndex: 0,
          lastSyncReason: 'answer_submitted',
        }),
      }),
      expect.any(Object)
    );
    expect(mockAxios.patch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^\/api\/interview-sessions\//),
      expect.objectContaining({
        metadata: expect.objectContaining({
          currentQuestionIndex: 1,
          lastSyncReason: 'next_question_generated',
        }),
      }),
      expect.any(Object)
    );
  });

  it('syncs completed session before archiving on completeInterview', async () => {
    localStorage.setItem('current_interview_session', JSON.stringify(createSessionFixture()));

    const fetchLLMReply = jest.fn().mockResolvedValue({
      text: '整体评价：表现稳定，项目经验匹配岗位需求。'
    });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.completeInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
      });
    });

    await waitFor(() => {
      expect(mockAxios.patch).toHaveBeenCalledWith(
        '/api/interview-sessions/123456',
        expect.objectContaining({
          status: 'completed',
          scoring: expect.any(Object),
          metadata: expect.objectContaining({
            lastSyncReason: 'interview_completed',
          }),
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' }
        })
      );
    });

    expect(mockAxios.post).toHaveBeenCalledWith(
      '/api/candidates/interview-score',
      expect.objectContaining({
        candidateId: 'candidate-1',
        interviewScore: expect.any(Number),
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' }
      })
    );
  });

  it('sends lightweight heartbeat checkpoint while interview is active', async () => {
    jest.useFakeTimers();

    const fetchLLMReply = jest.fn().mockResolvedValue({
      text: '第1题：请介绍一次你主导的项目？'
    });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.startInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
        workYears: '1',
      });
    });

    mockAxios.patch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(mockAxios.patch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/interview-sessions\//),
        expect.objectContaining({
          conversation: undefined,
          metadata: expect.objectContaining({
            currentQuestionIndex: 0,
            totalQuestions: 8,
            lastSyncReason: 'heartbeat',
            lastHeartbeatAt: expect.any(String),
          }),
        }),
        expect.any(Object)
      );
    });

    jest.useRealTimers();
  });

  it('prefers newer backend current session when aligning recoverable interview state', async () => {
    const localSession = {
      ...createSessionFixture(),
      updatedAt: '2026-05-08T10:03:00.000Z',
    };
    const backendSession = {
      ...createSessionFixture(),
      id: 999999,
      candidateName: '李四',
      updatedAt: '2026-05-08T10:05:00.000Z',
      metadata: {
        ...createSessionFixture().metadata,
        lastSyncedAt: '2026-05-08T10:05:00.000Z',
      },
    };

    localStorage.setItem('current_interview_session', JSON.stringify(localSession));
    mockAxios.get.mockResolvedValue({
      data: {
        success: true,
        session: backendSession,
      },
    });

    render(<HookHost ref={hookRef} options={createHookOptions(jest.fn())} />);

    let recoveredSession;
    await act(async () => {
      recoveredSession = await hookRef.current.checkRecoverableSession();
    });

    expect(mockAxios.get).toHaveBeenCalledWith(
      '/api/interview-sessions/current',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' }
      })
    );
    expect(recoveredSession).toEqual(expect.objectContaining({
      id: 999999,
      candidateName: '李四',
    }));
    expect(hookRef.current.recoverableSession).toEqual(expect.objectContaining({
      id: 999999,
      candidateName: '李四',
    }));
  });

  it('prefers more complete local recovery session over newer backend heartbeat snapshot', async () => {
    const baseSession = createSessionFixture();
    const localSession = {
      ...baseSession,
      updatedAt: '2026-05-08T10:03:00.000Z',
      conversation: {
        ...baseSession.conversation,
        questions: [
          ...baseSession.conversation.questions,
          {
            id: 3,
            question: '你如何推进跨团队协作？',
            type: 'bq',
            timestamp: '2026-05-08T10:03:30.000Z',
            order: 2,
          },
        ],
        candidateAnswers: [
          ...baseSession.conversation.candidateAnswers,
          {
            id: 4,
            answer: '我会先统一目标和节奏，再拆分责任。',
            questionId: 3,
            timestamp: '2026-05-08T10:04:00.000Z',
            order: 2,
            length: 18,
            wordCount: 1,
          },
        ],
      },
      metadata: {
        ...baseSession.metadata,
        totalAnswers: 2,
        currentQuestionIndex: 1,
      },
    };
    const backendSession = {
      ...baseSession,
      id: 999999,
      candidateName: '李四',
      updatedAt: '2026-05-08T10:05:00.000Z',
      metadata: {
        ...baseSession.metadata,
        lastSyncedAt: '2026-05-08T10:05:00.000Z',
        lastHeartbeatAt: '2026-05-08T10:05:00.000Z',
        totalAnswers: 1,
        currentQuestionIndex: 0,
      },
    };

    localStorage.setItem('current_interview_session', JSON.stringify(localSession));
    mockAxios.get.mockResolvedValue({
      data: {
        success: true,
        session: backendSession,
      },
    });

    render(<HookHost ref={hookRef} options={createHookOptions(jest.fn())} />);

    let recoveredSession;
    await act(async () => {
      recoveredSession = await hookRef.current.checkRecoverableSession();
    });

    expect(recoveredSession).toEqual(expect.objectContaining({
      id: localSession.id,
      candidateName: localSession.candidateName,
    }));
    expect(hookRef.current.recoverableSession).toEqual(expect.objectContaining({
      id: localSession.id,
      candidateName: localSession.candidateName,
    }));
    expect(JSON.parse(localStorage.getItem('current_interview_session'))).toEqual(expect.objectContaining({
      id: localSession.id,
      candidateName: localSession.candidateName,
    }));
  });

  it('skips backend sync when auth token is missing but still starts interview flow', async () => {
    localStorage.removeItem('token');

    const fetchLLMReply = jest.fn().mockResolvedValue({
      text: '第1题：请介绍一次你主导的项目？'
    });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.startInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
        workYears: '1',
      });
    });

    expect(mockAxios.post).not.toHaveBeenCalled();
    expect(mockAxios.patch).not.toHaveBeenCalled();
    expect(hookRef.current.currentQuestionIndex).toBe(0);
    expect(hookRef.current.isWaitingForAnswer).toBe(true);
  });

  it('does not block answer submission when session patch fails', async () => {
    const fetchLLMReply = jest.fn()
      .mockResolvedValueOnce({ text: '第1题：请介绍一次你主导的项目？' })
      .mockResolvedValueOnce({ text: '评分：8|8|8|8|8|8|8|8\n评语：回答完整，细节较充分。' })
      .mockResolvedValueOnce({ text: '第2题：你如何处理项目冲突？' });

    render(<HookHost ref={hookRef} options={createHookOptions(fetchLLMReply)} />);

    await act(async () => {
      await hookRef.current.startInterview({
        id: 'candidate-1',
        name: '张三',
        position: '前端工程师',
        workYears: '1',
      });
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAxios.patch.mockRejectedValueOnce(new Error('session patch failed'));

    await act(async () => {
      await hookRef.current.submitAnswer('我主导过一个招聘平台重构项目。');
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '面试会话同步失败(answer_submitted):',
      expect.any(Error)
    );
    expect(hookRef.current.currentQuestionIndex).toBe(1);
    expect(hookRef.current.isWaitingForAnswer).toBe(true);
  });
});