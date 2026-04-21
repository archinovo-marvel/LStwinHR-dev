import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Select, message } from 'antd';
import styled, { createGlobalStyle } from 'styled-components';
import axios from 'axios';
import VirtualHumanSDK from '../components/VirtualHumanSDK';
import { virtualHumanConfig } from '../config/virtualHumanConfig';
import InterviewStorage from '../utils/interviewStorage';
import InterviewScoring from '../utils/interviewScoring';
import CandidateSelector from '../components/CandidateSelector';
import { ChatMessages } from '../components/ChatPage';
import { InputBar } from '../components/ChatPage';
import { VirtualHumanPanel } from '../components/ChatPage';
import { InterviewResults } from '../components/ChatPage';
import { QuickBar } from '../components/ChatPage';
import { shouldInjectCompanyContext, buildCompanyContextPrompt, quickQuestions } from '../components/ChatPage/constants';
import { colors } from '../../theme/colors';

const VIRTUAL_HUMAN_ENABLED = process.env.REACT_APP_VIRTUAL_HUMAN_ENABLED === 'true';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const isAutoplayBlocked = event.reason && (
      event.reason.message?.includes('play() failed because the user didn\'t interact') ||
      event.reason.message?.includes('NotAllowedError')
    );
    if (isAutoplayBlocked) {
      event.preventDefault();
      return;
    }
  });
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('play() failed')) {
      event.preventDefault();
    }
  });
}

// Custom SVG Icons
const IconSend = ({ size = 16, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const GlobalStyle = createGlobalStyle`
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { transform: translateX(-50%) scale(1); }
    50% { transform: translateX(-50%) scale(1.05); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
`;

// Styles
const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const PageHeader = styled.header`
  padding: 120px 60px 32px;
  border-bottom: 1px solid ${colors.border};
`;

const HeaderInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const SectionLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 12px;
`;

const PageTitle = styled.h1`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 16px 0;
  line-height: 1.2;
`;

const PageSubtitle = styled.p`
  font-size: 15px;
  color: ${colors.textMuted};
  margin: 0;
`;

const RuntimeBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid ${colors.border};
  background: ${colors.bg};
  color: ${colors.text};
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  .label {
    color: ${colors.textMuted};
    font-weight: 400;
  }

  .engine-name {
    color: ${colors.accent};
    font-weight: 600;
  }
`;

const RuntimeControls = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid ${colors.border};
  margin-left: 4px;

  .runtime-label {
    color: ${colors.textMuted};
    font-size: 12px;
  }

  .ant-select-selector {
    border-radius: 8px !important;
    border: 1px solid ${colors.border} !important;
    height: 28px !important;
    padding: 0 8px !important;
    font-size: 12px !important;
  }

  .ant-select-selection-item {
    line-height: 26px !important;
  }
`;

const InterviewStatusBadge = styled.div`
  background: ${colors.bgSecondary};
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 13px;
  min-width: 140px;
  text-align: center;
  border: 1px solid ${colors.border};

  .mode-label {
    font-weight: 600;
    margin-bottom: 4px;
    color: ${colors.text};
  }

  .status-text {
    font-size: 12px;
    color: ${props => props.$statusColor || colors.textMuted};
    font-weight: 500;
  }
`;

const MainContent = styled.main`
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 60px;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ChatCard = styled.div`
  display: flex;
  flex-direction: column;
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ChatPanel = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 280px);
  min-height: 500px;
`;

const ChatMessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: ${colors.bg};

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 3px; }
`;

const InterviewActionBtnWrapper = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 20px;
  display: flex;
  justify-content: center;
`;

const InterviewActionBtn = styled.button`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: #FFFFFF;
  background: ${props => props.$danger ? colors.danger : colors.accent};
  border: none;
  border-radius: 12px;
  padding: 14px 36px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 16px rgba(44, 44, 44, 0.15);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(44, 44, 44, 0.2);
    background: ${props => props.$danger ? colors.danger : colors.highlight};

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(0);
  }
`;

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showInterviewResults, setShowInterviewResults] = useState(false);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [entryCandidate, setEntryCandidate] = useState(null);
  const [interviewScoring, setInterviewScoring] = useState(null);
  const [completedInterviewCandidate, setCompletedInterviewCandidate] = useState(null);
  const [llmRuntimeInfo, setLlmRuntimeInfo] = useState({
    source: 'local',
    model: 'qwen3.5-9b-vlm-gguf',
    label: '本地模型 · Qwen3.5-9B（图文）'
  });
  const [enginePreference, setEnginePreference] = useState('local');
  const [localModelPreference, setLocalModelPreference] = useState('qwen3.5-9b-vlm-gguf');
  const [availableLocalModels, setAvailableLocalModels] = useState([]);
  const [attachedImages, setAttachedImages] = useState([]);
  const [virtualHumanConnected, setVirtualHumanConnected] = useState(false);
  const [virtualHumanError, setVirtualHumanError] = useState(false);
  const [isVirtualPanelCollapsed, setIsVirtualPanelCollapsed] = useState(false);
  const [interviewState, setInterviewState] = useState(null);
  const [isInterviewMode, setIsInterviewMode] = useState(false);
  const [currentInterviewSession, setCurrentInterviewSession] = useState(null);
  const [showActiveReplyBubble, setShowActiveReplyBubble] = useState(false);
  const [aiInterviewQuestions, setAiInterviewQuestions] = useState([]);
  const [fallbackInterviewState, setFallbackInterviewState] = useState({
    isEnabled: false,
    currentQuestionIndex: -1,
    currentQuestionText: '',
    isWaitingForAnswer: false
  });

  const [ttsConfig, setTtsConfig] = useState({
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: '+0%',
    volume: '+0%'
  });

  const chatContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const interviewStorage = useRef(new InterviewStorage());
  const interviewScoringSystem = useRef(new InterviewScoring());
  const recognitionRef = useRef(null);

  const speechRecognitionSupported = typeof window !== 'undefined' && (
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  );

  const currentRounds = Math.floor(messages.filter(msg => msg.type === 'user').length);
  const localEngineSelected = enginePreference === 'local';
  const localVisionEnabled = true;

  const isVirtualInterviewActive = virtualHumanConnected;
  const isAnyInterviewActive = isInterviewMode || fallbackInterviewState.isEnabled;
  const currentInterviewIndex = interviewState?.currentQuestionIndex || fallbackInterviewState.currentQuestionIndex || 0;
  const currentInterviewTotal = interviewState?.totalQuestions || fallbackInterviewState.totalQuestions || 6;

  const getInterviewStatusText = () => {
    if (fallbackInterviewState.isEnabled) {
      return fallbackInterviewState.isWaitingForAnswer ? '等待回答' : '生成问题中';
    }
    if (isVirtualInterviewActive) {
      return interviewState?.isWaitingForAnswer ? '等待回答' : '面试中';
    }
    return '';
  };

  const getInterviewStatusColor = () => {
    if (fallbackInterviewState.isWaitingForAnswer || interviewState?.isWaitingForAnswer) return colors.warning;
    return colors.success;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const candidateParam = urlParams.get('candidate');
    if (!candidateParam) { setEntryCandidate(null); return; }
    try {
      const parsed = JSON.parse(candidateParam);
      setEntryCandidate(parsed);
    } catch {
      setEntryCandidate(null);
    }
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onstart = () => setIsRecording(true);
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsRecording(false);
      };
      recognitionRef.current.onerror = () => setIsRecording(false);
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages, streamingMessage, isLoading, showActiveReplyBubble]);

  const handleEnginePreferenceChange = (key) => {
    setEnginePreference(key);
  };

  const handleMemoryToggleChange = (enabled) => {
    setMemoryEnabled(enabled);
    if (!enabled) { setMessages([]); message.info('已清空对话历史'); }
  };

  const startInterviewMode = useCallback((candidate) => {
    setIsInterviewMode(true);
    setSelectedCandidate(candidate);
    setShowCandidateSelector(false);
    interviewStorage.current.startSession({
      id: Date.now(),
      candidateId: candidate?.id,
      candidateName: candidate?.name,
      position: candidate?.position
    });
    const session = interviewStorage.current.getCurrentSession();
    setCurrentInterviewSession(session);
  }, []);

  const handleStartInterviewClick = () => {
    if (entryCandidate) {
      startInterviewMode(entryCandidate);
    } else {
      setShowCandidateSelector(true);
    }
  };

  const handleCandidateSelect = (candidate) => {
    setEntryCandidate(candidate);
    startInterviewMode(candidate);
    setTimeout(() => startFallbackInterview(candidate), 200);
  };

  const fetchLocalLLMReply = useCallback(async (prompt, { mode = 'general', onChunk, history = [] } = {}) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        mode,
        engine: enginePreference,
        localModel: localModelPreference,
        images: attachedImages.map(img => img.dataUrl),
        history
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const runtimeInfo = {
      source: response.headers.get('x-llm-source') || 'unknown',
      model: response.headers.get('x-llm-model') || '',
      label: response.headers.get('x-llm-label') || '本地模型'
    };
    setLlmRuntimeInfo(runtimeInfo);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      accumulatedText += chunk;
      if (typeof onChunk === 'function') onChunk(accumulatedText);
    }
    return { text: accumulatedText.trim(), runtimeInfo };
  }, [attachedImages, enginePreference, localModelPreference]);

  const finalizeInterview = useCallback(async (candidateOverride) => {
    const candidateForSave = candidateOverride || selectedCandidate || entryCandidate;
    const session = interviewStorage.current.getCurrentSession();
    const answers = session?.conversation?.candidateAnswers || [];
    if (!answers.length) return;

    const closingMessage = '感谢您参与本次面试，您的回答已记录。如果您的成绩符合我们的要求，我们会在近期联系您。';
    setMessages(prev => [...prev, { id: Date.now() + 2, type: 'bot', content: closingMessage, timestamp: new Date() }]);
    setFallbackInterviewState(prev => ({ ...prev, isWaitingForAnswer: false }));

    const scoring = interviewScoringSystem.current.calculateScore(session?.conversation || session);
    setInterviewScoring(scoring);
    setCompletedInterviewCandidate(candidateForSave);

    let interviewReport = '';
    try {
      const reportPrompt = `你是一个面试评估专家。根据以下面试对话生成一份简洁的面试报告。

面试信息：
- 候选人：${candidateForSave?.name || '未知'}
- 岗位：${candidateForSave?.position || '未知'}
- 面试问题数量：${session?.conversation?.questions?.length || 0}
- 回答数量：${session?.conversation?.candidateAnswers?.length || 0}

面试问答记录：
${(session?.conversation?.questions || []).map((q, i) => {
  const answer = session?.conversation?.candidateAnswers?.[i] || '（未回答）';
  return `第${i + 1}题：${q.question || q}\n回答：${answer}`;
}).join('\n\n')}

评分详情：
- 回答质量得分：${scoring.categoryScores?.answerQuality?.score?.toFixed(1) || '0'}/40
- 沟通能力得分：${scoring.categoryScores?.communication?.score?.toFixed(1) || '0'}/25
- 专业能力得分：${scoring.categoryScores?.professionalism?.score?.toFixed(1) || '0'}/20
- 态度动机得分：${scoring.categoryScores?.attitude?.score?.toFixed(1) || '0'}/15
- 总分：${scoring.totalScore || 0}/100

【输出示例】
整体评价：该候选人在面试中表现出较强的技术深度，对项目中用到的DenseNet调参经验较丰富，能清晰描述技术细节。回答逻辑清晰，沟通表达能力良好。
优势：1. 技术基础扎实，对模型优化有实战经验；2. 表达流畅，逻辑性强；3. 学习动机明确，对AI领域保持持续关注。
不足：1. 缺乏大规模分布式训练经验；2. 对产品思维和业务落地场景理解偏浅。
建议：可安排二面，侧重考察其系统性思维和跨团队协作能力。

【强制要求】
1. 按上述示例格式输出，包含：整体评价、优势、不足、建议四个部分
2. 每部分1-3句话，语言简洁专业，总字数控制在200字以内
3. 不要使用markdown格式，直接输出纯文本
4. 不要输出任何思考过程

直接输出面试报告：`;

      const { text: reportText } = await fetchLocalLLMReply(reportPrompt, {
        mode: 'general',
        onChunk: () => {}
      });
      interviewReport = (reportText || '').trim();
    } catch (reportError) {
      console.warn('生成面试报告失败:', reportError);
    }

    if (!interviewReport) {
      const level = scoring.totalScore >= 80 ? '优秀' : scoring.totalScore >= 70 ? '良好' : scoring.totalScore >= 60 ? '一般' : '待提升';
      interviewReport = `整体评价：面试总分${scoring.totalScore}分，表现${level}。${scoring.totalScore >= 60 ? '基本符合岗位要求，建议考虑录用。' : '与岗位要求存在差距，建议慎重考虑。'}`;
    }

    if (candidateForSave?.id) {
      try {
        const response = await axios.post('/api/candidates/interview-score', {
          candidateId: candidateForSave.id,
          interviewScore: scoring.totalScore,
          interviewDetails: {
            totalScore: scoring.totalScore,
            report: interviewReport,
            categoryScores: scoring.categoryScores
          },
          interviewDate: new Date().toISOString()
        });
        console.log('面试分保存成功:', response.data);
        window.dispatchEvent(new Event('interviewScoreSaved'));
      } catch (apiError) {
        console.error('面试分保存失败:', apiError);
        message.error('面试分保存失败: ' + (apiError.response?.data?.error || apiError.message));
      }
    }
    setShowInterviewResults(true);
    setInputValue('');
  }, [selectedCandidate, entryCandidate, fetchLocalLLMReply]);

  const endInterviewMode = useCallback(async () => {
    await finalizeInterview();
    setIsInterviewMode(false);
    setInterviewState(null);
    setFallbackInterviewState({ isEnabled: false, currentQuestionIndex: -1, currentQuestionText: '', isWaitingForAnswer: false });
    message.info('面试已结束');
  }, [finalizeInterview, currentInterviewSession]);

  const startFallbackInterview = useCallback(async (candidateInfo) => {
    const MIN_QUESTIONS = 6;
    setFallbackInterviewState({
      isEnabled: true,
      currentQuestionIndex: 0,
      currentQuestionText: '',
      isWaitingForAnswer: false,
      totalQuestions: MIN_QUESTIONS
    });
    setIsLoading(true);
    setShowActiveReplyBubble(true);
    setStreamingMessage('正在生成首个面试问题...');

    try {
      const prompt = [
        '你是专业面试官。生成第1个面试问题。',
        `候选人：${candidateInfo?.name || '未知'}`,
        `岗位：${candidateInfo?.position || '管培生'}`,
        `MBTI：${candidateInfo?.mbti || '未知'}`,
        '要求：问题要具体、专业。只输出问题本身。'
      ].join('\n');

      const { text: questionText } = await fetchLocalLLMReply(prompt, {
        mode: 'interview',
        onChunk: setStreamingMessage
      });

      const botMessage = { id: Date.now() + 1, type: 'bot', content: questionText, timestamp: new Date() };
      setMessages(prev => [...prev, botMessage]);
      interviewStorage.current.addQuestion(questionText, 'interview');
      setCurrentInterviewSession(interviewStorage.current.getCurrentSession());
      setFallbackInterviewState(prev => ({ ...prev, currentQuestionText: questionText, isWaitingForAnswer: true }));
    } catch (error) {
      message.error(`面试启动失败：${error.message}`);
    } finally {
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
    }
  }, [fetchLocalLLMReply]);

  const getChatFallbackErrorMessage = (error) => {
    if (error.message?.includes('fetch')) return '网络连接失败，请检查网络';
    if (error.message?.includes('500')) return '服务器错误，请稍后重试';
    return error.message || '未知错误';
  };

  const sendMessage = async () => {
    const textValue = String(inputValue || '').trim();
    if (!textValue && attachedImages.length === 0) return;

    const rawUserInput = textValue;
    let modelInput = rawUserInput;

    if (memoryEnabled) {
      modelInput = shouldInjectCompanyContext(rawUserInput)
        ? buildCompanyContextPrompt(rawUserInput)
        : rawUserInput;
    }

    const userMessage = { id: Date.now(), type: 'user', content: rawUserInput, images: [...attachedImages], timestamp: new Date() };
    const maxMessages = memoryEnabled ? 12 : 0;
    const conversationHistory = memoryEnabled
      ? [...messages.filter(msg => msg && String(msg.content || '').trim()).slice(-maxMessages).map(msg => ({ role: msg.type === 'bot' ? 'assistant' : 'user', content: String(msg.content || '').trim() })), { role: 'user', content: modelInput }]
      : [];

    setMessages(prev => [...prev, userMessage]);

    if (isInterviewMode && currentInterviewSession) {
      interviewStorage.current.addCandidateAnswer(rawUserInput);
      setCurrentInterviewSession(interviewStorage.current.getCurrentSession());
    }

    const isFallbackAnswerTurn = !!(fallbackInterviewState.isEnabled && fallbackInterviewState.isWaitingForAnswer);

    if (isFallbackAnswerTurn) {
      const totalQuestions = fallbackInterviewState.totalQuestions || 6;
      const isLastQuestion = fallbackInterviewState.currentQuestionIndex >= totalQuestions - 1;

      if (isLastQuestion) {
        await finalizeInterview();
        return;
      }

      setFallbackInterviewState(prev => ({ ...prev, isWaitingForAnswer: false }));
      setIsLoading(true);
      setShowActiveReplyBubble(true);
      setStreamingMessage('AI正在思考...');

      try {
        const nextIndex = fallbackInterviewState.currentQuestionIndex + 1;
        const prompt = `你是一个严格的面试官。候选人刚回答了：${rawUserInput}

【强制要求】
1. 禁止评价、分析、总结候选人的回答
2. 禁止输出任何思考过程、内心OS、自我说明
3. 禁止输出"好的"、"根据你的回答"等引导语
4. 只输出一个面试追问问题，用中文
5. 问题必须从候选人回答中提取具体内容进行深入追问，不得另起炉灶开新话题

【示例】候选人说："我在项目中用了DenseNet做图像分类，准确率达到了95%。"
- 正确追问："你提到DenseNet的准确率达到95%，能具体说说你是如何调参的吗？哪些参数对性能影响最大？"
- 错误追问（已禁止）："你为什么选择计算机视觉方向？"（另起炉灶）
- 错误追问（已禁止）："好的，你的项目经验很丰富。"（评价总结）

【结构要求】
必须从候选人回答中找出"一个具体点"（如数据、方法、结果、困难等），然后就此点追问"为什么"或"怎么做"。每次只追问一个点，不要贪多。

直接输出追问问题，不要任何其他内容：`;

        const { text: questionText } = await fetchLocalLLMReply(prompt, {
          mode: 'interview',
          onChunk: setStreamingMessage
        });

        setMessages(prev => [...prev, { id: Date.now() + 3, type: 'bot', content: questionText, timestamp: new Date() }]);
        interviewStorage.current.addQuestion(questionText, 'interview');
        setCurrentInterviewSession(interviewStorage.current.getCurrentSession());
        setFallbackInterviewState(prev => ({ ...prev, currentQuestionIndex: nextIndex, currentQuestionText: questionText, isWaitingForAnswer: true }));
      } catch (error) {
        message.error(`生成问题失败：${getChatFallbackErrorMessage(error)}`);
      } finally {
        setIsLoading(false);
        setShowActiveReplyBubble(false);
        setStreamingMessage('');
        setInputValue('');
      }
      return;
    }

    // Normal chat mode
    setIsLoading(true);
    setShowActiveReplyBubble(true);
    setStreamingMessage('');

    try {
      const { text: replyText } = await fetchLocalLLMReply(modelInput, {
        mode: 'interview',
        onChunk: setStreamingMessage,
        history: conversationHistory.slice(-12)
      });

      const botMessage = { id: Date.now() + 4, type: 'bot', content: replyText, timestamp: new Date() };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      message.error(`回答失败：${getChatFallbackErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
      setInputValue('');
      setAttachedImages([]);
    }
  };

  const handleSelectVisionImage = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedImages(prev => [...prev, { id: Date.now() + Math.random(), name: file.name, dataUrl: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachedImage = (id) => {
    setAttachedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleVirtualHumanStatusChange = (status) => {
    setVirtualHumanConnected(status === 'connected');
    setVirtualHumanError(status === 'error');
  };

  const handleVirtualHumanReply = (text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), type: 'bot', content: text, timestamp: new Date() }]);
  };

  const finishVirtualHumanStreaming = () => {
    setStreamingMessage('');
    setShowActiveReplyBubble(false);
  };

  const getLlmRuntimeDotColor = (runtime) => {
    if (!runtime || runtime.source === 'unknown') return colors.textMuted;
    const label = String(runtime.label || '');
    if (label.includes('未就绪') || label.includes('失败')) return colors.danger;
    return colors.success;
  };

  return (
    <PageWrapper>
      <GlobalStyle />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::selection { background: ${colors.highlight}; color: #FFFFFF; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${colors.bg}; }
        ::-webkit-scrollbar-thumb { background: ${colors.border}; }
        @media (max-width: 768px) {
          .page-header { padding: 32px 24px 24px; }
          .main-content { padding: 24px; }
        }
      `}</style>

      <PageHeader className="page-header">
        <HeaderInner>
          <div>
            <PageTitle>招聘灵犀</PageTitle>
            <PageSubtitle>为您提供专业的AI数字人面试服务</PageSubtitle>
          </div>
          <RuntimeBadge>
            <span className="dot" style={{ background: getLlmRuntimeDotColor(llmRuntimeInfo) }} />
            <span className="label">当前引擎</span>
            <span className="engine-name">{llmRuntimeInfo.label}</span>
            <RuntimeControls>
              <span className="runtime-label">切换</span>
              <Select
                size="small"
                style={{ width: 120 }}
                value={enginePreference}
                onChange={handleEnginePreferenceChange}
                options={[
                  { value: 'xunfei', label: '讯飞数字人', disabled: !VIRTUAL_HUMAN_ENABLED },
                  { value: 'local', label: '本地模型' }
                ]}
              />
            </RuntimeControls>
          </RuntimeBadge>
          {isAnyInterviewActive && (
            <InterviewStatusBadge $statusColor={getInterviewStatusColor()}>
              <div className="mode-label">
                {isVirtualInterviewActive ? '数字人面试' : 'LLM面试模式'}
              </div>
              <div className="status-text">
                问题: {currentInterviewIndex + 1} / {currentInterviewTotal}
              </div>
              <div className="status-text" style={{ color: getInterviewStatusColor(), marginTop: 2 }}>
                {getInterviewStatusText()}
              </div>
            </InterviewStatusBadge>
          )}
        </HeaderInner>
      </PageHeader>

      <MainContent className="main-content">
        <ChatCard>
          <QuickBar setInputValue={setInputValue} />

          <ChatPanel>
            <ChatMessagesArea ref={chatContainerRef}>
              <ChatMessages
                messages={messages}
                streamingMessage={streamingMessage}
                showActiveReplyBubble={showActiveReplyBubble}
              />
            </ChatMessagesArea>

            <InputBar
              inputValue={inputValue}
              setInputValue={setInputValue}
              isRecording={isRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
              memoryEnabled={memoryEnabled}
              handleMemoryToggleChange={handleMemoryToggleChange}
              currentRounds={currentRounds}
              enginePreference={enginePreference}
              localEngineSelected={localEngineSelected}
              localVisionEnabled={localVisionEnabled}
              attachedImages={attachedImages}
              removeAttachedImage={removeAttachedImage}
              imageInputRef={imageInputRef}
              handleSelectVisionImage={handleSelectVisionImage}
              sendMessage={sendMessage}
              isLoading={isLoading}
              ttsConfig={ttsConfig}
              setTtsConfig={setTtsConfig}
            />
          </ChatPanel>

          <InterviewResults
            interviewScoring={interviewScoring}
            completedInterviewCandidate={completedInterviewCandidate}
            showInterviewResults={showInterviewResults}
            setShowInterviewResults={setShowInterviewResults}
          />
        </ChatCard>

        <RightColumn>
          <InterviewActionBtnWrapper>
            {!isAnyInterviewActive ? (
              <InterviewActionBtn onClick={handleStartInterviewClick}>
                {entryCandidate ? `开始面试 · ${entryCandidate.name}` : '开始面试'}
              </InterviewActionBtn>
            ) : (
              <InterviewActionBtn $danger onClick={endInterviewMode}>
                结束面试
              </InterviewActionBtn>
            )}
          </InterviewActionBtnWrapper>

          <VirtualHumanPanel
            virtualHumanConnected={virtualHumanConnected}
            virtualHumanError={virtualHumanError}
            isVirtualPanelCollapsed={isVirtualPanelCollapsed}
            setIsVirtualPanelCollapsed={setIsVirtualPanelCollapsed}
          />
        </RightColumn>
      </MainContent>

      <CandidateSelector
        visible={showCandidateSelector}
        onSelect={handleCandidateSelect}
        onCancel={() => setShowCandidateSelector(false)}
      />
    </PageWrapper>
  );
};

export default ChatPage;
