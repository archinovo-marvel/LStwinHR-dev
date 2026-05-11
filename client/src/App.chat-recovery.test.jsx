import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('./styled-components-config', () => ({
  StyledComponentsConfig: ({ children }) => <>{children}</>,
}));

jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'corp-user', userType: 'CORP' },
    logout: jest.fn(),
  }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

jest.mock('./components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout-shell">{children}</div>,
}));

jest.mock('./pages/HomePage', () => () => <div>home</div>);
jest.mock('./pages/DashboardPage', () => () => <div>dashboard</div>);
jest.mock('./pages/ResumeUpload', () => () => <div>resume</div>);
jest.mock('./pages/CandidateForm', () => () => <div>candidate-form</div>);
jest.mock('./pages/ResumeAnalysis', () => () => <div>resume-analysis</div>);
jest.mock('./pages/ProfilePage', () => () => <div>profile</div>);
jest.mock('./pages/LoginPage', () => () => <div>login</div>);
jest.mock('./pages/RegisterPage', () => () => <div>register</div>);
jest.mock('./pages/PersonalDashboardPage', () => () => <div>personal-dashboard</div>);
jest.mock('./pages/PersonalResumePage', () => () => <div>personal-resume</div>);
jest.mock('./pages/PersonalInterviewHubPage', () => () => <div>personal-interview-hub</div>);
jest.mock('./pages/PersonalInterviewSessionPage', () => () => <div>personal-interview-session</div>);
jest.mock('./pages/PersonalInterviewReportPage', () => () => <div>personal-interview-report</div>);
jest.mock('./pages/PersonalInterviewHistoryPage', () => () => <div>personal-interview-history</div>);
jest.mock('./pages/ChatPage', () => () => {
  throw new Error('chat route crashed');
});

describe('App chat route recovery', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map(String).join(' ');
      if (
        message.includes('ReactDOMTestUtils.act') ||
        message.includes('chat route crashed') ||
        message.includes('[ErrorBoundary] 捕获到渲染错误') ||
        message.includes('The above error occurred in one of your React components')
      ) {
        return;
      }
    });
    window.history.pushState({}, '', '/chat');
    window.localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    window.localStorage.clear();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('renders the chat recovery fallback when ChatPage throws', async () => {
    const { default: App } = await import('./App');

    render(<App />);

    expect(screen.getByText('当前面试页面出现渲染异常')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载并尝试恢复' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回工作台' })).toBeInTheDocument();
  });
});