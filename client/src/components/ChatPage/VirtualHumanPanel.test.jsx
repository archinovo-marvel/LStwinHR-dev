import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VirtualHumanPanel from './VirtualHumanPanel';

describe('VirtualHumanPanel', () => {
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

  it('renders sdk content when sdkEnabled is true', () => {
    render(
      <VirtualHumanPanel
        virtualHumanConnected={true}
        virtualHumanError={false}
        isVirtualPanelCollapsed={false}
        setIsVirtualPanelCollapsed={() => {}}
        sdkEnabled={true}
      >
        <div data-testid="virtual-human-sdk">sdk-mounted</div>
      </VirtualHumanPanel>
    );

    expect(screen.getByTestId('virtual-human-sdk')).toBeInTheDocument();
    expect(screen.getByText('数字人已接入面试主链路，可跟随面试问题与结束语进行播报')).toBeInTheDocument();
  });

  it('renders placeholder copy when sdk is disabled', () => {
    render(
      <VirtualHumanPanel
        virtualHumanConnected={false}
        virtualHumanError={false}
        isVirtualPanelCollapsed={false}
        setIsVirtualPanelCollapsed={() => {}}
        sdkEnabled={false}
      />
    );

    expect(screen.queryByTestId('virtual-human-sdk')).not.toBeInTheDocument();
    expect(screen.getByText('随时为您服务，支持语音对话与实时面试评估')).toBeInTheDocument();
  });

  it('triggers retry and control callbacks when sdk actions are clicked', async () => {
    const onRetryConnect = jest.fn();
    const onToggleSpeechEnabled = jest.fn();
    const onToggleAudioMuted = jest.fn();

    render(
      <VirtualHumanPanel
        virtualHumanConnected={false}
        virtualHumanError={true}
        virtualHumanStatus="error"
        virtualHumanNeedsInteraction={false}
        isVirtualPanelCollapsed={false}
        setIsVirtualPanelCollapsed={() => {}}
        sdkEnabled={true}
        onRetryConnect={onRetryConnect}
        speechEnabled={true}
        audioMuted={false}
        onToggleSpeechEnabled={onToggleSpeechEnabled}
        onToggleAudioMuted={onToggleAudioMuted}
        diagnosticSummary={{ count: 2, lastEvent: { type: 'retry-failed', detail: 'network error' } }}
      >
        <div data-testid="virtual-human-sdk">sdk-mounted</div>
      </VirtualHumanPanel>
    );

    await userEvent.click(screen.getByRole('button', { name: '重试连接数字人' }));
    await userEvent.click(screen.getByRole('button', { name: '播报已开启' }));
    await userEvent.click(screen.getByRole('button', { name: '声音已开启' }));

    expect(onRetryConnect).toHaveBeenCalledTimes(1);
    expect(onToggleSpeechEnabled).toHaveBeenCalledTimes(1);
    expect(onToggleAudioMuted).toHaveBeenCalledTimes(1);
    expect(screen.getByText('最近事件：retry-failed · network error')).toBeInTheDocument();
  });
});