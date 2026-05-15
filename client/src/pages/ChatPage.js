import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Select, message } from 'antd';
import styled, { createGlobalStyle } from 'styled-components';
import { motion } from 'framer-motion';
import { ClockCircleOutlined } from '@ant-design/icons';
import VirtualHumanSDK from '../components/VirtualHumanSDK';
import { virtualHumanConfig } from '../config/virtualHumanConfig';
import CandidateSelector from '../components/CandidateSelector';
import { ChatMessages } from '../components/ChatPage';
import { InputBar } from '../components/ChatPage';
import { VirtualHumanPanel } from '../components/ChatPage';
import { InterviewResults } from '../components/ChatPage';
import { QuickBar } from '../components/ChatPage';
import { shouldInjectCompanyContext, buildCompanyContextPrompt } from '../components/ChatPage/constants';
import { colors } from '../theme/colors';
import { useInterview } from '../hooks/useInterview';
import { useVirtualHumanBridge } from '../hooks/useVirtualHumanBridge';

const VIRTUAL_HUMAN_ENABLED = process.env.REACT_APP_VIRTUAL_HUMAN_ENABLED === 'true';
const CHAT_IMAGE_MAX_COUNT = 3;
const CHAT_IMAGE_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const CHAT_IMAGE_MAX_EDGE = 1600;
const CHAT_IMAGE_OUTPUT_QUALITY = 0.72;

function estimateDataUrlBytes(dataUrl = '') {
  const separatorIndex = String(dataUrl).indexOf(',');
  if (separatorIndex === -1) return 0;
  const base64Body = dataUrl.slice(separatorIndex + 1);
  const paddingLength = (base64Body.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.ceil(base64Body.length * 3 / 4) - paddingLength);
}

function compressVisionImage(file) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      let { width, height } = image;
      const longestEdge = Math.max(width, height);
      if (longestEdge > CHAT_IMAGE_MAX_EDGE) {
        const scale = CHAT_IMAGE_MAX_EDGE / longestEdge;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', CHAT_IMAGE_OUTPUT_QUALITY));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`图片处理失败: ${file.name}`));
    };

    image.src = objectUrl;
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const isAutoplayBlocked = event.reason && (
      event.reason.message?.includes('play() failed because the user didn\'t interact') ||
      event.reason.message?.includes('NotAllowedError')
    );
    if (isAutoplayBlocked) { event.preventDefault(); return; }
  });
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('play() failed')) { event.preventDefault(); }
  });
}

const GlobalStyle = createGlobalStyle`
  @keyframes blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes pulse { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.05)} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
`;

const PageWrapper = styled.div`
  background: ${colors.bg}; min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;
const PageHeader = styled.header` padding: 120px 60px 32px; border-bottom: 1px solid ${colors.border}; `;
const HeaderInner = styled.div` max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; `;
const PageTitle = styled(motion.h1)` font-family: 'Noto Serif SC', Georgia, serif; font-size: clamp(32px,4vw,48px); font-weight: 400; color: ${colors.text}; margin: 0 0 16px 0; line-height: 1.2; `;
const PageSubtitle = styled.p` font-size: 15px; color: ${colors.textMuted}; margin: 0; `;
const RuntimeBadge = styled.div`
  display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px;
  border-radius: 12px; border: 1px solid ${colors.border}; background: ${colors.bg}; color: ${colors.text};
  font-size: 12px; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  .dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
  .label { color: ${colors.textMuted}; font-weight: 400; }
  .engine-name { color: ${colors.accent}; font-weight: 600; }
`;
const RuntimeControls = styled.div`
  display: inline-flex; align-items: center; gap: 8px; padding-left: 12px;
  border-left: 1px solid ${colors.border}; margin-left: 4px;
  .runtime-label { color: ${colors.textMuted}; font-size: 12px; }
  .ant-select-selector { border-radius:8px!important; border:1px solid ${colors.border}!important; height:28px!important; padding:0 8px!important; font-size:12px!important; }
  .ant-select-selection-item { line-height:26px!important; }
`;
const InterviewStatusBadge = styled.div`
  background: ${colors.frost}; padding: 10px 16px; border-radius: 12px; font-size: 13px;
  min-width: 140px; text-align: center; border: 1px solid ${colors.border};
  .mode-label { font-weight: 600; margin-bottom: 4px; color: ${colors.text}; }
  .status-text { font-size: 12px; color: ${props => props.$statusColor || colors.textMuted}; font-weight: 500; }
`;
const MainContent = styled.main`
  max-width: 1400px; margin: 0 auto; padding: 40px 60px;
  display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start;
  @media (max-width:1024px) { grid-template-columns: 1fr; }
`;
const ChatCard = styled.div` display: flex; flex-direction: column; `;
const RightColumn = styled.div` display: flex; flex-direction: column; gap: 16px; `;
const ChatPanel = styled.div`
  background: #FFFFFF; border: 1px solid ${colors.border}; border-radius: 16px; overflow: hidden;
  display: flex; flex-direction: column; height: calc(100vh - 280px); min-height: 500px;
`;
const ChatMessagesArea = styled.div`
  flex: 1; overflow-y: auto; padding: 24px; background: ${colors.bg};
  &::-webkit-scrollbar { width:6px; } &::-webkit-scrollbar-track { background:transparent; }
  &::-webkit-scrollbar-thumb { background:${colors.border}; border-radius:3px; }
`;
const InterviewActionBtnWrapper = styled.div`
  background: #FFFFFF; border: 1px solid ${colors.border}; border-radius: 16px;
  padding: 20px; display: flex; justify-content: center;
`;
const InterviewActionBtn = styled.button`
  font-family: 'Noto Sans SC', sans-serif; font-size: 15px; font-weight: 500; letter-spacing: 0.01em;
  color: #FFFFFF; background: ${props => props.$danger ? '#EF4444' : colors.accent};
  border: none; border-radius: 12px; padding: 14px 36px; cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  box-shadow: 0 4px 16px ${props => props.$danger ? 'rgba(239,68,68,0.25)' : 'rgba(37,99,235,0.25)'};
  &:hover { transform: translateY(-2px); box-shadow: 0 8px 24px ${props => props.$danger ? 'rgba(239,68,68,0.3)' : 'rgba(37,99,235,0.3)'}; background: ${props => props.$danger ? '#DC2626' : '#1D4ED8'}; }
  &:active { transform: translateY(0); }
`;

// 右侧栏分区样式（参照 /personal/interview 侧边栏布局）
const RightColumnSection = styled.div`
  margin-bottom: 16px;
`;
const RightColumnTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${colors.border};
`;
const RightColumnIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;
  .anticon {
    font-size: 14px;
    color: ${colors.accent};
  }
`;
const InterviewTimeCard = styled.div`
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  border-radius: 10px;
  padding: 16px;
  text-align: center;
`;
const InterviewTimeValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: 4px;
`;
const InterviewTimeLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const ChatPage = () => {
  // ---- 纯 UI 状态（非面试相关） ----
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showInterviewResults, setShowInterviewResults] = useState(false);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [entryCandidate, setEntryCandidate] = useState(null);
  const [llmRuntimeInfo, setLlmRuntimeInfo] = useState({ source: 'local', model: 'qwen3.5-9b-vlm-gguf', label: '本地模型 · Qwen3.5-9B（图文）' });
  const [enginePreference, setEnginePreference] = useState('local');
  const [localModelPreference] = useState('qwen3.5-9b-vlm-gguf');
  const [attachedImages, setAttachedImages] = useState([]);
  const [showActiveReplyBubble, setShowActiveReplyBubble] = useState(false);
  const [ttsConfig, setTtsConfig] = useState({ voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%', volume: '+0%' });
  const [completedInterviewCandidate, setCompletedInterviewCandidate] = useState(null);
  const interviewStateRef = useRef({ isActive: false, isWaitingForAnswer: false });
  const [interviewStartTime, setInterviewStartTime] = useState(null);
  const [interviewElapsedSeconds, setInterviewElapsedSeconds] = useState(0);

  // ---- Refs ----
  const chatContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // ---- LLM 调用函数 ----
  const fetchLocalLLMReply = useCallback(async (prompt, { mode = 'general', onChunk, history = [], timeoutMs } = {}) => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message: prompt, mode, engine: enginePreference, localModel: localModelPreference, images: attachedImages.map(img => img.dataUrl), history })
    });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `HTTP ${response.status}`); }
    const runtimeInfo = { source: response.headers.get('x-llm-source') || 'unknown', model: response.headers.get('x-llm-model') || '', label: response.headers.get('x-llm-label') || '本地模型' };
    setLlmRuntimeInfo(runtimeInfo);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulatedText += decoder.decode(value);
      if (typeof onChunk === 'function') onChunk(accumulatedText);
    }
    return { text: accumulatedText.trim(), runtimeInfo };
  }, [attachedImages, enginePreference, localModelPreference]);

  const {
    virtualHumanConnected,
    virtualHumanError,
    virtualHumanStatus,
    virtualHumanNeedsInteraction,
    isVirtualPanelCollapsed,
    setIsVirtualPanelCollapsed,
    speechEnabled,
    audioMuted,
    voiceAnswerDraft,
    diagnosticSummary,
    virtualHumanRef,
    appendBotMessage,
    applyVoiceTranscript,
    handleVirtualHumanStatusChange,
    handleVirtualHumanReply,
    handleVirtualHumanAsrMessage,
    handleKeepEditingVoiceAnswer,
    handleDismissVoiceAnswer,
    clearVoiceAnswerDraft,
    finishVirtualHumanStreaming,
    handleRetryVirtualHuman,
    handleCompletedSpeech,
    toggleSpeechEnabled,
    toggleAudioMuted,
  } = useVirtualHumanBridge({
    enabled: VIRTUAL_HUMAN_ENABLED,
    setMessages,
    setStreamingMessage,
    setShowActiveReplyBubble,
    setInputValue,
    getRequiresVoiceConfirm: () => interviewStateRef.current.isActive && interviewStateRef.current.isWaitingForAnswer,
  });

  const addBotMessage = useCallback((text) => {
    appendBotMessage(text, { speak: true, dedupe: true });
  }, [appendBotMessage]);

  // ---- P0-1: useInterview hook 替代 12+ 面试相关 useState ----
  const interview = useInterview({
    fetchLLMReply: fetchLocalLLMReply,
    addBotMessage,
    setIsLoading,
    setStreamingMessage,
    setShowActiveReplyBubble,
  });

  useEffect(() => {
    interviewStateRef.current = {
      isActive: interview.isActive,
      isWaitingForAnswer: interview.isWaitingForAnswer,
    };
  }, [interview.isActive, interview.isWaitingForAnswer]);

  // ---- 面试计时 ----
  useEffect(() => {
    if (!interviewStartTime) {
      setInterviewElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setInterviewElapsedSeconds(Math.floor((Date.now() - interviewStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [interviewStartTime]);

  const formatElapsedTime = useCallback((seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // ---- 派生值 ----
  const currentRounds = Math.floor(messages.filter(msg => msg.type === 'user').length);
  const localEngineSelected = enginePreference === 'local';
  const isVirtualInterviewActive = virtualHumanConnected && interview.isAnyActive;
  const isAnyInterviewActive = interview.isAnyActive || isVirtualInterviewActive;
  const currentInterviewIndex = isVirtualInterviewActive ? 0 : interview.currentQuestionIndex;
  const currentInterviewTotal = interview.totalQuestions;

  const getInterviewStatusText = () => {
    if (interview.isActive) return interview.statusText;
    if (isVirtualInterviewActive) return '数字人面试中';
    return '';
  };
  const getInterviewStatusColor = () => {
    if (interview.isActive && interview.isWaitingForAnswer) return '#faad14';
    return '#52c41a';
  };
  const getLlmRuntimeDotColor = (runtime) => {
    if (!runtime || runtime.source === 'unknown') return colors.textMuted;
    const label = String(runtime.label || '');
    if (label.includes('未就绪') || label.includes('失败')) return '#ef4444';
    return '#52c41a';
  };

  // ---- URL 参数预选候选人 ----
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const candidateParam = urlParams.get('candidate');
    if (!candidateParam) { setEntryCandidate(null); return; }
    try { setEntryCandidate(JSON.parse(candidateParam)); } catch { setEntryCandidate(null); }
  }, []);

  // ---- 语音识别 ----
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';
      recognitionRef.current.onstart = () => setIsRecording(true);
      recognitionRef.current.onresult = (event) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
        if (transcript) {
          applyVoiceTranscript(transcript, { source: 'browser-asr' });
        }
        setIsRecording(false);
      };
      recognitionRef.current.onerror = () => setIsRecording(false);
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, [applyVoiceTranscript]);
  const startRecording = () => { if (recognitionRef.current) recognitionRef.current.start(); };
  const stopRecording = () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  const scrollToBottom = () => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; };
  useEffect(() => { scrollToBottom(); }, [messages, streamingMessage, isLoading, showActiveReplyBubble]);

  // ---- 挂载时检查可恢复会话 (P2-2) ----
  useEffect(() => {
    interview.checkRecoverableSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 引擎/记忆/候选人的操作 ----
  const handleEnginePreferenceChange = (key) => { setEnginePreference(key); };
  const handleMemoryToggleChange = (enabled) => {
    // P2-1: 二次确认
    if (!enabled) {
      import('antd').then(({ Modal }) => {
        Modal.confirm({
          title: '确认清空对话历史？',
          content: '关闭记忆将立即清空所有对话历史，此操作不可撤销。面试进行中时尤其危险。',
          okText: '确认清空',
          cancelText: '取消',
          okType: 'danger',
          onOk: () => { setMemoryEnabled(false); setMessages([]); message.info('已清空对话历史'); },
        });
      });
      return;
    }
    setMemoryEnabled(enabled);
  };

  // ---- 开始面试 ----
  const handleStartInterviewClick = async () => {
    if (entryCandidate) {
      setShowCandidateSelector(false);
      await interview.startInterview(entryCandidate);
      setInterviewStartTime(Date.now());
    } else {
      setShowCandidateSelector(true);
    }
  };
  const handleCandidateSelect = async (candidate) => {
    setEntryCandidate(candidate);
    await interview.startInterview(candidate);
    setInterviewStartTime(Date.now());
  };

  // ---- 结束面试 ----
  const handleEndInterview = async () => {
    const result = await interview.endInterview();
    if (result?.blocked) {
      message.warning('请先提交当前问题的回答，并等待系统完成最后一题分析后再结束面试');
      return;
    }
    if (result?.candidate) setCompletedInterviewCandidate(result.candidate);
    message.info('面试已结束');
    setInterviewStartTime(null);
  };

  // ---- 发送消息 ----
  const sendMessage = async () => {
    const textValue = String(inputValue || '').trim();
    if (!textValue && attachedImages.length === 0) return;
    const rawUserInput = textValue;
    let modelInput = rawUserInput;
    if (memoryEnabled) {
      modelInput = shouldInjectCompanyContext(rawUserInput) ? buildCompanyContextPrompt(rawUserInput) : rawUserInput;
    }
    const userMessage = { id: Date.now(), type: 'user', content: rawUserInput, images: [...attachedImages], timestamp: new Date() };
    const maxMessages = memoryEnabled ? 12 : 0;
    const conversationHistory = memoryEnabled
      ? [...messages.filter(msg => msg && String(msg.content || '').trim()).slice(-maxMessages).map(msg => ({ role: msg.type === 'bot' ? 'assistant' : 'user', content: String(msg.content || '').trim() })), { role: 'user', content: modelInput }]
      : [];
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAttachedImages([]);
    clearVoiceAnswerDraft();

    // 面试模式 → 通过 hook 提交回答
    if (interview.isActive && interview.isWaitingForAnswer) {
      try {
        const { isComplete, error } = await interview.submitAnswer(rawUserInput);
        if (error) {
          message.error(`生成下一题失败：${error}`);
          return;
        }
        if (isComplete) {
          setIsLoading(true);
          setShowActiveReplyBubble(true);
          setStreamingMessage('正在分析最后一题并生成面试报告...');
          try {
            const result = await interview.completeInterview();
            if (result?.candidate) setCompletedInterviewCandidate(result.candidate);
            const closingMsg = '感谢您参与本次面试，您的回答已记录。如果您的成绩符合我们的要求，我们会在近期联系您。';
            setMessages(prev => [...prev, { id: Date.now() + 2, type: 'bot', content: closingMsg, timestamp: new Date() }]);
          } finally {
            setIsLoading(false);
            setShowActiveReplyBubble(false);
            setStreamingMessage('');
          }
        }
        return;
      } catch (error) {
        message.error(`面试回答提交失败：${error.message || '未知错误'}`);
      }
      return;
    }

    // 普通聊天模式
    setIsLoading(true);
    setShowActiveReplyBubble(true);
    setStreamingMessage('');
    try {
      const { text: replyText } = await fetchLocalLLMReply(modelInput, { mode: 'interview', onChunk: setStreamingMessage, history: conversationHistory.slice(-12) });
      const botMessage = { id: Date.now() + 4, type: 'bot', content: replyText, timestamp: new Date() };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      message.error(`回答失败：${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
    }
  };

  const handleConfirmVoiceAnswer = async () => {
    const draftText = String(inputValue || voiceAnswerDraft?.text || '').trim();
    if (!draftText) return;
    await sendMessage();
  };

  // ---- 图片处理（并发场景下限制前端图片内存占用） ----
  const handleSelectVisionImage = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = CHAT_IMAGE_MAX_COUNT - attachedImages.length;
    if (remainingSlots <= 0) {
      message.warning(`最多只能添加 ${CHAT_IMAGE_MAX_COUNT} 张图片`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (filesToProcess.length < files.length) {
      message.warning(`最多只能添加 ${CHAT_IMAGE_MAX_COUNT} 张图片，已忽略超出的文件`);
    }

    const nextImages = [];
    let totalBytes = attachedImages.reduce((sum, image) => sum + estimateDataUrlBytes(image.dataUrl), 0);

    for (const file of filesToProcess) {
      try {
        const dataUrl = await compressVisionImage(file);
        const imageBytes = estimateDataUrlBytes(dataUrl);

        if (totalBytes + imageBytes > CHAT_IMAGE_MAX_TOTAL_BYTES) {
          message.warning(`图片总大小不能超过 ${Math.round(CHAT_IMAGE_MAX_TOTAL_BYTES / 1024 / 1024)}MB`);
          break;
        }

        totalBytes += imageBytes;
        nextImages.push({ id: Date.now() + Math.random(), name: file.name, dataUrl });
      } catch (error) {
        message.error(error.message || '图片处理失败');
      }
    }

    if (nextImages.length > 0) {
      setAttachedImages(prev => [...prev, ...nextImages]);
    }
  };
  const removeAttachedImage = (id) => { setAttachedImages(prev => prev.filter(img => img.id !== id)); };

  useEffect(() => {
    if (!virtualHumanConnected || !interview.isCompleted) return;
    const latestBotMessage = [...messages].reverse().find(msg => msg.type === 'bot');
    handleCompletedSpeech(latestBotMessage);
  }, [virtualHumanConnected, interview.isCompleted, messages, handleCompletedSpeech]);

  // ---- 恢复会话 ----
  const handleRecoverSession = () => {
    if (interview.recoverableSession) {
      interview.recoverSession(interview.recoverableSession);
      message.info('已恢复面试会话');
    }
  };
  const handleDismissRecovery = () => { interview.dismissRecovery(); };

  return (
    <PageWrapper>
      <GlobalStyle />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box} ::selection{background:${colors.highlight};color:#FFF} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:${colors.bg}} ::-webkit-scrollbar-thumb{background:${colors.border}}
        @media(max-width:768px){.page-header{padding:32px 24px 24px}.main-content{padding:24px}}
      `}</style>

      <PageHeader className="page-header">
        <HeaderInner>
          <div>
            <PageTitle initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>招聘灵犀</PageTitle>
            <PageSubtitle>为您提供专业的AI数字人面试服务</PageSubtitle>
          </div>
          <RuntimeBadge>
            <span className="dot" style={{ background: getLlmRuntimeDotColor(llmRuntimeInfo) }} />
            <span className="label">当前引擎</span>
            <span className="engine-name">{llmRuntimeInfo.label}</span>
            <RuntimeControls>
              <span className="runtime-label">切换</span>
              <Select size="small" style={{ width: 120 }} value={enginePreference} onChange={handleEnginePreferenceChange}
                options={[
                  { value: 'xunfei', label: '讯飞数字人', disabled: !VIRTUAL_HUMAN_ENABLED },
                  { value: 'local', label: '本地模型' }
                ]}
              />
            </RuntimeControls>
          </RuntimeBadge>
          {isAnyInterviewActive && (
            <InterviewStatusBadge $statusColor={getInterviewStatusColor()}>
              <div className="mode-label">{isVirtualInterviewActive ? '数字人面试' : 'LLM面试模式'}</div>
              <div className="status-text">问题: {currentInterviewIndex + 1} / {currentInterviewTotal}</div>
              <div className="status-text" style={{ color: getInterviewStatusColor(), marginTop: 2 }}>{getInterviewStatusText()}</div>
            </InterviewStatusBadge>
          )}
        </HeaderInner>
      </PageHeader>

      <MainContent className="main-content">
        <ChatCard>
          <QuickBar setInputValue={setInputValue} />
          {/* P2-2: 恢复面试提示 */}
          {interview.hasRecoverableSession && (
            <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#ad6800' }}>检测到未完成的面试会话，是否恢复？</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleRecoverSession} style={{ background: colors.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}>恢复</button>
                <button onClick={handleDismissRecovery} style={{ background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}>放弃</button>
              </div>
            </div>
          )}
          <ChatPanel>
            <ChatMessagesArea ref={chatContainerRef}>
              <ChatMessages messages={messages} streamingMessage={streamingMessage} showActiveReplyBubble={showActiveReplyBubble} />
            </ChatMessagesArea>
            <InputBar
              inputValue={inputValue} setInputValue={setInputValue}
              isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}
              voiceAnswerDraft={voiceAnswerDraft}
              onConfirmVoiceAnswer={handleConfirmVoiceAnswer}
              onKeepEditingVoiceAnswer={handleKeepEditingVoiceAnswer}
              onDismissVoiceAnswer={handleDismissVoiceAnswer}
              memoryEnabled={memoryEnabled} handleMemoryToggleChange={handleMemoryToggleChange}
              currentRounds={currentRounds} enginePreference={enginePreference}
              localEngineSelected={localEngineSelected} localVisionEnabled={true}
              attachedImages={attachedImages} removeAttachedImage={removeAttachedImage}
              imageInputRef={imageInputRef} handleSelectVisionImage={handleSelectVisionImage}
              sendMessage={sendMessage} isLoading={isLoading}
              ttsConfig={ttsConfig} setTtsConfig={setTtsConfig}
            />
          </ChatPanel>
          <InterviewResults
            interviewScoring={interview.scoring}
            completedInterviewCandidate={completedInterviewCandidate}
            showInterviewResults={showInterviewResults}
            setShowInterviewResults={setShowInterviewResults}
          />
        </ChatCard>

        <RightColumn>
          {isAnyInterviewActive && (
            <RightColumnSection>
              <RightColumnTitle>
                <RightColumnIcon>
                  <ClockCircleOutlined />
                </RightColumnIcon>
                面试计时
              </RightColumnTitle>
              <InterviewTimeCard>
                <InterviewTimeValue>{formatElapsedTime(interviewElapsedSeconds)}</InterviewTimeValue>
                <InterviewTimeLabel>已进行时间</InterviewTimeLabel>
              </InterviewTimeCard>
            </RightColumnSection>
          )}
          <InterviewActionBtnWrapper>
            {!isAnyInterviewActive ? (
              <InterviewActionBtn onClick={handleStartInterviewClick}>
                {entryCandidate ? `开始面试 · ${entryCandidate.name}` : '开始面试'}
              </InterviewActionBtn>
            ) : (
              <InterviewActionBtn $danger onClick={handleEndInterview} disabled={interview.isScoring}>
                {interview.isScoring ? '生成报告中...' : '结束面试'}
              </InterviewActionBtn>
            )}
          </InterviewActionBtnWrapper>
          <VirtualHumanPanel
            virtualHumanConnected={virtualHumanConnected} virtualHumanError={virtualHumanError}
            virtualHumanStatus={virtualHumanStatus}
            virtualHumanNeedsInteraction={virtualHumanNeedsInteraction}
            isVirtualPanelCollapsed={isVirtualPanelCollapsed} setIsVirtualPanelCollapsed={setIsVirtualPanelCollapsed}
            sdkEnabled={VIRTUAL_HUMAN_ENABLED}
            onRetryConnect={handleRetryVirtualHuman}
            speechEnabled={speechEnabled}
            audioMuted={audioMuted}
            onToggleSpeechEnabled={toggleSpeechEnabled}
            onToggleAudioMuted={toggleAudioMuted}
            diagnosticSummary={diagnosticSummary}
          >
            {VIRTUAL_HUMAN_ENABLED && (
              <VirtualHumanSDK
                ref={virtualHumanRef}
                config={virtualHumanConfig}
                onStatusChange={handleVirtualHumanStatusChange}
                onVirtualHumanReply={handleVirtualHumanReply}
                onVirtualHumanStreamingEnd={finishVirtualHumanStreaming}
                onAsrMessage={handleVirtualHumanAsrMessage}
              />
            )}
          </VirtualHumanPanel>
        </RightColumn>
      </MainContent>

      <CandidateSelector visible={showCandidateSelector} onSelect={handleCandidateSelect} onCancel={() => setShowCandidateSelector(false)} />
    </PageWrapper>
  );
};

export default ChatPage;
