import React, { forwardRef, useImperativeHandle } from 'react';
import '@testing-library/jest-dom';
import { act, render, waitFor } from '@testing-library/react';
import { useVirtualHumanBridge } from './useVirtualHumanBridge';

const HookHost = forwardRef(function HookHost({ options }, ref) {
  const hook = useVirtualHumanBridge(options);

  useImperativeHandle(ref, () => hook, [hook]);

  return null;
});

describe('useVirtualHumanBridge ASR handoff', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (
        typeof message === 'string' &&
        message.includes('`ReactDOMTestUtils.act` is deprecated in favor of `React.act`')
      ) {
        return;
      }

      // Preserve unexpected warnings so real regressions still surface.
      // eslint-disable-next-line no-console
      console.warn(message, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('forwards sdk ASR transcript and records diagnostic summary', async () => {
    const hookRef = React.createRef();
    const onVoiceTranscript = jest.fn();

    render(
      <HookHost
        ref={hookRef}
        options={{
          enabled: true,
          setMessages: jest.fn(),
          setStreamingMessage: jest.fn(),
          setShowActiveReplyBubble: jest.fn(),
          onVoiceTranscript,
        }}
      />
    );

    await act(async () => {
      hookRef.current.handleVirtualHumanAsrMessage('这是 SDK 原生转写结果', {
        text: '这是 SDK 原生转写结果',
      });
    });

    expect(onVoiceTranscript).toHaveBeenCalledWith(
      '这是 SDK 原生转写结果',
      expect.objectContaining({
        source: 'sdk-asr',
        payload: expect.objectContaining({
          text: '这是 SDK 原生转写结果',
        }),
      })
    );

    await waitFor(() => {
      expect(hookRef.current.diagnosticSummary.count).toBe(1);
      expect(hookRef.current.diagnosticSummary.lastEvent).toEqual(
        expect.objectContaining({
          type: 'asr-transcript',
          detail: '这是 SDK 原生转写结果',
        })
      );
    });
  });
});