import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../components/CandidateSelector', () => () => <div data-testid="candidate-selector" />);
jest.mock('../components/VirtualHumanSDK', () => {
  const mockReact = require('react');
  return mockReact.forwardRef((props, ref) => <div data-testid="virtual-human-sdk" ref={ref} />);
});
jest.mock('../components/ChatPage', () => ({
  ChatMessages: () => <div data-testid="chat-messages" />,
  InputBar: () => <div data-testid="input-bar" />,
  VirtualHumanPanel: ({ children }) => <div data-testid="virtual-human-panel">{children}</div>,
  InterviewResults: () => <div data-testid="interview-results" />,
  QuickBar: () => <div data-testid="quick-bar" />,
}));

jest.mock('../hooks/useVirtualHumanBridge', () => ({
  useVirtualHumanBridge: () => ({
    virtualHumanConnected: false,
    virtualHumanError: false,
    virtualHumanStatus: 'disconnected',
    virtualHumanNeedsInteraction: false,
    isVirtualPanelCollapsed: false,
    setIsVirtualPanelCollapsed: jest.fn(),
    speechEnabled: true,
    audioMuted: false,
    diagnosticSummary: { count: 0, lastEvent: null },
    virtualHumanRef: { current: null },
    appendBotMessage: jest.fn(),
    handleVirtualHumanStatusChange: jest.fn(),
    handleVirtualHumanReply: jest.fn(),
    finishVirtualHumanStreaming: jest.fn(),
    handleRetryVirtualHuman: jest.fn(),
    handleCompletedSpeech: jest.fn(),
    toggleSpeechEnabled: jest.fn(),
    toggleAudioMuted: jest.fn(),
  })
}));

const mockRecoverSession = jest.fn();
const mockDismissRecovery = jest.fn();

jest.mock('../hooks/useInterview', () => ({
  useInterview: () => ({
    checkRecoverableSession: jest.fn(),
    hasRecoverableSession: true,
    recoverableSession: { id: 1, status: 'in_progress' },
    recoverSession: mockRecoverSession,
    dismissRecovery: mockDismissRecovery,
    isAnyActive: false,
    isActive: false,
    isCompleted: false,
    isWaitingForAnswer: false,
    statusText: '',
    currentQuestionIndex: 0,
    totalQuestions: 12,
    scoring: null,
    startInterview: jest.fn(),
    submitAnswer: jest.fn(),
    completeInterview: jest.fn(),
    endInterview: jest.fn(),
  }),
}));

describe('ChatPage recovery banner', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the recoverable session banner when interview hook exposes recoverable session', async () => {
    const { default: ChatPage } = await import('./ChatPage');

    render(<ChatPage />);

    expect(screen.getByText('检测到未完成的面试会话，是否恢复？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '恢复' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放弃' })).toBeInTheDocument();
  });
});