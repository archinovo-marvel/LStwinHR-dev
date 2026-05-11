import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputBar from './InputBar';

function createProps(overrides = {}) {
  return {
    inputValue: '我想补充一下刚才的回答',
    setInputValue: jest.fn(),
    isRecording: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    voiceAnswerDraft: null,
    onConfirmVoiceAnswer: jest.fn(),
    onKeepEditingVoiceAnswer: jest.fn(),
    onDismissVoiceAnswer: jest.fn(),
    memoryEnabled: true,
    handleMemoryToggleChange: jest.fn(),
    currentRounds: 2,
    enginePreference: 'local',
    localEngineSelected: false,
    localVisionEnabled: false,
    attachedImages: [],
    removeAttachedImage: jest.fn(),
    imageInputRef: { current: null },
    handleSelectVisionImage: jest.fn(),
    sendMessage: jest.fn(),
    isLoading: false,
    ttsConfig: { voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%', volume: '+0%' },
    setTtsConfig: jest.fn(),
    ...overrides,
  };
}

describe('InputBar voice answer draft', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map(String).join(' ');
      if (message.includes('ReactDOMTestUtils.act')) {
        return;
      }
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the voice answer confirmation bar when transcript requires confirmation', () => {
    render(
      <InputBar
        {...createProps({
          voiceAnswerDraft: {
            text: '这是语音转写后的候选人回答',
            requiresConfirm: true,
          },
        })}
      />
    );

    expect(screen.getByText('语音回答已转写')).toBeInTheDocument();
    expect(screen.getByText('这是语音转写后的候选人回答')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交回答' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '稍后' })).toBeInTheDocument();
  });

  it('fires the expected callbacks for voice answer draft actions', async () => {
    const onConfirmVoiceAnswer = jest.fn();
    const onKeepEditingVoiceAnswer = jest.fn();
    const onDismissVoiceAnswer = jest.fn();

    render(
      <InputBar
        {...createProps({
          voiceAnswerDraft: {
            text: '这是语音转写后的候选人回答',
            requiresConfirm: true,
          },
          onConfirmVoiceAnswer,
          onKeepEditingVoiceAnswer,
          onDismissVoiceAnswer,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    await userEvent.click(screen.getByRole('button', { name: '提交回答' }));
    await userEvent.click(screen.getByRole('button', { name: '稍后' }));

    expect(onKeepEditingVoiceAnswer).toHaveBeenCalledTimes(1);
    expect(onConfirmVoiceAnswer).toHaveBeenCalledTimes(1);
    expect(onDismissVoiceAnswer).toHaveBeenCalledTimes(1);
  });
});