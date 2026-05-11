import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './App.css';
import './antd-fixes.css';
import { StyledComponentsConfig } from './styled-components-config';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// 页面组件
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import ResumeUpload from './pages/ResumeUpload';
import CandidateForm from './pages/CandidateForm';
import ResumeAnalysis from './pages/ResumeAnalysis';
import ProfilePage from './pages/ProfilePage';
import PersonalDashboardPage from './pages/PersonalDashboardPage';
import PersonalResumePage from './pages/PersonalResumePage';
import PersonalInterviewHubPage from './pages/PersonalInterviewHubPage';
import PersonalInterviewSessionPage from './pages/PersonalInterviewSessionPage';
import PersonalInterviewReportPage from './pages/PersonalInterviewReportPage';
import PersonalInterviewHistoryPage from './pages/PersonalInterviewHistoryPage';

// 布局组件
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * 检查浏览器 WebRTC 和媒体支持
 */
const checkWebRTCSupport = () => {
  console.log('🔍 开始检查 WebRTC 和媒体支持...');
  
  // 检查 getUserMedia
  const hasGetUserMedia = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };
  
  // 检查 RTCPeerConnection
  const hasRTCPeerConnection = () => {
    const RTCPeerConnection = window.RTCPeerConnection || 
                              window.webkitRTCPeerConnection || 
                              window.mozRTCPeerConnection;
    return !!RTCPeerConnection;
  };
  
  // 检查 WebSocket
  const hasWebSocket = () => typeof WebSocket !== 'undefined';
  
  // 检查 H.264 支持
  const checkH264Support = () => {
    const video = document.createElement('video');
    if (!video.canPlayType) return false;
    const h264Support = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
    const h265Support = video.canPlayType('video/mp4; codecs="hev1.1.1.L93.B0"') !== '';
    return { h264: h264Support, h265: h265Support };
  };
  
  const h264 = checkH264Support();
  
  const support = {
    getUserMedia: hasGetUserMedia(),
    RTCPeerConnection: hasRTCPeerConnection(),
    WebSocket: hasWebSocket(),
    H264: h264.h264,
    H265: h264.h265,
    timestamp: new Date().toISOString()
  };
  
  console.log('✅ WebRTC 支持检查结果:', support);
  
  if (!support.getUserMedia) {
    console.warn('⚠️ 浏览器不支持 getUserMedia，虚拟人可能无法正常工作');
  }
  if (!support.RTCPeerConnection) {
    console.warn('⚠️ 浏览器不支持 RTCPeerConnection，虚拟人无法正常工作');
  }
  if (!support.H264 && !support.H265) {
    console.warn('⚠️ 浏览器不支持 H.264/H.265 视频编码，虚拟人可能无法播放');
  }
  
  // 存储到 window 供后续查询
  window.__webrtcSupport = support;
  
  return support;
};

// 初始化检查
checkWebRTCSupport();

// Ant Design Design Token Customization
const antdTheme = {
  token: {
    colorPrimary: '#2563EB',
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorTextBase: '#0F172A',
    colorBgBase: '#F8FAFC',
    colorBorder: '#E2E8F0',
    borderRadius: 10,
    fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
    boxShadowSecondary: '0 8px 32px rgba(15,23,42,0.08)',
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 40,
      paddingInline: 20,
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Card: {
      borderRadius: 16,
    },
    Modal: {
      borderRadius: 20,
    },
    Table: {
      borderRadius: 12,
    },
  },
};

function ChatPageErrorFallback({ error, retry }) {
  const navigate = useNavigate();

  const handleReload = () => {
    retry();
    window.location.reload();
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      background: 'linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 620,
        padding: '32px 28px',
        borderRadius: 20,
        background: '#ffffff',
        border: '1px solid #dbeafe',
        boxShadow: '0 16px 48px rgba(37,99,235,0.12)'
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb', marginBottom: 12 }}>
          面试页面异常恢复
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 28, color: '#0f172a' }}>
          当前面试页面出现渲染异常
        </h2>
        <p style={{ margin: '0 0 8px', color: '#475569', lineHeight: 1.7 }}>
          已进行中的面试会话仍会保留在本地。重新加载页面后，如果检测到未完成会话，系统会提示继续恢复。
        </p>
        <p style={{ margin: '0 0 24px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          {error?.message || '渲染过程中发生未知错误'}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleReload}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '12px 18px',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            重新加载并尝试恢复
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              padding: '12px 18px',
              background: '#fff',
              color: '#334155',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            返回工作台
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    console.log('🚀 App 组件挂载，WebRTC 支持已初始化（未主动申请媒体权限）');
  }, []);

  // ProtectedRoute: 验证用户登录状态和userType
  function ProtectedRoute({ children, allowedTypes }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
      if (!user || !token) {
        logout();
        navigate('/login');
        return;
      }
      const userType = user?.userType || 'CORP';
      if (allowedTypes && !allowedTypes.includes(userType)) {
        // Wrong user type → redirect to correct dashboard
        if (userType === 'PERSONAL') {
          navigate('/personal/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    }, [user, token, navigate]);

    if (!user || !token) return null;
    const userType = user?.userType || 'CORP';
    if (allowedTypes && !allowedTypes.includes(userType)) return null;

    return children;
  }

  return (
    <StyledComponentsConfig>
      <ConfigProvider locale={zhCN} theme={antdTheme}>
        <AntdApp>
          <AuthProvider>
            <Router
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/candidate-form" element={<CandidateForm />} />
                <Route path="/*" element={
                  <Layout>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/dashboard" element={
                        <ProtectedRoute allowedTypes={['CORP']}>
                          <DashboardPage />
                        </ProtectedRoute>
                      } />
                      <Route path="/chat" element={
                        <ProtectedRoute allowedTypes={['CORP']}>
                          <ErrorBoundary fallback={(props) => <ChatPageErrorFallback {...props} />}>
                            <ChatPage />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      } />
                      <Route path="/resume" element={
                        <ProtectedRoute allowedTypes={['CORP']}>
                          <ResumeUpload />
                        </ProtectedRoute>
                      } />
                      <Route path="/resume-analysis" element={
                        <ProtectedRoute allowedTypes={['CORP']}>
                          <ResumeAnalysis />
                        </ProtectedRoute>
                      } />
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <ProfilePage />
                        </ProtectedRoute>
                      } />
                      <Route path="/personal/dashboard" element={
                        <ProtectedRoute allowedTypes={['PERSONAL']}>
                          <PersonalDashboardPage />
                        </ProtectedRoute>
                      } />
                      <Route path="/personal/resume" element={
                        <ProtectedRoute allowedTypes={['PERSONAL']}>
                          <PersonalResumePage />
                        </ProtectedRoute>
                      } />
                      <Route path="/personal/interview" element={
                        <ProtectedRoute allowedTypes={['PERSONAL']}>
                          <PersonalInterviewHubPage />
                        </ProtectedRoute>
                      } />
                      <Route path="/personal/interview/start" element={
                        <ProtectedRoute allowedTypes={['PERSONAL']}>
                          <PersonalInterviewSessionPage />
                        </ProtectedRoute>
                      } />
                      <Route path="/personal/interview/report/:id" element={
                        <ProtectedRoute allowedTypes={['PERSONAL']}>
                          <PersonalInterviewReportPage />
                        </ProtectedRoute>
                      } />
                      <Route path="/personal/interview/history" element={
                        <ProtectedRoute allowedTypes={['PERSONAL']}>
                          <PersonalInterviewHistoryPage />
                        </ProtectedRoute>
                      } />
                    </Routes>
                  </Layout>
                } />
              </Routes>
            </Router>
          </AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </StyledComponentsConfig>
  );
}

export default App;
