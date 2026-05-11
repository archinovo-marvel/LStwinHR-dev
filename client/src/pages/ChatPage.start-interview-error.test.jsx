import React from 'react';
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';

let capturedFetchLLMReply;

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
		voiceAnswerDraft: '',
		diagnosticSummary: { count: 0, lastEvent: null },
		virtualHumanRef: { current: null },
		appendBotMessage: jest.fn(),
		applyVoiceTranscript: jest.fn(),
		handleVirtualHumanStatusChange: jest.fn(),
		handleVirtualHumanReply: jest.fn(),
		handleVirtualHumanAsrMessage: jest.fn(),
		handleKeepEditingVoiceAnswer: jest.fn(),
		handleDismissVoiceAnswer: jest.fn(),
		clearVoiceAnswerDraft: jest.fn(),
		finishVirtualHumanStreaming: jest.fn(),
		handleRetryVirtualHuman: jest.fn(),
		handleCompletedSpeech: jest.fn(),
		toggleSpeechEnabled: jest.fn(),
		toggleAudioMuted: jest.fn(),
	})
}));

jest.mock('../hooks/useInterview', () => ({
	useInterview: (options) => {
		capturedFetchLLMReply = options.fetchLLMReply;
		return {
			checkRecoverableSession: jest.fn(),
			hasRecoverableSession: false,
			recoverableSession: null,
			recoverSession: jest.fn(),
			dismissRecovery: jest.fn(),
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
		};
	},
}));

describe('ChatPage interview auth', () => {
	beforeEach(() => {
		capturedFetchLLMReply = undefined;
		localStorage.clear();
		localStorage.setItem('token', 'test-token');
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.TextDecoder = class {
			decode() {
				return '';
			}
		};

		const reader = {
			read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
		};

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			headers: {
				get: jest.fn((key) => {
					if (key === 'x-llm-source') return 'local';
					if (key === 'x-llm-model') return 'qwen';
					if (key === 'x-llm-label') return '本地模型';
					return null;
				}),
			},
			body: {
				getReader: () => reader,
			},
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('passes bearer token when interview startup asks /api/chat for the first question', async () => {
		const { default: ChatPage } = await import('./ChatPage');

		render(<ChatPage />);

		await act(async () => {
			await capturedFetchLLMReply('生成第一题', { mode: 'interview' });
		});

		expect(global.fetch).toHaveBeenCalledWith(
			'/api/chat',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					Authorization: 'Bearer test-token',
				}),
			})
		);
	});
});
