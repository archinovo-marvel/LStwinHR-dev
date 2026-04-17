import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './App.css';
import './antd-fixes.css';
import { StyledComponentsConfig } from './styled-components-config';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// 页面组件
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import ResumeUpload from './pages/ResumeUpload';
import CandidateForm from './pages/CandidateForm';
import ResumeAnalysis from './pages/ResumeAnalysis';
import ProfilePage from './pages/ProfilePage';

// 布局组件
import Layout from './components/Layout';

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

function App() {
  useEffect(() => {
    console.log('🚀 App 组件挂载，WebRTC 支持已初始化（未主动申请媒体权限）');
  }, []);

  return (
    <StyledComponentsConfig>
      <ConfigProvider locale={zhCN}>
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
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/resume" element={<ResumeUpload />} />
                    <Route path="/resume-analysis" element={<ResumeAnalysis />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </Router>
        </AuthProvider>
      </ConfigProvider>
    </StyledComponentsConfig>
  );
}

export default App;
