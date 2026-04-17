import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  Input,
  Button,
  Avatar,
  Typography,
  Select,
  message,
  Spin,
  Tooltip,
  Popover,
  Slider
} from 'antd';
import {
  SendOutlined,
  AudioOutlined,
  StopOutlined,
  UserOutlined,
  RobotOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { createGlobalStyle } from 'styled-components';
import axios from 'axios';
import VirtualHumanSDK from '../components/VirtualHumanSDK';
import { virtualHumanConfig } from '../config/virtualHumanConfig';
import InterviewStorage from '../utils/interviewStorage';
import InterviewScoring from '../utils/interviewScoring';
import CandidateSelector from '../components/CandidateSelector';

// 从环境变量读取虚拟人功能是否启用
const VIRTUAL_HUMAN_ENABLED = process.env.REACT_APP_VIRTUAL_HUMAN_ENABLED === 'true';
const FALLBACK_INTERVIEW_TOTAL_QUESTIONS = 6;

// ⭐ 全局错误处理：拦截未捕获的 Promise rejection
// 这样可以防止 Chrome 的自动播放限制错误导致应用崩溃
if (typeof window !== 'undefined') {
  // 处理未捕获的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    const isAutoplayBlocked = event.reason && (
      event.reason.message?.includes('play() failed because the user didn\'t interact') ||
      event.reason.message?.includes('NotAllowedError')
    );

    if (isAutoplayBlocked) {
      console.debug('[AUTOPLAY_ERROR_PREVENTED] 自动播放限制错误已被拦截，等待用户交互');
      event.preventDefault();
      return; // 不再输出全量错误日志，避免干扰
    }

    console.error('[UNHANDLED_REJECTION] 捕获未处理的 Promise rejection:', {
      reason: event.reason,
      reasonType: typeof event.reason,
      reasonMessage: event.reason?.message,
      reasonName: event.reason?.name,
      reasonStack: event.reason?.stack,
      promise: event.promise
    });
  });

  // 处理同步错误
  window.addEventListener('error', (event) => {
    const isAutoplayBlocked = event.error && event.error.message?.includes('play() failed');
    if (isAutoplayBlocked) {
      console.debug('[AUTOPLAY_ERROR_SYNC_PREVENTED] 同步自动播放限制错误已被拦截，等待用户交互');
      event.preventDefault();
      return;
    }

    console.error('[GLOBAL_ERROR] 捕获全局同步错误:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      errorMessage: event.error?.message,
      errorStack: event.error?.stack
    });
  });
}

const GlobalStyle = createGlobalStyle`
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0% { transform: translateX(-50%) scale(1); }
    50% { transform: translateX(-50%) scale(1.05); }
    100% { transform: translateX(-50%) scale(1); }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes wave {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(20deg); }
    75% { transform: rotate(-20deg); }
  }

  @keyframes errorPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.15), inset 0 0 0 2px rgba(239, 68, 68, 0.1);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 12px 32px rgba(239, 68, 68, 0.25), inset 0 0 0 3px rgba(239, 68, 68, 0.15);
    }
  }

  @keyframes iconShake {
    0%, 100% { transform: rotate(0deg); }
    20% { transform: rotate(-10deg); }
    40% { transform: rotate(10deg); }
    60% { transform: rotate(-8deg); }
    80% { transform: rotate(8deg); }
  }
`;

const { TextArea } = Input;
const { Text } = Typography;

// 主色调定义 - 与首页统一
const colors = {
  primary: '#2F80ED',
  primaryHover: '#1C5FD4',
  primaryLight: '#E8F2FF',
  background: '#F7F9FC',
  cardBg: '#FFFFFF',
  title: '#1F2D3D',
  text: '#4A5568',
  muted: '#94A3B8',
  border: '#E2E8F0',
  divider: '#EEF2F7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
};

const COMPANY_PROFILE_CONTEXT = `嘉兴孪数光线科技有限公司成立于浙江嘉兴，是一家以BIM 技术为核心底座，深度聚焦空间数字模型构建与 AI 智慧场景应用创新的科技型企业。公司秉持 “产学研一体化” 的创业发展理念，依托数字孪生、人工智能、物联网集成技术，为工程建设领域提供从模型搭建、智能监测到自动管控的全链条解决方案。目前，公司自主研发的技术体系与产品平台已成功服务上海、苏州、嘉兴等长三角地区多个重点工程项目，覆盖智慧工地、工程数字孪生、AI 智能监测、人员智能管理、风险自动预警等核心场景，以技术创新推动工程管理向数字化、智能化、无人化升级。

一、公司文化
公司以技术立身、创新致远、务实担当、协同共赢为核心文化理念，坚持 “专业、严谨、开放、成长” 的价值导向。以 BIM 与空间数字模型为技术根基，鼓励技术探索与场景创新，倡导高效执行、诚信负责、主动协作的工作作风；注重员工成长与公司发展同频共振，打造有技术深度、有创新活力、有行业使命感的科技企业氛围。

二、工作时间与工作地点
工作时间：周一至周五 09:00–18:00，午休 12:00–13:00（1 小时），公司实行上下班打卡制度，依法保障员工休息权利，倡导高效工作、合理加班。
公司地址：浙江省嘉兴市经济技术开发区金穗路 79 号科技大楼 707 室。项目现场：根据重点工程与数字孪生项目需求，提供项目驻场与现场技术支持岗位。

三、团队氛围
公司团队以技术研发、工程数字化、AI 算法、项目实施为核心构成，整体年轻、专业、高效。团队氛围开放平等、沟通顺畅，重视技术交流与经验共享；工作中强调协作配合、结果导向，生活中互助包容、轻松务实。作为产学研一体的科技型企业，团队鼓励创新想法、尊重专业意见，支持员工在数字孪生、BIM、AI 工地管控等领域持续深耕与突破。

四、晋升机制
公司建立公开、公平、透明的职业发展与晋升体系：
- 双通道晋升：专业通道（初级工程师→中级工程师→高级工程师→技术专家→首席专家）和管理通道（骨干员工→项目主管→部门经理→总监→高管）
- 晋升依据：月度/年度绩效考核结果、项目贡献、技术创新、团队协作与责任担当、专业能力提升、培训完成情况与岗位匹配度
- 绩效优秀者优先晋升、调薪与激励；连续获得高绩效评级可破格晋升；管理岗位优先内部提拔

五、福利待遇
基础保障：签订正式劳动合同，缴纳五险一金，享受国家法定节假日、带薪年假、病假、工伤假等完整休假体系。
薪酬激励：基础工资 + 绩效工资 + 奖金体系，月度绩效考核优秀者可享受 120% 绩效工资，配套全勤奖励、项目奖励、创新奖励。
加班补贴：工作日加班至 20:00 后享 25 元餐补；22:00 后享 30 元交通报销；非工作日加班享 25 元餐补，20:00 后享交通报销。
其他福利：定期团队建设、节日福利、项目专项激励、办公设备规范管理；优秀员工享有带薪学习、外部培训、行业交流等额外福利。

六、培训机会
公司高度重视人才培养，依托产学研一体化优势，搭建覆盖全职业周期的培训体系：
- 入职培训：公司制度、企业文化、业务流程、BIM 与数字孪生基础、产品体系培训
- 专业技能培训：BIM 技术深化、空间数字模型搭建、AI 智能识别、数字孪生平台应用、智慧工地解决方案培训
- 在岗提升培训：项目实战带教、技术分享会、行业专家交流、外部专业课程
- 晋升与管理培训：管理能力、项目管控、团队协作、客户服务等高阶培训
- 专项激励：绩效优秀员工可获得带薪学习机会，支持技术考证、行业认证与外部深造

七、公司发展与价值
公司立足 BIM 与空间数字模型，深耕工程数字孪生与 AI 应用场景，以技术创新解决传统工程管理效率低、人工依赖高、风险响应慢等痛点，打造集智能监测、自动预警、自动推送、人员档案自动归档、设备智能联动、闭环管理于一体的智慧管控平台。未来，公司将持续以产学研融合为动力，不断拓展数字孪生与 AI 技术在工程建设、城市空间、智慧管理等领域的应用，致力于成为国内领先的空间数字模型与 AI 智慧场景服务商。`;
const COMPANY_CONTEXT_KEYWORDS = [
  '公司文化',
  '公司介绍',
  '公司简介',
  '公司背景',
  '公司业务',
  '公司是做什么',
  '企业文化',
  '文化',
  '福利',
  '福利待遇',
  '待遇',
  '团队氛围',
  '氛围',
  '培训',
  '培训机会',
  '晋升',
  '晋升机制',
  '工作时间',
  '工作地点',
  '办公地点',
  'bim',
  '数字孪生',
  '嘉兴孪数光线'
];

const shouldInjectCompanyContext = (text = '') => {
  const normalizedText = String(text || '').trim().toLowerCase();
  if (!normalizedText) {
    return false;
  }

  return COMPANY_CONTEXT_KEYWORDS.some(keyword => normalizedText.includes(keyword.toLowerCase()));
};

const buildCompanyContextPrompt = (userText) => [
  '以下是招聘公司的背景资料，请优先基于这些资料回答，并自然融入答案中，不要提及”根据资料”或”根据背景信息”。',
  `公司简介：${COMPANY_PROFILE_CONTEXT}`,
  `用户问题：${userText}`,
  '',
  '【输出格式】禁止使用星号(*)、井号(#)、反引号(`)、波浪线(~)等特殊符号，使用自然语言表达。',
  '',
  '【回答风格】',
  '1. 每次回答要有温度，像一位友善的HR在聊天，不要机械化。',
  '2. 可以适当加入轻松的表达，比如”说实话”、”其实”、”很高兴你关心这个”等。',
  '3. 避免每次用相同的开场白，变化表达方式。',
  '4. 可以融入对应聘者的关心，如”作为新人，您可能会关心...”、”很多应聘者也会问这个问题...”。',
  '',
  '【追问要求】',
  '回答结束后必须追问，但要自然变化。参考：',
  '- “对了，您还想了解什么？比如团队、项目或者成长空间？”',
  '- “这个回答有帮助吗？还有什么想深入了解的？”',
  '- “方便聊聊您这边的期待吗？”',
  '- “您问得很好，还有其他疑问吗？”',
  '追问要根据内容灵活变化，体现真诚的交流意愿。'
].join('\n');

const botAvatarStyle = {
  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.purple} 100%)`,
  flexShrink: 0,
  boxShadow: '0 4px 12px rgba(47, 128, 237, 0.2)',
  border: '2px solid rgba(255,255,255,0.9)'
};

const PageContainer = styled.div`
  height: 100%;
  background: ${colors.background};
  padding: 24px;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 20px;
`;

const ChatHeader = styled.div`
  background: ${colors.cardBg};
  border-radius: 16px;
  padding: 20px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid ${colors.border};
  
  .header-content {
    flex: 1;
  }
  
  h1 {
    color: ${colors.title};
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }
  
  .subtitle {
    color: ${colors.muted};
    margin-top: 4px;
    font-size: 14px;
  }
`;

const QuickQuestionsBar = styled.div`
  background: ${colors.cardBg};
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid ${colors.border};
  
  .quick-label {
    color: ${colors.muted};
    font-size: 13px;
    font-weight: 500;
    margin-right: 4px;
  }
  
  .quick-question {
    background: ${colors.primaryLight};
    color: ${colors.primary};
    border: none;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    
    &:hover {
      background: ${colors.primary};
      color: white;
      transform: translateY(-1px);
    }
  }
`;

const ChatContent = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 0;
  gap: 20px;
  padding: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    padding: 12px;
  }
`;

const ChatMessages = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: ${colors.cardBg};
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  border: 1px solid ${colors.border};
  overflow: hidden;
  min-height: 0;
  
  @media (max-width: 768px) {
    min-height: 400px;
  }
`;

const VirtualHumanContainer = styled.div`
  width: ${props => props.$collapsed ? '56px' : '300px'};
  min-width: ${props => props.$collapsed ? '56px' : '280px'};
  height: 100%;
  background: ${colors.cardBg};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  transition: width 0.25s ease, min-width 0.25s ease, box-shadow 0.25s ease;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 300px;
    min-width: 100%;
  }
`;

const VirtualHumanToggle = styled(Button)`
  position: absolute;
  top: ${props => props.$collapsed ? '10px' : '14px'};
  left: ${props => props.$collapsed ? '50%' : '14px'};
  right: ${props => props.$collapsed ? 'auto' : 'auto'};
  transform: ${props => props.$collapsed ? 'translateX(-50%)' : 'none'};
  z-index: 4;
  width: 32px;
  height: 32px;
  min-width: 32px;
  padding: 0;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);

  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
`;

const VirtualHumanCollapsedHint = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  letter-spacing: 1px;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-weight: 600;
`;

const VirtualHumanPlaceholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  background: ${props => props.$isError
    ? 'linear-gradient(180deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.98) 100%)'
    : 'linear-gradient(180deg, rgba(247, 249, 252, 0.92) 0%, rgba(255, 255, 255, 0.98) 100%)'};
  z-index: 2;

  .placeholder-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.$isError
      ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
      : colors.primaryLight};
    color: ${props => props.$isError ? '#EF4444' : colors.primary};
    font-size: 32px;
    margin-bottom: 18px;
    box-shadow: ${props => props.$isError
      ? '0 8px 24px rgba(239, 68, 68, 0.15), inset 0 0 0 2px rgba(239, 68, 68, 0.1)'
      : '0 8px 24px rgba(47, 128, 237, 0.12), inset 0 0 0 2px rgba(47, 128, 237, 0.08)'};
    animation: ${props => props.$isError ? 'errorPulse 2s ease-in-out infinite' : 'none'};
    transition: all 0.3s ease;
  }

  .placeholder-icon svg {
    animation: ${props => props.$isError ? 'iconShake 0.5s ease-in-out' : 'none'};
  }

  .placeholder-title {
    color: ${props => props.$isError ? '#B91C1C' : colors.title};
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
    letter-spacing: 0.5px;
  }

  .placeholder-desc {
    color: ${props => props.$isError ? '#7F1D1D' : colors.muted};
    font-size: 13px;
    line-height: 1.8;
    max-width: 240px;
    white-space: pre-wrap;
    background: ${props => props.$isError
      ? 'rgba(254, 202, 202, 0.5)'
      : 'transparent'};
    padding: ${props => props.$isError ? '12px 16px' : '0'};
    border-radius: ${props => props.$isError ? '10px' : '0'};
    border: ${props => props.$isError ? '1px solid rgba(239, 68, 68, 0.2)' : 'none'};
  }

  .retry-button {
    margin-top: 20px;
    padding: 10px 24px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: all 0.25s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: ${props => props.$isError
      ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
      : colors.primary};
    color: white;
    box-shadow: ${props => props.$isError
      ? '0 4px 16px rgba(239, 68, 68, 0.25)'
      : '0 4px 16px rgba(47, 128, 237, 0.25)'};

    &:hover {
      transform: translateY(-2px);
      box-shadow: ${props => props.$isError
        ? '0 6px 24px rgba(239, 68, 68, 0.35)'
        : '0 6px 24px rgba(47, 128, 237, 0.35)'};
    }

    &:active {
      transform: translateY(0);
    }

    svg {
      font-size: 16px;
    }
  }

  .error-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 6px 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 8px;
    font-size: 12px;
    color: #DC2626;
    font-weight: 500;
  }
`;

const VoiceControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const VoiceButton = styled(Button)`
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &.recording {
    background: #ff4d4f;
    border-color: #ff4d4f;
    animation: pulse 1s infinite;
  }
  
  &.playing {
    background: #52c41a;
    border-color: #52c41a;
  }
`;

const ChatContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: ${colors.background};
  min-height: 0;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 3px;
    
    &:hover {
      background: ${colors.muted};
    }
  }
`;

const MessageBubble = styled.div`
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  max-width: 90%;
  margin-left: ${props => props.type === 'user' ? 'auto' : '0'};
  margin-right: ${props => props.type === 'user' ? '0' : 'auto'};
`;

const UserMessage = styled.div`
  background: ${colors.primary};
  color: white;
  padding: 14px 18px;
  border-radius: 16px 16px 4px 16px;
  max-width: 100%;
  word-wrap: break-word;
  box-shadow: 0 4px 12px rgba(47, 128, 237, 0.2);
  position: relative;
  font-size: 15px;
  line-height: 1.6;
`;

const BotMessage = styled.div`
  background: ${colors.cardBg};
  color: ${colors.title};
  padding: 16px 20px;
  border-radius: 16px 16px 16px 4px;
  max-width: 100%;
  word-wrap: break-word;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  position: relative;
  border: 1px solid ${colors.border};
  font-size: 15px;
  line-height: 1.6;
`;

const ActiveBotMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 500;
`;

const BotMetaLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const BotMetaRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${colors.muted};
  font-weight: 500;
`;

const BotStatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 12px;
  background: ${props => props.$active ? colors.primaryLight : 'rgba(16, 185, 129, 0.1)'};
  color: ${props => props.$active ? colors.primary : colors.success};
  font-size: 11px;
`;

const ThinkingSpinner = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid ${colors.border};
  border-top-color: ${colors.primary};
  animation: spin 0.8s linear infinite;
`;

const InputArea = styled.div`
  background: ${colors.cardBg};
  padding: 20px 24px;
  border-top: 1px solid ${colors.divider};
  display: flex;
  gap: 12px;
  align-items: center;
`;

const StyledTextArea = styled(TextArea)`
  border-radius: 20px;
  border: 2px solid #f0f0f0;
  font-size: 16px;
  resize: none;
  transition: all 0.3s ease;
  
  &:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
`;

const AudioButton = styled(Button)`
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  }
`;

const SendButton = styled(Button)`
  border-radius: 10px;
  height: 48px;
  padding: 0 24px;
  background: ${colors.primary};
  border: none;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(47, 128, 237, 0.25);
  transition: all 0.2s ease;

  &:hover {
    background: ${colors.primaryHover};
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(47, 128, 237, 0.35);
  }

  &:disabled {
    background: ${colors.muted};
    box-shadow: none;
  }
`;

const MemoryToggle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: ${props => props.$enabled ? colors.primaryLight : 'rgba(148, 163, 184, 0.1)'};
  border: 1px solid ${props => props.$enabled ? 'rgba(47, 128, 237, 0.2)' : 'rgba(148, 163, 184, 0.2)'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  color: ${props => props.$enabled ? colors.primary : colors.muted};
  font-weight: 500;
  user-select: none;

  &:hover {
    background: ${props => props.$enabled ? 'rgba(47, 128, 237, 0.15)' : 'rgba(148, 163, 184, 0.15)'};
    border-color: ${props => props.$enabled ? colors.primary : 'rgba(148, 163, 184, 0.3)'};
  }

  .memory-icon {
    display: flex;
    align-items: center;
    font-size: 16px;
  }

  .memory-label {
    white-space: nowrap;
  }

  .memory-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 2px solid ${props => props.$enabled ? colors.primary : 'rgba(148, 163, 184, 0.4)'};
    background: ${props => props.$enabled ? colors.primary : 'transparent'};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    svg {
      color: white;
      font-size: 10px;
      opacity: ${props => props.$enabled ? 1 : 0};
      transition: opacity 0.2s ease;
    }
  }
`;

const ChatCard = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: transparent;
`;

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 48px 24px;
  text-align: center;
  
  .empty-icon {
    font-size: 64px;
    margin-bottom: 24px;
    animation: float 3s ease-in-out infinite;
  }
  
  .empty-title {
    font-size: 24px;
    font-weight: 600;
    color: ${colors.title};
    margin-bottom: 12px;
  }
  
  .empty-desc {
    font-size: 15px;
    color: ${colors.muted};
    max-width: 400px;
    line-height: 1.6;
  }
`;

const ChatGPTInputWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: #F9FAFB;
  border: 1px solid ${colors.border};
  border-radius: 14px;
  padding: 8px 16px;
  transition: all 0.2s ease;
  flex: 1;
  
  &:focus-within {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px ${colors.primaryLight};
  }
`;

const ChatGPTInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: ${colors.title};
  height: 40px;
  
  &::placeholder {
    color: ${colors.muted};
  }
`;

const VoiceButtonInside = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${colors.muted};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.primaryLight};
    color: ${colors.primary};
  }
  
  &.recording {
    background: #FEE2E2;
    color: #EF4444;
    animation: pulse 1s infinite;
  }

  &:disabled {
    cursor: not-allowed;
    color: #C0C7D4;
    background: #F3F4F6;
    opacity: 0.9;
  }

  &:disabled:hover {
    background: #F3F4F6;
    color: #C0C7D4;
  }
`;

const RuntimeBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(47, 128, 237, 0.15);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(232, 242, 255, 0.9) 100%);
  color: ${colors.title};
  font-size: 12px;
  font-weight: 500;
  flex-wrap: wrap;
  width: fit-content;
  box-shadow: 0 2px 8px rgba(47, 128, 237, 0.08);
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(47, 128, 237, 0.12);
    border-color: rgba(47, 128, 237, 0.25);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${colors.success};
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
    animation: pulse 2s ease-in-out infinite;
  }

  .label {
    color: ${colors.muted};
    font-weight: 400;
  }

  .engine-name {
    color: ${colors.primary};
    font-weight: 600;
  }
`;

const RuntimeControls = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid rgba(47, 128, 237, 0.2);
  margin-left: 4px;

  .runtime-label {
    color: ${colors.muted};
    font-size: 12px;
    font-weight: 500;
  }

  .runtime-select {
    min-width: 120px;

    .ant-select-selector {
      border-radius: 8px !important;
      border: 1px solid ${colors.border} !important;
      height: 28px !important;
      padding: 0 8px !important;
      font-size: 12px !important;
      transition: all 0.2s ease !important;

      &:hover {
        border-color: ${colors.primary} !important;
      }
    }

    .ant-select-selection-item {
      line-height: 26px !important;
    }
  }

  .local-model-select {
    min-width: 180px;
  }
`;

const AttachmentTray = styled.div`
  display: flex;
  gap: 10px;
  padding: 0 24px 14px;
  flex-wrap: wrap;
  background: ${colors.cardBg};
  border-top: 1px solid ${colors.divider};
`;

const AttachmentCard = styled.div`
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.border};
  background: ${colors.background};
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .remove-button {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(15, 23, 42, 0.78);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
`;

const LocalVisionActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid rgba(47, 128, 237, 0.2);
  margin-left: 4px;

  .vision-hint {
    font-size: 12px;
    color: ${colors.muted};
  }
`;

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [virtualHumanStreaming, setVirtualHumanStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [virtualHumanAudioEnabled, setVirtualHumanAudioEnabled] = useState(true);
  const [avatarExpression, setAvatarExpression] = useState('neutral');
  const [useVirtualHumanSDK, setUseVirtualHumanSDK] = useState(false); // 默认使用本地模型，切换到讯飞数字人时再启用
  const [virtualHumanConnected, setVirtualHumanConnected] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [virtualHumanError, setVirtualHumanError] = useState(false);
  const [isVirtualPanelCollapsed, setIsVirtualPanelCollapsed] = useState(false);
  const [interviewState, setInterviewState] = useState(null);
  const [isFinalizingReply, setIsFinalizingReply] = useState(false);
  const [showActiveReplyBubble, setShowActiveReplyBubble] = useState(false);
  
  // 面试对话记录相关状态
  const [isInterviewMode, setIsInterviewMode] = useState(false);
  const [currentInterviewSession, setCurrentInterviewSession] = useState(null);
  const [interviewScoring, setInterviewScoring] = useState(null);
  const [showInterviewResults, setShowInterviewResults] = useState(false);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [entryCandidate, setEntryCandidate] = useState(null);
  const [llmRuntimeInfo, setLlmRuntimeInfo] = useState({
    source: 'local',
    model: 'qwen3.5-9b-vlm-gguf',
    label: '本地模型 · Qwen3.5-9B（图文）'
  });
  const [enginePreference, setEnginePreference] = useState('local');
  const [availableEngines, setAvailableEngines] = useState([
    { key: 'xunfei', label: '讯飞数字人', enabled: VIRTUAL_HUMAN_ENABLED },
    { key: 'auto', label: '自动', enabled: true },
    { key: 'local', label: '本地模型', enabled: false }
  ]);
  const [availableLocalModels, setAvailableLocalModels] = useState([]);
  const [localModelPreference, setLocalModelPreference] = useState('qwen3.5-9b-vlm-gguf');
  const [attachedImages, setAttachedImages] = useState([]);
  const [completedInterviewCandidate, setCompletedInterviewCandidate] = useState(null);

  // Edge-TTS 配置状态
  const [ttsConfig, setTtsConfig] = useState({
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: '+0%',
    volume: '+0%'
  });

  // Edge-TTS 可用音色列表
  const EDGE_TTS_VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: '女', style: '温柔' },
    { id: 'zh-CN-YunxiNeural', name: '云希', gender: '男', style: '阳光' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: '女', style: '温暖' },
    { id: 'zh-CN-YunjianNeural', name: '云健', gender: '男', style: '播音' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰', gender: '女', style: '播音' },
    { id: 'zh-CN-XiaohanNeural', name: '晓涵', gender: '女', style: '甜美' },
    { id: 'zh-CN-XiaomengNeural', name: '晓梦', gender: '女', style: '活泼' },
    { id: 'zh-CN-XiaomoNeural', name: '晓墨', gender: '女', style: '成熟' },
    { id: 'zh-CN-YunyangNeural', name: '云扬', gender: '男', style: '客服' },
  ];

  // 音频播放器引用
  const audioRef = useRef(null);

  const [fallbackInterviewState, setFallbackInterviewState] = useState({
    isEnabled: false,
    currentQuestionIndex: -1,
    currentQuestionText: '',
    isWaitingForAnswer: false
  });
  const [memoryEnabled, setMemoryEnabled] = useState(true); // 记忆功能开关，默认开启

  const handleMemoryToggleChange = useCallback((enabled) => {
    setMemoryEnabled(enabled);
    if (!enabled) {
      setMessages([]);
      message.info('已清空对话历史');
    }
  }, []);

  const currentRounds = Math.floor(messages.filter(msg => msg.type === 'user').length);
  
  // 初始化面试存储和评分系统
  const interviewStorage = useRef(new InterviewStorage());
  const interviewScoringSystem = useRef(new InterviewScoring());
  const interviewAdvanceTimerRef = useRef(null);
  const pendingVirtualReplyRef = useRef('');
  const virtualReplyCommitTimerRef = useRef(null);
  const activeVirtualReplyCycleRef = useRef(0);
  const committedVirtualReplyCycleRef = useRef(0);
  const lastCommittedVirtualReplyRef = useRef('');
  const lastCommittedVirtualMessageIdRef = useRef(null);
  const hasReceivedFinalReplyRef = useRef(false);
  const replyFinishedRef = useRef(false);
  const imageInputRef = useRef(null);
  const hasInitializedRuntimeRef = useRef(false);
  const localModelPreferenceRef = useRef('qwen3.5-9b-vlm-gguf');
  const virtualHumanConnectedRef = useRef(false);

  useEffect(() => {
    localModelPreferenceRef.current = localModelPreference;
  }, [localModelPreference]);

  useEffect(() => {
    virtualHumanConnectedRef.current = virtualHumanConnected;
  }, [virtualHumanConnected]);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const candidateParam = searchParams.get('candidate');
      if (!candidateParam) {
        setEntryCandidate(null);
        return;
      }

      const parsedCandidate = JSON.parse(candidateParam);
      if (parsedCandidate && typeof parsedCandidate === 'object') {
        setEntryCandidate(parsedCandidate);
      } else {
        setEntryCandidate(null);
      }
    } catch (error) {
      console.warn('解析候选人预选信息失败:', error);
      setEntryCandidate(null);
    }
  }, []);

  const formatLocalModelLabel = useCallback((modelKey = '', fallbackLabel = '') => {
    const normalizedKey = String(modelKey || '').trim();
    const normalizedLabel = String(fallbackLabel || '').trim();

    if (normalizedKey === 'qwen3.5-9b-vlm-gguf') {
      return 'Qwen3.5-9B（图文）';
    }

    if (normalizedKey === 'qwen2-7b-gguf') {
      return 'Qwen2-7B（文本）';
    }

    return normalizedLabel || normalizedKey || '本地模型';
  }, []);

  const formatLlmRuntimeLabel = useCallback((source, model, rawLabel) => {
    if (source === 'xunfei') {
      return rawLabel || '讯飞数字人';
    }
    if (source === 'local') {
      return `本地模型 · ${formatLocalModelLabel(model, rawLabel)}`;
    }
    if (source === 'ollama') {
      return `Ollama · ${model || rawLabel || '未知模型'}`;
    }
    return '尚未发起模型请求';
  }, [formatLocalModelLabel]);

  const getLlmRuntimeDotColor = useCallback((runtime) => {
    const label = String(runtime?.label || '');

    if (!runtime || runtime.source === 'unknown') {
      return colors.muted;
    }

    if (label.includes('未就绪') || label.includes('失败') || label.includes('未启用')) {
      return colors.danger;
    }

    return colors.success;
  }, []);

  const mergeEngineOptions = useCallback((runtimeEngines = []) => {
    const runtimeEngineMap = new Map(
      runtimeEngines.map((engine) => [engine.key, engine])
    );

    return [
      { key: 'xunfei', label: '讯飞数字人', enabled: VIRTUAL_HUMAN_ENABLED },
      {
        key: 'auto',
        label: runtimeEngineMap.get('auto')?.label || '自动',
        enabled: runtimeEngineMap.get('auto')?.enabled ?? true
      },
      {
        key: 'local',
        label: runtimeEngineMap.get('local')?.label || '本地模型',
        enabled: runtimeEngineMap.get('local')?.enabled ?? false
      }
    ];
  }, []);

  const syncLocalModelOptions = useCallback((runtimeLocalModels = [], preferredLocalModel = '') => {
    const normalizedModels = (Array.isArray(runtimeLocalModels) ? runtimeLocalModels : []).map((model) => ({
      ...model,
      label: formatLocalModelLabel(model?.key, model?.label)
    }));
    setAvailableLocalModels(normalizedModels);

    const preferred = String(preferredLocalModel || '').trim();
    const hasPreferred = preferred && normalizedModels.some(model => model.key === preferred);
    const fallbackKey = normalizedModels[0]?.key || 'qwen3.5-9b-vlm-gguf';
    setLocalModelPreference(hasPreferred ? preferred : fallbackKey);
  }, [formatLocalModelLabel]);

  const loadChatRuntimeInfo = useCallback(async (preferredEngine = 'local', preferredLocalModel = '') => {
    try {
      const engine = preferredEngine || 'auto';
      const requestedLocalModel = preferredLocalModel || localModelPreferenceRef.current || 'qwen3.5-9b-vlm-gguf';
      if (engine === 'xunfei') {
        setEnginePreference('xunfei');
        let runtimeEngines = [];
        let runtimeLocalModels = [];
        let runtimeLocalModelKey = '';
        try {
          const runtimeResponse = await fetch(`/api/chat/runtime?engine=auto&localModel=${encodeURIComponent(requestedLocalModel)}`);
          if (runtimeResponse.ok) {
            const runtime = await runtimeResponse.json();
            runtimeEngines = runtime.availableEngines || [];
            runtimeLocalModels = runtime.availableLocalModels || [];
            runtimeLocalModelKey = runtime.currentLocalModelKey || requestedLocalModel;
          }
        } catch (runtimeError) {
          console.warn('获取备用引擎选项失败，使用默认选项:', runtimeError);
        }
        setAvailableEngines(mergeEngineOptions(runtimeEngines));
        syncLocalModelOptions(runtimeLocalModels, runtimeLocalModelKey);
        setLlmRuntimeInfo({
          source: 'xunfei',
          model: '',
          label: virtualHumanConnectedRef.current ? '讯飞数字人 已连接' : '讯飞数字人 连接中'
        });
        return;
      }

      const response = await fetch(`/api/chat/runtime?engine=${encodeURIComponent(engine)}&localModel=${encodeURIComponent(requestedLocalModel)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const runtime = await response.json();
      setEnginePreference(runtime.selectedEngine || runtime.defaultEngine || engine || 'ollama');
      const runtimeEngines = runtime.availableEngines || [];
      setAvailableEngines(mergeEngineOptions(runtimeEngines));
      syncLocalModelOptions(runtime.availableLocalModels || [], runtime.currentLocalModelKey || requestedLocalModel);
      setLlmRuntimeInfo({
        source: runtime.currentEngine || 'unknown',
        model: runtime.currentModel || '',
        label: formatLlmRuntimeLabel(runtime.currentEngine || 'unknown', runtime.currentModel || '', runtime.currentLabel || '')
      });
    } catch (error) {
      console.error('获取对话引擎状态失败:', error);
      setLlmRuntimeInfo({
        source: 'unknown',
        model: '',
        label: '引擎状态获取失败'
      });
    }
  }, [formatLlmRuntimeLabel, mergeEngineOptions, syncLocalModelOptions]);

  useEffect(() => {
    if (hasInitializedRuntimeRef.current) {
      return;
    }
    hasInitializedRuntimeRef.current = true;
    loadChatRuntimeInfo('local', localModelPreferenceRef.current);
  }, [loadChatRuntimeInfo]);

  const selectedLocalModel = availableLocalModels.find(model => model.key === localModelPreference) || null;
  const localVisionEnabled = !!selectedLocalModel?.supportsImages;
  const localEngineSelected = enginePreference === 'local' || enginePreference === 'auto';

  useEffect(() => {
    if (!localVisionEnabled && attachedImages.length > 0) {
      setAttachedImages([]);
    }
  }, [attachedImages.length, localVisionEnabled]);

  const disconnectVirtualHuman = useCallback(async () => {
    if (virtualHumanRef.current?.disconnectAvatar) {
      try {
        await virtualHumanRef.current.disconnectAvatar();
      } catch (error) {
        console.warn('断开数字人失败:', error);
      }
    }
    setVirtualHumanConnected(false);
    setNeedsUserInteraction(false);
    setVirtualHumanError(false);
  }, []);

  const switchEngineServices = useCallback(async (nextEngine, nextLocalModel = '') => {
    if (nextEngine !== 'ollama' && nextEngine !== 'local' && nextEngine !== 'auto') {
      return;
    }

    const response = await fetch('/api/chat/switch-engine-services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        engine: nextEngine,
        localModel: nextLocalModel || localModelPreferenceRef.current
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        errorMessage = payload?.message || payload?.error || errorMessage;
      } catch (error) {
      }
      throw new Error(errorMessage);
    }
  }, []);

  const handleEnginePreferenceChange = useCallback(async (value) => {
    setEnginePreference(value);

    if (value === 'xunfei') {
      setUseVirtualHumanSDK(VIRTUAL_HUMAN_ENABLED);
      setLlmRuntimeInfo({
        source: 'xunfei',
        model: '',
        label: '讯飞数字人 连接中'
      });
      setTimeout(() => {
        if (virtualHumanRef.current?.connectAvatar) {
          virtualHumanRef.current.connectAvatar();
        }
      }, 0);
      return;
    }

    await disconnectVirtualHuman();
    setUseVirtualHumanSDK(false);
    const hideLoading = message.loading(
      value === 'ollama' ? '正在切换到 Ollama 引擎...' : '正在切换到本地模型引擎...',
      0
    );
    try {
      await switchEngineServices(value, localModelPreferenceRef.current);
      await loadChatRuntimeInfo(value, localModelPreferenceRef.current);
      message.success(value === 'ollama' ? '已切换到 Ollama' : '已切换到本地模型');
    } catch (error) {
      console.error('切换对话引擎失败:', error);
      message.error(`切换失败：${error.message}`);
      await loadChatRuntimeInfo(enginePreference, localModelPreferenceRef.current);
    } finally {
      hideLoading();
    }
  }, [disconnectVirtualHuman, enginePreference, loadChatRuntimeInfo, switchEngineServices]);

  const handleLocalModelChange = useCallback(async (value) => {
    setLocalModelPreference(value);
    const nextModel = availableLocalModels.find(model => model.key === value);
    if (!nextModel?.supportsImages) {
      setAttachedImages([]);
    }
    if (enginePreference === 'local' || enginePreference === 'auto') {
      setLlmRuntimeInfo({
        source: 'local',
        model: value,
        label: `本地模型 · ${formatLocalModelLabel(value, nextModel?.label)}`
      });
      const hideLoading = message.loading(
        nextModel?.supportsImages ? '正在切换到图文本地模型...' : '正在切换到文本本地模型...',
        0
      );
      try {
        await switchEngineServices(enginePreference, value);
        await loadChatRuntimeInfo(enginePreference, value);
        message.success(`已切换到 ${formatLocalModelLabel(value, nextModel?.label)}`);
      } catch (error) {
        console.error('切换本地模型失败:', error);
        message.error(`切换本地模型失败：${error.message}`);
        await loadChatRuntimeInfo(enginePreference, localModelPreferenceRef.current);
      } finally {
        hideLoading();
      }
    }
  }, [availableLocalModels, enginePreference, formatLocalModelLabel, loadChatRuntimeInfo, switchEngineServices]);

  const optimizeVisionImage = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 提高图片质量以改善识别准确率
        const maxSide = 1536;  // 最大边长提高到1536像素
        const maxPixels = 1536 * 1536;  // 最大像素约236万像素
        let { width, height } = img;
        const sideScale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.max(1, Math.round(width * sideScale));
        height = Math.max(1, Math.round(height * sideScale));

        const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
        width = Math.max(1, Math.round(width * pixelScale));
        height = Math.max(1, Math.round(height * pixelScale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error(`图片处理失败: ${file.name}`));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // 提高JPEG质量到92%
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          dataUrl
        });
      };
      img.onerror = () => reject(new Error(`读取图片失败: ${file.name}`));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error(`读取图片失败: ${file.name}`));
    reader.readAsDataURL(file);
  }), []);

  const handleSelectVisionImage = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      message.warning('请选择图片文件');
      return;
    }

    const nextImages = await Promise.all(
      imageFiles.slice(0, 3).map(file => optimizeVisionImage(file))
    );

    setAttachedImages(nextImages);
    event.target.value = '';
  }, [optimizeVisionImage]);

  const removeAttachedImage = useCallback((imageId) => {
    setAttachedImages(prev => prev.filter(image => image.id !== imageId));
  }, []);

  // 开始面试模式
  const startInterviewMode = useCallback((candidateInfo) => {
    console.log('🎯 开始面试模式:', candidateInfo);
    
    const session = interviewStorage.current.startInterviewSession(
      candidateInfo.id || Date.now(),
      candidateInfo.name || '候选人',
      candidateInfo.position || '管培生'
    );
    
    setCurrentInterviewSession(session);
    setSelectedCandidate(candidateInfo);
    setCompletedInterviewCandidate(null);
    setIsInterviewMode(true);
    setShowInterviewResults(false);
    setShowCandidateSelector(false);
    setFallbackInterviewState({
      isEnabled: false,
      currentQuestionIndex: -1,
      currentQuestionText: '',
      isWaitingForAnswer: false
    });
    if (interviewAdvanceTimerRef.current) {
      clearTimeout(interviewAdvanceTimerRef.current);
      interviewAdvanceTimerRef.current = null;
    }
    
    // 清空之前的消息
    setMessages([]);
    
    console.log('🎯 面试模式状态已设置:', { isInterviewMode: true, session });
    message.success(`面试模式已启动 - 候选人: ${candidateInfo.name} (${candidateInfo.position})`);
  }, []);

  // 结束面试模式
  const endInterviewMode = useCallback(async () => {
    if (!currentInterviewSession || !selectedCandidate) return;
    if (interviewAdvanceTimerRef.current) {
      clearTimeout(interviewAdvanceTimerRef.current);
      interviewAdvanceTimerRef.current = null;
    }
    
    console.log('🏁 结束面试模式');
    
    // 计算面试评分
    const scoring = interviewScoringSystem.current.analyzeInterviewConversation({
      questions: currentInterviewSession.conversation.questions.map(q => q.question),
      candidateAnswers: currentInterviewSession.conversation.candidateAnswers.map(a => a.answer)
    });
    
    // 完成面试会话
    const completedSession = interviewStorage.current.completeInterviewSession(scoring);
    
    // 显示面试记录保存位置
    console.log('📝 面试记录已保存到浏览器localStorage:', {
      storageKey: 'interview_conversations',
      sessionId: completedSession.id,
      candidateName: selectedCandidate.name
    });
    
    // 将面试分和完整面试记录保存到候选人数据中
    try {
      console.log('🎯 准备保存面试分和面试记录:', {
        candidateId: selectedCandidate.id,
        candidateIdType: typeof selectedCandidate.id,
        scoring: scoring,
        interviewSession: completedSession
      });
      
      await saveInterviewScoreToCandidate(String(selectedCandidate.id), scoring, completedSession, selectedCandidate);
      console.log('✅ 面试分和面试记录已保存到候选人数据');
    } catch (error) {
      console.error('❌ 保存面试分失败:', error);
      console.error('❌ 错误详情:', {
        candidateId: selectedCandidate.id,
        candidateIdType: typeof selectedCandidate.id,
        error: error.response?.data || error.message
      });
      message.error(`保存面试分失败，但面试记录已保存：${error.response?.data?.error || error.message}`);
    }
    
    setInterviewScoring(scoring);
    setCompletedInterviewCandidate(selectedCandidate);
    setShowInterviewResults(true);
    setIsInterviewMode(false);
    setCurrentInterviewSession(null);
    setSelectedCandidate(null);
    setFallbackInterviewState({
      isEnabled: false,
      currentQuestionIndex: -1,
      currentQuestionText: '',
      isWaitingForAnswer: false
    });
    
    message.success(`面试完成！面试评分：${scoring.totalScore}分`);
  }, [currentInterviewSession, selectedCandidate]);

  // 取消面试模式
  const cancelInterviewMode = useCallback(() => {
    if (!currentInterviewSession) return;
    if (interviewAdvanceTimerRef.current) {
      clearTimeout(interviewAdvanceTimerRef.current);
      interviewAdvanceTimerRef.current = null;
    }
    
    console.log('❌ 取消面试模式');
    
    interviewStorage.current.cancelInterviewSession();
    setIsInterviewMode(false);
    setCurrentInterviewSession(null);
    setSelectedCandidate(null);
    setCompletedInterviewCandidate(null);
    setShowInterviewResults(false);
    setFallbackInterviewState({
      isEnabled: false,
      currentQuestionIndex: -1,
      currentQuestionText: '',
      isWaitingForAnswer: false
    });
    
    message.info('面试已取消');
  }, [currentInterviewSession]);

  // 保存面试分和面试记录到候选人数据
  const saveInterviewScoreToCandidate = async (candidateId, scoring, interviewSession, candidateSnapshot = null) => {
    try {
      const response = await axios.post('/api/candidates/interview-score', {
        candidateId: candidateId,
        interviewScore: scoring.totalScore,
        interviewDetails: {
          answerQuality: scoring.categoryScores.answerQuality?.score || 0,
          communication: scoring.categoryScores.communication?.score || 0,
          professionalism: scoring.categoryScores.professionalism?.score || 0,
          attitude: scoring.categoryScores.attitude?.score || 0,
          strengths: scoring.strengths,
          weaknesses: scoring.weaknesses,
          recommendations: scoring.recommendations,
          conversationSummary: scoring.conversationSummary
        },
        interviewDate: new Date().toISOString(),
        // 添加完整的面试记录
        interviewRecord: {
          sessionId: interviewSession.id,
          candidateId: interviewSession.candidateId,
          candidateName: interviewSession.candidateName,
          position: interviewSession.position,
          startTime: interviewSession.startTime,
          endTime: interviewSession.endTime,
          status: interviewSession.status,
          conversation: interviewSession.conversation,
          scoring: scoring
        },
        candidateSnapshot
      });
      
      return response.data;
    } catch (error) {
      console.error('保存面试分失败:', error);
      throw error;
    }
  };

  const fetchLocalLLMReply = useCallback(async (prompt, { mode = 'general', onChunk, history = [] } = {}) => {
    console.log('开始调用本地LLM:', { prompt, mode, engine: enginePreference, localModel: localModelPreference });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        mode,
        engine: enginePreference,
        localModel: localModelPreference,
        images: attachedImages.map(image => image.dataUrl),
        history
      })
    });

    console.log('收到响应:', { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      // 尝试解析错误响应为JSON
      try {
        const errorData = await response.json();
        console.log('错误响应数据:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      } catch (e) {
        // 如果解析失败，使用默认错误信息
        console.log('解析错误响应失败:', e);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const runtimeInfo = {
      source: response.headers.get('x-llm-source') || 'unknown',
      model: response.headers.get('x-llm-model') || '',
      label: ''
    };
    runtimeInfo.label = formatLlmRuntimeLabel(
      runtimeInfo.source,
      runtimeInfo.model,
      response.headers.get('x-llm-label') || ''
    );
    setLlmRuntimeInfo(runtimeInfo);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      accumulatedText += chunk;
      if (typeof onChunk === 'function') {
        onChunk(accumulatedText);
      }
    }

    return {
      text: accumulatedText.trim(),
      runtimeInfo
    };
  }, [attachedImages, enginePreference, formatLlmRuntimeLabel, localModelPreference]);

  const extractFallbackNextQuestion = useCallback((replyText) => {
    const markerMatch = replyText.match(/【下一题】\s*([\s\S]*)$/);
    if (markerMatch?.[1]) {
      return markerMatch[1].trim();
    }

    const plainMatch = replyText.match(/下一题[:：]\s*([\s\S]*)$/);
    if (plainMatch?.[1]) {
      return plainMatch[1].trim();
    }

    return '';
  }, []);

  const startFallbackInterview = useCallback(async (candidateInfo) => {
    setFallbackInterviewState({
      isEnabled: true,
      currentQuestionIndex: 0,
      currentQuestionText: '',
      isWaitingForAnswer: false
    });
    setIsLoading(true);
    setShowActiveReplyBubble(true);
    setStreamingMessage('本地面试官正在生成首个问题...');

    try {
      const prompt = [
        '你是一名专业中文 HR 面试官。',
        `候选人姓名：${candidateInfo.name || '候选人'}`,
        `应聘岗位：${candidateInfo.position || '管培生'}`,
        `MBTI：${candidateInfo.mbti || '未知'}`,
        '请直接给出第1个面试问题。',
        '要求：问题简洁、专业、与岗位相关，不要输出评价，不要输出标题。'
      ].join('\n');

      const { text: questionText } = await fetchLocalLLMReply(prompt, {
        mode: 'interview',
        onChunk: setStreamingMessage
      });

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: questionText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      interviewStorage.current.addQuestion(questionText, 'interview');
      setCurrentInterviewSession(interviewStorage.current.getCurrentSession());
      setFallbackInterviewState({
        isEnabled: true,
        currentQuestionIndex: 0,
        currentQuestionText: questionText,
        isWaitingForAnswer: true
      });
    } catch (error) {
      console.error('启动本地面试失败:', error);
      message.error(`本地面试启动失败：${getChatFallbackErrorMessage(error)}`);
      setFallbackInterviewState({
        isEnabled: false,
        currentQuestionIndex: -1,
        currentQuestionText: '',
        isWaitingForAnswer: false
      });
    } finally {
      setIsLoading(false);
      setShowActiveReplyBubble(false);
      setStreamingMessage('');
    }
  }, [fetchLocalLLMReply]);

  // 处理候选人选择
  const handleCandidateSelect = (candidate) => {
    console.log('🎯 候选人选择回调被调用:', candidate);
    setEntryCandidate(candidate);
    startInterviewMode(candidate);
    if (virtualHumanConnected && virtualHumanRef.current) {
      setTimeout(() => {
        virtualHumanRef.current?.startInterview?.();
      }, 500);
    } else {
      setTimeout(() => {
        startFallbackInterview(candidate);
      }, 200);
    }
  };
  
  // 监听needsUserInteraction状态变化
  useEffect(() => {
    if (needsUserInteraction) {
      console.log('ChatPage检测到needsUserInteraction状态变化为true');
      message.warning('检测到自动播放限制，请点击"点击播放虚拟人"按钮来启动虚拟人播放');
    }
  }, [needsUserInteraction]);

  // 定期更新面试状态
  useEffect(() => {
    if (virtualHumanConnected && virtualHumanRef.current) {
      const updateInterviewState = () => {
        const state = virtualHumanRef.current?.getInterviewState?.();
        if (state) {
          setInterviewState(state);
        }
      };
      
      updateInterviewState();
      const interval = setInterval(updateInterviewState, 1000);
      
      return () => clearInterval(interval);
    }
  }, [virtualHumanConnected]);

  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceRecognizedTextRef = useRef('');
  const voiceAutoSendHandledRef = useRef(false);
  const voiceAutoSendTimerRef = useRef(null);
  const virtualHumanRef = useRef(null);
  const virtualHumanToastShownRef = useRef(false);
  const speechRecognitionSupported = typeof window !== 'undefined' && (
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  );
  const speechRecognitionRequiresHttps = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.protocol !== 'https:';
  const voiceInputDisabled = !speechRecognitionSupported || speechRecognitionRequiresHttps;
  const voiceInputDisabledReason = !speechRecognitionSupported
    ? '当前浏览器不支持语音转文字，请升级到较新的 Chrome 浏览器'
    : speechRecognitionRequiresHttps
      ? '语音转文字需要 HTTPS 环境，请使用 HTTPS 访问'
      : '';

  const quickQuestions = [
    "公司文化是什么样的？",
    "有哪些福利待遇？",
    "工作时间和地点？",
    "晋升机制如何？",
    "团队氛围怎么样？",
    "培训机会有哪些？"
  ];

  // ⭐ 监听用户交互，恢复虚拟人声音
  useEffect(() => {
    let hasInteracted = false;

    const handleUserInteraction = async () => {
      if (hasInteracted) return; // 仅处理一次
      hasInteracted = true;

      // 延迟 100ms 确保 virtualHumanRef 已初始化
      setTimeout(() => {
        if (virtualHumanRef.current && virtualHumanRef.current.resumePlayback) {
          console.log('✅ 检测到用户交互，恢复虚拟人声音...');
          virtualHumanRef.current.resumePlayback();
        }
      }, 100);

      // 移除事件监听
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // 添加事件监听
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });

    return () => {
      // 清理事件监听
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, isLoading, virtualHumanStreaming, isFinalizingReply]);

  useEffect(() => {
    return () => {
      if (interviewAdvanceTimerRef.current) {
        clearTimeout(interviewAdvanceTimerRef.current);
      }
      if (virtualReplyCommitTimerRef.current) {
        clearTimeout(virtualReplyCommitTimerRef.current);
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 初始化语音功能
  useEffect(() => {
    // 初始化语音识别
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        setIsListening(false);
        console.error('语音识别错误:', event.error);
        let errorMessage = '语音识别失败，请重试';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = '未检测到语音，请重试';
            break;
          case 'audio-capture':
            errorMessage = '无法访问麦克风，请检查权限';
            break;
          case 'not-allowed':
            errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许';
            break;
          case 'network':
            errorMessage = '网络错误，请检查网络连接';
            break;
          case 'service-not-allowed':
            errorMessage = '语音识别服务不可用';
            break;
          default:
            errorMessage = `语音识别失败: ${event.error}`;
        }
        
        message.error(errorMessage);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (voiceAutoSendTimerRef.current) {
        clearTimeout(voiceAutoSendTimerRef.current);
        voiceAutoSendTimerRef.current = null;
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };


  const commitVirtualHumanReply = useCallback(() => {
    const finalReply = pendingVirtualReplyRef.current?.trim();

    if (!finalReply) {
      setIsLoading(false);
      setStreamingMessage('');
      setVirtualHumanStreaming(false);
      setIsFinalizingReply(false);
      setShowActiveReplyBubble(false);
      return;
    }

    const currentCycle = activeVirtualReplyCycleRef.current;
    if (currentCycle > 0 && committedVirtualReplyCycleRef.current === currentCycle) {
      const previousReply = lastCommittedVirtualReplyRef.current;
      const shouldUpgradeReply =
        finalReply.length > previousReply.length &&
        (finalReply.startsWith(previousReply) || previousReply.length === 0);

      if (shouldUpgradeReply && lastCommittedVirtualMessageIdRef.current) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === lastCommittedVirtualMessageIdRef.current
              ? { ...msg, content: finalReply, timestamp: new Date() }
              : msg
          )
        );
        lastCommittedVirtualReplyRef.current = finalReply;
      }

      pendingVirtualReplyRef.current = '';
      setIsLoading(false);
      setStreamingMessage('');
      setVirtualHumanStreaming(false);
      setIsFinalizingReply(false);
      setShowActiveReplyBubble(false);
      return;
    }

    const botMessage = {
      id: Date.now() + Math.random(),
      type: 'bot',
      content: finalReply,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMessage]);
    committedVirtualReplyCycleRef.current = currentCycle;
    lastCommittedVirtualReplyRef.current = finalReply;
    lastCommittedVirtualMessageIdRef.current = botMessage.id;
    pendingVirtualReplyRef.current = '';
    setIsLoading(false);
    setStreamingMessage('');
    setVirtualHumanStreaming(false);
    setIsFinalizingReply(false);
    setShowActiveReplyBubble(false);
  }, []);

  const scheduleVirtualHumanReplyCommit = useCallback((delay = 1800) => {
    if (virtualReplyCommitTimerRef.current) {
      clearTimeout(virtualReplyCommitTimerRef.current);
    }

    virtualReplyCommitTimerRef.current = setTimeout(() => {
      virtualReplyCommitTimerRef.current = null;
      commitVirtualHumanReply();
    }, delay);
  }, [commitVirtualHumanReply]);

  const startStableThinkingPhase = useCallback(() => {
    hasReceivedFinalReplyRef.current = false;
    replyFinishedRef.current = false;
    setIsFinalizingReply(false);
    setShowActiveReplyBubble(true);
    setIsLoading(true);
    setVirtualHumanStreaming(false);
    setStreamingMessage('AI正在思考...');
  }, [scheduleVirtualHumanReplyCommit]);

  const sendMessage = async (overrideText) => {
    // 检查overrideText是否是事件对象，如果是则忽略
    const isEventObject = overrideText && typeof overrideText === 'object' && overrideText.nativeEvent;
    const actualOverrideText = isEventObject ? undefined : overrideText;
    
    const textValue = String(inputValue || '');
    const overrideValue = String(actualOverrideText || '');
    if (!textValue.trim() && !overrideValue.trim() && attachedImages.length === 0) return;

    const rawUserInput = (overrideValue || textValue).trim() || '请结合我上传的图片进行分析和回答。';
    let modelInput = rawUserInput;

    // 勾选记忆时，始终注入公司简介作为上下文
    if (memoryEnabled) {
      modelInput = [
        '以下是招聘公司的背景资料，请优先基于这些资料回答，并自然融入答案中，不要提及"根据资料"或"根据背景信息"。如果用户问题与公司无关，则按正常方式回答。',
        `公司简介：${COMPANY_PROFILE_CONTEXT}`,
        `用户问题：${rawUserInput}`,
        '请直接回答用户问题，语气自然、信息准确。'
      ].join('\n');
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: rawUserInput,
      images: attachedImages,
      timestamp: new Date()
    };
    // 根据记忆功能开关决定是否包含历史消息
    // 默认记忆6轮对话，每轮包含一个用户消息和一个AI回复
    const maxMemoryRounds = 6;
    const maxMessages = memoryEnabled ? maxMemoryRounds * 2 : 0;
    const conversationHistory = memoryEnabled ? [
      ...messages
        .filter(msg => msg && (msg.type === 'user' || msg.type === 'bot') && String(msg.content || '').trim())
        .slice(-maxMessages)
        .map(msg => ({
          role: msg.type === 'bot' ? 'assistant' : 'user',
          content: String(msg.content || '').trim()
        })),
      {
        role: 'user',
        content: modelInput
      }
    ] : [];

    setMessages(prev => [...prev, userMessage]);
    
    // 在面试模式下记录候选人回答
    if (isInterviewMode && currentInterviewSession) {
      interviewStorage.current.addCandidateAnswer(rawUserInput);
      
      // 更新当前会话状态
      const updatedSession = interviewStorage.current.getCurrentSession();
      setCurrentInterviewSession(updatedSession);
    }
    
    const isFallbackInterviewAnswerTurn = !!(fallbackInterviewState.isEnabled && fallbackInterviewState.isWaitingForAnswer);
    const isInterviewAnswerTurn = !!(
      (interviewState?.isAutoQuestionEnabled && interviewState?.isWaitingForAnswer) ||
      isFallbackInterviewAnswerTurn
    );
    if (interviewState?.isAutoQuestionEnabled && interviewState?.isWaitingForAnswer && virtualHumanRef.current) {
      const currentQuestionIndex = interviewState?.currentQuestionIndex || 0;
      const interviewQuestions = virtualHumanRef.current.getInterviewQuestions?.() || [];
      const currentQuestion = interviewQuestions[currentQuestionIndex];

      if (currentQuestion) {
        modelInput = [
          '你正在作为面试官评估候选人的回答。',
          `当前面试问题：${currentQuestion}`,
          `候选人回答：${rawUserInput}`,
          '请严格基于这道题和候选人的回答，给出自然、专业、连贯的评价与追问。'
        ].join('\n');
      }
    } else if (isFallbackInterviewAnswerTurn) {
      const isLastQuestion = fallbackInterviewState.currentQuestionIndex >= FALLBACK_INTERVIEW_TOTAL_QUESTIONS - 1;
      modelInput = [
        '你正在作为专业 HR 面试官进行结构化面试。',
        `候选人姓名：${selectedCandidate?.name || '候选人'}`,
        `应聘岗位：${selectedCandidate?.position || '管培生'}`,
        `MBTI：${selectedCandidate?.mbti || '未知'}`,
        `当前是第 ${fallbackInterviewState.currentQuestionIndex + 1} / ${FALLBACK_INTERVIEW_TOTAL_QUESTIONS} 题`,
        `当前面试问题：${fallbackInterviewState.currentQuestionText}`,
        `候选人回答：${rawUserInput}`,
        isLastQuestion
          ? '请先给出专业评价，再输出简短面试总结，不要再提出新问题。回复格式：\n【评价】\n...\n【面试总结】\n...'
          : '请先给出专业评价，再提出下一个面试问题。回复格式：\n【评价】\n...\n【下一题】\n...'
      ].join('\n');
    } else if (shouldInjectCompanyContext(rawUserInput)) {
      modelInput = buildCompanyContextPrompt(rawUserInput);
    }

    setInputValue('');
    setAttachedImages([]);
    setStreamingMessage('');
    pendingVirtualReplyRef.current = '';
    activeVirtualReplyCycleRef.current += 1;
    committedVirtualReplyCycleRef.current = 0;
    lastCommittedVirtualReplyRef.current = '';
    lastCommittedVirtualMessageIdRef.current = null;
    startStableThinkingPhase();

    // 检查是否在面试模式中，如果是，则标记面试者已回答
    if (interviewState?.isAutoQuestionEnabled && interviewState?.isWaitingForAnswer) {
      console.log('👤 检测到面试者回答，准备进入下一个问题');
      // 延迟调用，让消息先发送完成
      setTimeout(() => {
        virtualHumanRef.current?.handleCandidateAnswerComplete?.();
      }, 1000);
    }

    try {
      // 统一使用虚拟人模型处理对话
      console.log('对话判断条件:', {
        useVirtualHumanSDK,
        virtualHumanConnected,
        hasVirtualHumanRef: !!virtualHumanRef.current
      });
      
      // 先检查虚拟人连接状态
      let isReallyConnected = virtualHumanConnected;
      if (virtualHumanRef.current && virtualHumanRef.current.checkConnectionStatus) {
        isReallyConnected = virtualHumanRef.current.checkConnectionStatus();
      }
      
      const connectionSnapshot = {
        useVirtualHumanSDK,
        virtualHumanConnected,
        isReallyConnected,
        hasVirtualHumanRef: !!virtualHumanRef.current
      };

      console.log('最终连接状态:', connectionSnapshot);
      
      if (useVirtualHumanSDK && (virtualHumanConnected || isReallyConnected) && virtualHumanRef.current) {
        console.log('使用虚拟人模型处理对话:', modelInput);
        
        // 通过虚拟人SDK发送文本，虚拟人会使用配置的HR助手模型处理
        await virtualHumanRef.current.sendText(modelInput);
        
        // 虚拟人会自动处理并回复，这里我们等待虚拟人的回复
        // 注意：虚拟人的回复会通过SDK事件回调处理，不需要在这里处理

        // 设置一个超时，防止虚拟人没有回复
        setTimeout(() => {
          if (isLoading) {
            setStreamingMessage('');
            setIsLoading(false);
            message.warning('虚拟人暂时无法回复，请稍后再试');
          }
        }, 15000); // 从30秒减少到15秒超时
        
      } else {
        // 如果虚拟人未连接，回退到原来的API
        const unavailableReason = getVirtualHumanUnavailableReason(connectionSnapshot);
        console.warn('虚拟人主链路未命中，准备回退到 /api/chat:', {
          ...connectionSnapshot,
          unavailableReason
        });
        
        try {
          const chatMode = isFallbackInterviewAnswerTurn || fallbackInterviewState.isEnabled ? 'interview' : 'general';
          const { text: accumulatedText } = await fetchLocalLLMReply(modelInput, {
            mode: chatMode,
            onChunk: setStreamingMessage,
            history: conversationHistory
          });

          if (accumulatedText) {
            const botMessage = {
              id: Date.now() + 1,
              type: 'bot',
              content: accumulatedText,
              timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
            setStreamingMessage('');
            setShowActiveReplyBubble(false);
            setIsLoading(false);
            
            // 根据回复内容设置虚拟人表情
            setAvatarExpressionByContent(accumulatedText);
            playAudio(accumulatedText);

            if (fallbackInterviewState.isEnabled) {
              const nextQuestion = extractFallbackNextQuestion(accumulatedText);

              if (nextQuestion) {
                interviewStorage.current.addQuestion(nextQuestion, 'interview');
                setCurrentInterviewSession(interviewStorage.current.getCurrentSession());
                setFallbackInterviewState(prev => ({
                  ...prev,
                  currentQuestionIndex: Math.min(prev.currentQuestionIndex + 1, FALLBACK_INTERVIEW_TOTAL_QUESTIONS - 1),
                  currentQuestionText: nextQuestion,
                  isWaitingForAnswer: true
                }));
              } else {
                setFallbackInterviewState(prev => ({
                  ...prev,
                  isWaitingForAnswer: false
                }));
              }
            }
          }
        } catch (apiError) {
          console.error('项目内置模型API调用失败:', apiError);
          const detailedReason = getChatFallbackErrorMessage(apiError);

          // 重置状态，避免显示"AI正在思考..."
          setStreamingMessage('');
          setShowActiveReplyBubble(false);
          setIsLoading(false);

          // 显示一个简单的回复
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            content: `抱歉，AI服务暂时不可用。\n原因：${detailedReason}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botMessage]);
        }
      }
    } catch (error) {
      message.error(`发送消息失败：${error?.message || '未知错误'}`);
      console.error('发送消息失败:', error);
      setIsLoading(false);
      setStreamingMessage('');
      setShowActiveReplyBubble(false);
    }
  };

  const finalizeVoiceInput = useCallback((recognizedText) => {
    const text = String(recognizedText || '').trim();
    if (!text || voiceAutoSendHandledRef.current) {
      return;
    }

    voiceAutoSendHandledRef.current = true;
    setInputValue(text);
    sendMessage(text);
  }, [sendMessage]);

  const startRecording = async () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        message.error('您的浏览器不支持语音识别，请使用 Chrome 浏览器');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      voiceRecognizedTextRef.current = '';
      voiceAutoSendHandledRef.current = false;
      if (voiceAutoSendTimerRef.current) {
        clearTimeout(voiceAutoSendTimerRef.current);
        voiceAutoSendTimerRef.current = null;
      }

      recognition.onresult = (event) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
        voiceRecognizedTextRef.current = transcript;
        if (transcript) {
          setInputValue(transcript);
          if (voiceAutoSendTimerRef.current) {
            clearTimeout(voiceAutoSendTimerRef.current);
          }
          voiceAutoSendTimerRef.current = setTimeout(() => {
            voiceAutoSendTimerRef.current = null;
            finalizeVoiceInput(transcript);
          }, 180);
        }
      };

      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        setIsRecording(false);
        recognitionRef.current = null;
        if (voiceAutoSendTimerRef.current) {
          clearTimeout(voiceAutoSendTimerRef.current);
          voiceAutoSendTimerRef.current = null;
        }
        if (event.error === 'not-allowed') {
          message.error('请允许麦克风权限后重试');
        } else if (event.error === 'no-speech') {
          message.info('未检测到语音，请重试');
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
        if (voiceAutoSendTimerRef.current) {
          clearTimeout(voiceAutoSendTimerRef.current);
          voiceAutoSendTimerRef.current = null;
        }
        const text = voiceRecognizedTextRef.current;
        if (text) {
          finalizeVoiceInput(text);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (error) {
      message.error('无法启动语音识别');
      console.error('语音识别启动失败:', error);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    }
    if (voiceAutoSendTimerRef.current) {
      clearTimeout(voiceAutoSendTimerRef.current);
      voiceAutoSendTimerRef.current = null;
    }
  };

  // Edge-TTS 语音播放
  const playAudio = async (text) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText || isPlaying || !virtualHumanAudioEnabled) return;

    try {
      setIsPlaying(true);

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: normalizedText,
          voice: ttsConfig.voice,
          rate: ttsConfig.rate,
          volume: ttsConfig.volume
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `TTS API 错误: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      await audio.play();

    } catch (error) {
      console.error('Edge-TTS 播放失败:', error);
      setIsPlaying(false);
      message.warning(`语音合成失败: ${error.message}`);
    }
  };

  // 语音识别功能
  const startVoiceRecognition = async () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('启动普通语音识别...');
        
        // 检查是否在HTTPS环境
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          message.error('语音识别需要HTTPS环境，请使用HTTPS访问');
          return;
        }
        
        // 检查权限状态并激活权限
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
          console.log('麦克风权限状态:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            message.error('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
            return;
          }
          
          // 即使权限状态是granted，也需要先获取媒体流来激活权限
          if (permissionStatus.state === 'granted') {
            try {
              // 先检查可用的音频设备
              const devices = await navigator.mediaDevices.enumerateDevices();
              const audioInputs = devices.filter(device => device.kind === 'audioinput');
              console.log('可用的音频输入设备:', audioInputs);
              
              if (audioInputs.length === 0) {
                message.error('未检测到麦克风设备，请检查麦克风是否已连接');
                return;
              }
              
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              console.log('成功获取麦克风流，权限已激活');
              // 立即停止流，我们只需要激活权限
              stream.getTracks().forEach(track => track.stop());
            } catch (streamError) {
              console.error('获取麦克风流失败:', streamError);
              
              if (streamError.name === 'NotFoundError') {
                message.error('未找到麦克风设备，请检查麦克风是否已连接并正常工作');
              } else if (streamError.name === 'NotAllowedError') {
                message.error('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
              } else {
                message.error('无法访问麦克风，请检查设备连接和权限设置');
              }
              return;
            }
          }
        } catch (permError) {
          console.log('无法检查权限状态，直接尝试启动语音识别');
        }
        
        recognitionRef.current.start();
      } catch (error) {
        console.error('语音识别启动失败:', error);
        message.error('语音识别启动失败，请检查麦克风权限');
      }
    } else if (!recognitionRef.current) {
      message.error('浏览器不支持语音识别功能');
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // 切换虚拟人语音输出
  const toggleVirtualHumanAudio = () => {
    const nextEnabled = !virtualHumanAudioEnabled;
    setVirtualHumanAudioEnabled(nextEnabled);
    if (!nextEnabled && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
    if (virtualHumanRef.current && virtualHumanRef.current.setAudioEnabled) {
      virtualHumanRef.current.setAudioEnabled(nextEnabled);
    }
  };


  // 处理虚拟人SDK状态变化
  const handleVirtualHumanStatusChange = useCallback((status) => {
    if (typeof status === 'object' && status.isConnected !== undefined) {
      const wasConnected = virtualHumanConnected;
      setVirtualHumanConnected(status.isConnected);
      
      if (status.error) {
        setVirtualHumanError(true);
      } else {
        setVirtualHumanError(false);
      }

      if (enginePreference === 'xunfei') {
        const nextLabel = status.isConnected
          ? '讯飞数字人 已连接'
          : status.currentStatus === 'error'
            ? '讯飞数字人 连接失败'
            : '讯飞数字人 连接中';
        setLlmRuntimeInfo({ source: 'xunfei', model: '', label: nextLabel });
      }
      
      if (status.needsUserInteraction !== undefined) {
        setNeedsUserInteraction(status.needsUserInteraction);
        if (status.needsUserInteraction && !wasConnected) {
          message.warning('需要点击"恢复播放"按钮来启动虚拟人播放');
        }
      }
      
      // 断开时重置标记
      if (!status.isConnected && wasConnected) {
        virtualHumanToastShownRef.current = false;
      }
      
      // 只在首次连接成功且未弹过Toast时显示提示（防止useEffect重复触发）
      if (status.isConnected && !wasConnected && !virtualHumanToastShownRef.current) {
        virtualHumanToastShownRef.current = true;
        message.success('虚拟人连接成功！');
        setVirtualHumanError(false);
      } else if (status.currentStatus === 'error' && wasConnected) {
        message.error('虚拟人连接失败，请点击"重新连接"按钮重试');
        setVirtualHumanError(true);
      }
    }
  }, [enginePreference, virtualHumanConnected]);

  // 连接虚拟人
  const connectVirtualHuman = () => {
    if (virtualHumanRef.current && virtualHumanRef.current.connectAvatar) {
      virtualHumanRef.current.connectAvatar();
      message.info('正在连接虚拟人...');
    }
  };

  // 通过虚拟人SDK发送文本
  const sendTextToVirtualHuman = async (text) => {
    if (virtualHumanRef.current && virtualHumanConnected) {
      try {
        await virtualHumanRef.current.sendText(text);
        console.log('虚拟人文本发送成功:', text);
      } catch (error) {
        console.error('虚拟人文本发送失败:', error);
        message.error('虚拟人文本发送失败');
      }
    }
  };

  // 防重复调用标志
  const isProcessingRef = useRef(false);

  const clearInterviewAdvanceTimer = useCallback(() => {
    if (interviewAdvanceTimerRef.current) {
      clearTimeout(interviewAdvanceTimerRef.current);
      interviewAdvanceTimerRef.current = null;
    }
  }, []);

  const scheduleInterviewAdvanceAfterEvaluation = useCallback(() => {
    clearInterviewAdvanceTimer();

    interviewAdvanceTimerRef.current = setTimeout(() => {
      interviewAdvanceTimerRef.current = null;

      if (!virtualHumanRef.current) return;
      const state = virtualHumanRef.current.getInterviewState?.();
      if (!state) return;

      if (
        state.isAutoQuestionEnabled &&
        !state.isInterviewComplete &&
        state.isAIEvaluating &&
        !state.isWaitingForAnswer &&
        !state.isAIResponding
      ) {
        console.log('🎯 AI评价展示满5分钟，自动进入下一题');
        virtualHumanRef.current.setInterviewState?.(prev => ({ ...prev, isAIEvaluating: false }));
        virtualHumanRef.current.handleNextQuestion?.();
      }
    }, 300000);
  }, [clearInterviewAdvanceTimer]);
  
  // 状态同步后处理面试逻辑
  const handleInterviewLogicAfterStateSync = () => {
    // 防止重复处理
    if (isProcessingRef.current) {
      console.log('🎯 正在处理中，跳过重复调用');
      return;
    }
    
    if (virtualHumanRef.current) {
      const interviewState = virtualHumanRef.current.getInterviewState();
      console.log('🎯 状态同步后检查面试状态:', {
        isAIEvaluating: interviewState.isAIEvaluating,
        isAutoQuestionEnabled: interviewState.isAutoQuestionEnabled,
        isInterviewComplete: interviewState.isInterviewComplete,
        currentQuestionIndex: interviewState.currentQuestionIndex,
        isWaitingForAnswer: interviewState.isWaitingForAnswer,
        isAIResponding: interviewState.isAIResponding
      });
      
      console.log('🎯 仅同步面试状态，不在这里自动跳题');
    }
  };

  const isPresetInterviewQuestion = (replyText = '') =>
    typeof replyText === 'string' &&
    replyText.startsWith('作为面试官，我想问您一个问题：');

  // 处理虚拟人回复
  const handleVirtualHumanReply = (replyText) => {
    // 确保replyText是字符串
    const reply = typeof replyText === 'string' ? replyText : String(replyText);
    // 减少控制台输出，只在状态变化时输出
    if (!isInterviewMode || !currentInterviewSession) {
      console.log('面试模式状态:', { isInterviewMode, hasCurrentSession: !!currentInterviewSession });
    }
    
    // 检查虚拟人是否在面试模式，但ChatPage的面试模式状态是false
    // 添加防重复同步标志
    if (virtualHumanRef.current && !isInterviewMode && !currentInterviewSession) {
      const interviewState = virtualHumanRef.current.getInterviewState();
      if (interviewState.isAutoQuestionEnabled) {
        console.log('🔄 检测到虚拟人在面试模式，同步ChatPage状态');
        // 创建一个临时的面试会话
        const tempSession = interviewStorage.current.startInterviewSession(
          Date.now(),
          '临时候选人',
          '管培生'
        );
        setCurrentInterviewSession(tempSession);
        setIsInterviewMode(true);
        setSelectedCandidate({ id: Date.now(), name: '临时候选人', position: '管培生' });
        
        // 这里只同步 UI 状态，不自动推进题目
      }
    }
    
    if (isPresetInterviewQuestion(reply)) {
      const botMessage = {
        id: Date.now() + Math.random(),
        type: 'bot',
        content: reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      setShowActiveReplyBubble(false);
      setIsLoading(false);
      setStreamingMessage('');
      setVirtualHumanStreaming(false);
      setIsFinalizingReply(false);
      pendingVirtualReplyRef.current = '';

      if (isInterviewMode && currentInterviewSession) {
        interviewStorage.current.addQuestion(reply, 'interview');
        const updatedSession = interviewStorage.current.getCurrentSession();
        setCurrentInterviewSession(updatedSession);
      }
      return;
    }

    pendingVirtualReplyRef.current = reply;
    hasReceivedFinalReplyRef.current = true;
    setStreamingMessage(reply);
    setVirtualHumanStreaming(true);
    setIsLoading(false);
    
    // 根据回复内容设置虚拟人表情
    setAvatarExpressionByContent(reply);
    
    // 在面试模式下记录AI回复
    if (isInterviewMode && currentInterviewSession) {
      // 判断是否是面试问题还是评价回复
      const isQuestion = reply.includes('请') || reply.includes('？') || reply.includes('?');
      const replyType = isQuestion ? 'question' : 'evaluation';
      
      if (isQuestion) {
        // 记录面试问题
        interviewStorage.current.addQuestion(reply, 'interview');
      } else {
        // 记录AI评价回复
        interviewStorage.current.addAIReply(reply, 'evaluation');
        
        // 如果是评价回复，设置AI评价状态
        if (virtualHumanRef.current) {
          console.log('设置AI评价状态，回复内容:', reply);
          virtualHumanRef.current.setInterviewState(prev => ({ 
            ...prev, 
            isAIEvaluating: true 
          }));
          console.log('AI评价状态已设置');
        }
      }
      
      // 更新当前会话状态
      const updatedSession = interviewStorage.current.getCurrentSession();
      setCurrentInterviewSession(updatedSession);
    }
  };

  // 结束虚拟人流式回复，转换为正式消息
  const finishVirtualHumanStreaming = () => {
    console.log('🔄 finishVirtualHumanStreaming: AI评价消息流式显示完毕');
    replyFinishedRef.current = true;
    setIsFinalizingReply(true);

    if (hasReceivedFinalReplyRef.current) {
      scheduleVirtualHumanReplyCommit(250);
    }

    if (isInterviewMode && virtualHumanRef.current) {
      const currentState = virtualHumanRef.current.getInterviewState?.();
      if (
        currentState?.isAutoQuestionEnabled &&
        !currentState?.isInterviewComplete &&
        currentState?.isAIEvaluating &&
        !currentState?.isWaitingForAnswer
      ) {
        console.log('🎯 AI评价消息已显示，开始15秒后自动下一题倒计时');
        scheduleInterviewAdvanceAfterEvaluation();
      }
    }
  };

  // 处理评价完成后的下一个问题逻辑
  const handleNextQuestionAfterEvaluation = () => {
    // 检查虚拟人面试状态
    if (virtualHumanRef.current) {
      const interviewState = virtualHumanRef.current.getInterviewState();
      
      if (
        interviewState.isAutoQuestionEnabled &&
        !interviewState.isInterviewComplete &&
        interviewState.isAIEvaluating &&
        !interviewState.isWaitingForAnswer &&
        !interviewState.isAIResponding
      ) {
        scheduleInterviewAdvanceAfterEvaluation();
      }
    } else {
      console.log('🎯 不在面试模式或没有虚拟人引用:', { isInterviewMode, hasVirtualHumanRef: !!virtualHumanRef.current });
    }
  };

  // 根据消息内容设置虚拟人表情
  const setAvatarExpressionByContent = (content) => {
    const lowerContent = content.toLowerCase();
    
    // 职场专业表情识别
    if (lowerContent.includes('欢迎') || lowerContent.includes('您好') || lowerContent.includes('很高兴') || 
        lowerContent.includes('感谢') || lowerContent.includes('谢谢') || lowerContent.includes('合作')) {
      setAvatarExpression('happy');
    } else if (lowerContent.includes('思考') || lowerContent.includes('分析') || lowerContent.includes('考虑') ||
               lowerContent.includes('让我想想') || lowerContent.includes('需要') || lowerContent.includes('评估') ||
               lowerContent.includes('审核') || lowerContent.includes('审查') || lowerContent.includes('研究')) {
      setAvatarExpression('thinking');
    } else if (lowerContent.includes('抱歉') || lowerContent.includes('对不起') || lowerContent.includes('错误') ||
               lowerContent.includes('无法') || lowerContent.includes('不能') || lowerContent.includes('问题') ||
               lowerContent.includes('遗憾') || lowerContent.includes('抱歉')) {
      setAvatarExpression('confused');
    } else if (lowerContent.includes('惊喜') || lowerContent.includes('太好了') || lowerContent.includes('恭喜') ||
               lowerContent.includes('优秀') || lowerContent.includes('完美') || lowerContent.includes('成功') ||
               lowerContent.includes('通过') || lowerContent.includes('录用') || lowerContent.includes('录取')) {
      setAvatarExpression('excited');
    } else if (lowerContent.includes('哇') || lowerContent.includes('真的吗') || lowerContent.includes('没想到') ||
               lowerContent.includes('意外') || lowerContent.includes('惊讶')) {
      setAvatarExpression('surprised');
    } else if (lowerContent.includes('专业') || lowerContent.includes('经验') || lowerContent.includes('技能') ||
               lowerContent.includes('能力') || lowerContent.includes('背景') || lowerContent.includes('简历')) {
      setAvatarExpression('professional');
    } else if (lowerContent.includes('自信') || lowerContent.includes('相信') || lowerContent.includes('确定') ||
               lowerContent.includes('肯定') || lowerContent.includes('没问题')) {
      setAvatarExpression('confident');
    } else {
      setAvatarExpression('neutral');
    }
    
    // 4秒后恢复中性表情
    setTimeout(() => {
      setAvatarExpression('neutral');
    }, 4000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getVirtualHumanUnavailableReason = ({ useVirtualHumanSDK, virtualHumanConnected, isReallyConnected, hasVirtualHumanRef }) => {
    if (!useVirtualHumanSDK) return '虚拟人SDK功能当前未启用';
    if (!hasVirtualHumanRef) return '虚拟人组件尚未初始化完成';
    if (!virtualHumanConnected && !isReallyConnected) return '虚拟人当前未连接成功或未处于可对话状态';
    return '虚拟人当前不可用，已回退到备用对话链路';
  };

  const getChatFallbackErrorMessage = (error) => {
    const rawMessage = error?.message || '';
    if (rawMessage.includes('HTTP 404')) return '对话接口不存在，请检查后端服务';
    if (rawMessage.includes('HTTP 500')) return 'AI模型服务内部错误，请稍后重试';
    if (rawMessage.includes('Failed to fetch')) return '网络连接失败，请检查网络或后端服务';
    if (rawMessage.includes('暂无可用模型') || rawMessage.includes('ollama pull') || rawMessage.includes('无法获取 Ollama 模型列表')) {
      return '本地模型未加载，请先启动模型服务';
    }
    if (rawMessage.includes('本地模型当前未启用')) {
      return '本地模型服务未启动，请检查配置';
    }
    if (rawMessage.includes('当前本地模型不支持图片输入')) {
      return '当前模型不支持图片输入，请切换模型';
    }
    if (rawMessage.includes('本地模型服务请求失败')) {
      return '模型服务连接失败，请检查服务状态';
    }
    return rawMessage || 'AI服务暂时不可用，请稍后重试';
  };

  const virtualHumanPlaceholderTitle = !useVirtualHumanSDK
    ? '数字人未启用'
    : virtualHumanError
      ? '数字人未连接'
      : '数字人待连接';

  const virtualHumanPlaceholderDescription = !useVirtualHumanSDK
    ? '当前环境没有启用数字人 SDK。\n你仍然可以使用左侧智能对话能力完成交流。'
    : virtualHumanError
      ? '数字人连接失败或已断开。\n你可以点击下方按钮重新尝试连接。'
      : '数字人正在等待连接。\n如果右侧暂未出现画面，可以手动发起连接。';

  const isVirtualInterviewActive = !!interviewState?.isAutoQuestionEnabled;
  const isFallbackInterviewActive = !!(isInterviewMode && fallbackInterviewState.isEnabled);
  const isAnyInterviewActive = isVirtualInterviewActive || isFallbackInterviewActive;
  const currentInterviewIndex = isVirtualInterviewActive
    ? (interviewState?.currentQuestionIndex || 0)
    : Math.max(fallbackInterviewState.currentQuestionIndex, 0);
  const currentInterviewTotal = isVirtualInterviewActive
    ? ((interviewState?.currentQuestionIndex || 0) < 6 ? 6 : (interviewState?.currentQuestionIndex || 0) + 1)
    : FALLBACK_INTERVIEW_TOTAL_QUESTIONS;
  const isActiveInterviewReplying =
    !!(interviewState?.isAutoQuestionEnabled && showActiveReplyBubble && (isLoading || virtualHumanStreaming || isFinalizingReply));

  const interviewStatusText = isVirtualInterviewActive
    ? (interviewState?.isInterviewComplete ? '面试完成' : isActiveInterviewReplying ? 'AI回答中...' : '等待用户操作...')
    : (isFallbackInterviewActive
      ? (fallbackInterviewState.isWaitingForAnswer ? '等待候选人回答...' : '本地面试已暂停/可结束')
      : '未启用');
  const interviewStatusColor = isVirtualInterviewActive
    ? (interviewState?.isInterviewComplete ? colors.success : isActiveInterviewReplying ? colors.warning : colors.primary)
    : (isFallbackInterviewActive ? colors.primary : colors.muted);

  const handleManualNextInterviewQuestion = () => {
    if (!virtualHumanRef.current) return;

    clearInterviewAdvanceTimer();

    const currentIndex = interviewState?.currentQuestionIndex || 0;
    const totalQuestions = 6;

    if (currentIndex >= totalQuestions - 1) {
      console.log('🎯 最后一个问题，手动结束面试');
      endInterviewMode();
      return;
    }

    virtualHumanRef.current.setInterviewState?.(prev => ({ ...prev, isAIEvaluating: false }));
    virtualHumanRef.current.handleNextQuestion?.({ force: true });
  };

  const handleStartInterviewClick = () => {
    const candidateForInterview = entryCandidate || selectedCandidate;
    if (candidateForInterview && !isAnyInterviewActive) {
      handleCandidateSelect(candidateForInterview);
      return;
    }

    setShowCandidateSelector(true);
  };

  const renderBotBubbleContent = (content, options = {}) => {
    const { active = false, timestamp = null } = options;

    return (
      <BotMessage>
        <ActiveBotMeta>
          <BotMetaLeft>
            <span>虚拟面试官</span>
          </BotMetaLeft>
          <BotMetaRight>
            {active ? (
              <BotStatusPill $active>
                <ThinkingSpinner />
                <span>正在回复</span>
              </BotStatusPill>
            ) : (
              <>
                <BotStatusPill>已完成</BotStatusPill>
                {timestamp && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {timestamp.toLocaleTimeString()}
                  </Text>
                )}
              </>
            )}
          </BotMetaRight>
        </ActiveBotMeta>
        <div style={{ lineHeight: '1.75', minHeight: '28px', whiteSpace: 'pre-wrap' }}>
          {content}
          {active && <span style={{ animation: 'blink 1s infinite', marginLeft: 2 }}>|</span>}
        </div>
      </BotMessage>
    );
  };

  return (
    <PageContainer>
      <GlobalStyle />
      <ChatCard>
        <ChatHeader>
          <div className="header-content">
            <h1>招聘灵犀</h1>
            <div className="subtitle">为您提供专业的AI数字人面试服务</div>
            <RuntimeBadge>
              <span
                className="dot"
                style={{
                  background: getLlmRuntimeDotColor(llmRuntimeInfo)
                }}
              />
              <span className="label">当前对话引擎</span>
              <span className="engine-name">{llmRuntimeInfo.label}</span>
              <RuntimeControls>
                <span className="runtime-label">切换</span>
                <Select
                  size="small"
                  className="runtime-select"
                  value={enginePreference}
                  onChange={handleEnginePreferenceChange}
                  options={availableEngines.map((engine) => ({
                    value: engine.key,
                    label: engine.label,
                    disabled: !engine.enabled
                  }))}
                />
                {localEngineSelected && availableLocalModels.length > 0 && (
                  <Select
                    size="small"
                    className="runtime-select local-model-select"
                    value={localModelPreference}
                    onChange={handleLocalModelChange}
                    options={availableLocalModels.map((model) => ({
                      value: model.key,
                      label: model.label,
                      disabled: !model.enabled
                    }))}
                  />
                )}
                {localEngineSelected && localVisionEnabled && (
                  <LocalVisionActions>
                    <span className="vision-hint">支持图文输入</span>
                  </LocalVisionActions>
                )}
              </RuntimeControls>
            </RuntimeBadge>
          </div>
          {isAnyInterviewActive && (
            <div style={{
              background: colors.primaryLight,
              padding: '10px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              minWidth: '140px',
              textAlign: 'center',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: colors.title }}>
                {isVirtualInterviewActive ? '数字人面试模式' : '本地LLM面试模式'}
              </div>
              <div style={{ fontSize: '12px', color: colors.text }}>
                {isAnyInterviewActive ? (
                  <>
                    <div>问题: {currentInterviewIndex + 1} / {currentInterviewTotal}</div>
                    <div style={{ 
                      color: interviewStatusColor,
                      fontWeight: '500',
                      marginTop: '2px'
                    }}>
                      {interviewStatusText}
                    </div>
                  </>
                ) : (
                  <div style={{ color: colors.muted }}>未启用</div>
                )}
              </div>
            </div>
          )}
        </ChatHeader>
        
        <QuickQuestionsBar>
          <span className="quick-label">快捷问题</span>
          {quickQuestions.map((question, index) => (
            <button
              key={index}
              className="quick-question"
              onClick={() => setInputValue(question)}
            >
              {question}
            </button>
          ))}
          <>
            <div style={{ width: '1px', height: '20px', background: colors.border, margin: '0 8px' }} />
            {!isAnyInterviewActive ? (
              <button
                className="quick-question"
                style={{ background: '#10B981', color: 'white' }}
                onClick={handleStartInterviewClick}
              >
                {entryCandidate ? `开始面试 · ${entryCandidate.name}` : '开始面试'}
              </button>
            ) : (
              <>
                <button
                  className="quick-question"
                  style={{ background: '#EF4444', color: 'white' }}
                  onClick={endInterviewMode}
                >
                  结束面试
                </button>
                {isVirtualInterviewActive && (
                  <>
                    <button
                      className="quick-question"
                      onClick={() => virtualHumanRef.current?.askQuestion?.(interviewState?.currentQuestionIndex || 0)}
                    >
                      重新提问
                    </button>
                    {(interviewState?.currentQuestionIndex || 0) < 5 && (
                      <button
                        className="quick-question"
                        style={{ background: '#F59E0B', color: 'white' }}
                        onClick={() => virtualHumanRef.current?.askQuestion?.((interviewState?.currentQuestionIndex || 0) + 1)}
                      >
                        跳过
                      </button>
                    )}
                    {interviewState?.isAIEvaluating && (
                      <button
                        className="quick-question"
                        style={{ background: '#8B5CF6', color: 'white' }}
                        onClick={handleManualNextInterviewQuestion}
                      >
                        下一题
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        </QuickQuestionsBar>

        <ChatContent>
          {/* 聊天消息区域 */}
          <ChatMessages>
            <ChatContainer ref={chatContainerRef}>
              {messages.length === 0 && !showActiveReplyBubble ? (
                <EmptyStateContainer>
                  <div className="empty-icon">👋</div>
                  <div className="empty-title">你好，我是招聘灵犀 AI面试官</div>
                  <div className="empty-desc">
                    你可以问我关于岗位、公司、面试的问题，我会为你提供专业的解答
                  </div>
                </EmptyStateContainer>
              ) : (
                <>
                  <AnimatePresence>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={msg.type === 'bot' ? { opacity: 0 } : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: msg.type === 'bot' ? 0.22 : 0.4 }}
                      >
                        <MessageBubble type={msg.type}>
                          <Avatar 
                            icon={msg.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                            size={40}
                            style={{ 
                              ...(msg.type === 'user'
                                ? {
                                    backgroundColor: colors.primary,
                                    flexShrink: 0,
                                    boxShadow: '0 4px 12px rgba(47, 128, 237, 0.2)'
                                  }
                                : botAvatarStyle)
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            {msg.type === 'user' ? (
                              <UserMessage>
                                {Array.isArray(msg.images) && msg.images.length > 0 && (
                                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                    {msg.images.map((image) => (
                                      <img
                                        key={image.id}
                                        src={image.dataUrl}
                                        alt={image.name || 'uploaded'}
                                        style={{
                                          width: '88px',
                                          height: '88px',
                                          objectFit: 'cover',
                                          borderRadius: '12px',
                                          border: '1px solid rgba(255,255,255,0.35)'
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                                {msg.content}
                              </UserMessage>
                            ) : (
                              renderBotBubbleContent(msg.content, { timestamp: msg.timestamp })
                            )}
                          </div>
                        </MessageBubble>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {showActiveReplyBubble && (
                    <MessageBubble type="bot">
                      <Avatar
                        icon={<RobotOutlined />}
                        size={40}
                        style={botAvatarStyle}
                      />
                      {renderBotBubbleContent(streamingMessage || pendingVirtualReplyRef.current || '虚拟人正在思考...', { active: true })}
                    </MessageBubble>
                  )}
                </>
              )}
            </ChatContainer>

            {localEngineSelected && localVisionEnabled && attachedImages.length > 0 && (
              <AttachmentTray>
                {attachedImages.map((image) => (
                  <AttachmentCard key={image.id}>
                    <img src={image.dataUrl} alt={image.name || 'uploaded'} />
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeAttachedImage(image.id)}
                    >
                      <DeleteOutlined />
                    </button>
                  </AttachmentCard>
                ))}
              </AttachmentTray>
            )}

            <InputArea>
              <Tooltip title={memoryEnabled ? "已开启记忆，AI会参考历史对话" : "已关闭记忆，AI不会参考历史对话"}>
                <MemoryToggle
                  $enabled={memoryEnabled}
                  onClick={() => handleMemoryToggleChange(!memoryEnabled)}
                >
                  <span className="memory-icon"><BulbOutlined /></span>
                  <span className="memory-label">记忆</span>
                  <span className="memory-checkbox">
                    <CheckOutlined />
                  </span>
                </MemoryToggle>
              </Tooltip>
              <span style={{
                marginLeft: 8,
                fontSize: 13,
                color: colors.muted,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                对话轮数: <span style={{ fontWeight: 600, color: colors.primary }}>{currentRounds}</span>
              </span>

              {/* TTS设置 - 仅本地引擎时显示 */}
              {enginePreference === 'local' && (
                <Popover
                  trigger="click"
                  placement="topLeft"
                  content={
                    <div style={{ width: 260, padding: '8px 0' }}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 4, fontSize: 13, color: '#666', fontWeight: 500 }}>
                          🎙️ 音色选择
                        </div>
                        <Select
                          style={{ width: '100%' }}
                          value={ttsConfig.voice}
                          onChange={(v) => setTtsConfig(prev => ({ ...prev, voice: v }))}
                          options={EDGE_TTS_VOICES.map(v => ({
                            value: v.id,
                            label: `${v.name} (${v.gender} · ${v.style})`
                          }))}
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>
                          ⚡ 语速: {ttsConfig.rate}
                        </div>
                        <Slider
                          min={-50}
                          max={100}
                          step={10}
                          value={parseInt(ttsConfig.rate) || 0}
                          onChange={(v) => setTtsConfig(prev => ({ ...prev, rate: `${v >= 0 ? '+' : ''}${v}%` }))}
                          marks={{ '-50': '慢', 0: '正常', 100: '快' }}
                        />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>
                          🔊 音量: {ttsConfig.volume}
                        </div>
                        <Slider
                          min={-50}
                          max={50}
                          step={10}
                          value={parseInt(ttsConfig.volume) || 0}
                          onChange={(v) => setTtsConfig(prev => ({ ...prev, volume: `${v >= 0 ? '+' : ''}${v}%` }))}
                          marks={{ '-50': '低', 0: '正常', 50: '高' }}
                        />
                      </div>
                    </div>
                  }
                >
                  <Tooltip title="语音设置（Edge-TTS）">
                    <Button type="text" size="small" icon={<SoundOutlined />} style={{ marginLeft: 8 }} />
                  </Tooltip>
                </Popover>
              )}
              <ChatGPTInputWrapper>
                <ChatGPTInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入您的问题，招聘灵犀将为您提供专业解答..."
                />
                <Tooltip title={voiceInputDisabled ? voiceInputDisabledReason : (isRecording ? "停止语音对话" : "开始语音对话")}>
                  <span>
                    <VoiceButtonInside
                      onClick={voiceInputDisabled ? undefined : (isRecording ? stopRecording : startRecording)}
                      disabled={voiceInputDisabled}
                      className={isRecording ? "recording" : ""}
                    >
                      {isRecording ? <StopOutlined /> : <AudioOutlined />}
                    </VoiceButtonInside>
                  </span>
                </Tooltip>
              </ChatGPTInputWrapper>
              {localEngineSelected && localVisionEnabled && (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleSelectVisionImage}
                  />
                  <Tooltip title="上传图片给 Qwen3.5-9B">
                    <AudioButton onClick={() => imageInputRef.current?.click()}>
                      <UploadOutlined />
                    </AudioButton>
                  </Tooltip>
                </>
              )}
              <SendButton
                type="primary"
                icon={<SendOutlined />}
                onClick={sendMessage}
                disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoading}
              >
                发送
              </SendButton>
            </InputArea>
          </ChatMessages>

          {/* 面试结果显示 */}
          {showInterviewResults && interviewScoring && completedInterviewCandidate && (
            <Card 
              title={`🎯 面试评分结果 - ${completedInterviewCandidate.name} (${completedInterviewCandidate.position})`}
              style={{ margin: '16px', backgroundColor: '#f0f8ff' }}
              extra={
                <Button onClick={() => setShowInterviewResults(false)}>
                  关闭
                </Button>
              }
            >
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '8px' }}>
                <h4>👤 候选人信息</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '14px' }}>
                  <div><strong>姓名：</strong>{completedInterviewCandidate.name}</div>
                  <div><strong>岗位：</strong>{completedInterviewCandidate.position}</div>
                  <div><strong>电话：</strong>{completedInterviewCandidate.phone}</div>
                  <div><strong>邮箱：</strong>{completedInterviewCandidate.email}</div>
                  <div><strong>MBTI：</strong>{completedInterviewCandidate.mbti}</div>
                  <div><strong>简历评分：</strong>{completedInterviewCandidate.matchScore}分</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <h3>📊 总体评分</h3>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                    {interviewScoring.totalScore}分
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <strong>等级：</strong>{interviewScoring.detailedAnalysis.answerQuality?.level || '待评估'}
                  </div>
                </div>
                
                <div>
                  <h3>📈 分项评分</h3>
                  <div style={{ fontSize: '14px' }}>
                    <div>回答质量: {interviewScoring.categoryScores.answerQuality?.score || 0}/40</div>
                    <div>沟通能力: {interviewScoring.categoryScores.communication?.score || 0}/25</div>
                    <div>专业能力: {interviewScoring.categoryScores.professionalism?.score || 0}/20</div>
                    <div>态度动机: {interviewScoring.categoryScores.attitude?.score || 0}/15</div>
                  </div>
                </div>
              </div>
              
              {interviewScoring.strengths.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4>✅ 优势</h4>
                  <ul>
                    {interviewScoring.strengths.map((strength, index) => (
                      <li key={index}>{strength.description}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {interviewScoring.weaknesses.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4>⚠️ 待改进</h4>
                  <ul>
                    {interviewScoring.weaknesses.map((weakness, index) => (
                      <li key={index}>{weakness.description}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {interviewScoring.recommendations.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4>💡 建议</h4>
                  <ul>
                    {interviewScoring.recommendations.map((rec, index) => (
                      <li key={index}>{rec.suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
                {interviewScoring.conversationSummary}
              </div>
            </Card>
          )}

          {/* 候选人选择器 */}
          <CandidateSelector
            visible={showCandidateSelector}
            onSelect={handleCandidateSelect}
            onCancel={() => setShowCandidateSelector(false)}
          />

          {/* 虚拟人容器 */}
          <VirtualHumanContainer $collapsed={isVirtualPanelCollapsed}>
            <VirtualHumanToggle
              $collapsed={isVirtualPanelCollapsed}
              type="text"
              onClick={() => setIsVirtualPanelCollapsed(prev => !prev)}
              title={isVirtualPanelCollapsed ? '展开数字人区域' : '收起数字人区域'}
            >
              {isVirtualPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </VirtualHumanToggle>

            {isVirtualPanelCollapsed ? (
              <VirtualHumanCollapsedHint>
                <span>数</span>
                <span>字</span>
                <span>人</span>
              </VirtualHumanCollapsedHint>
            ) : (
              <>
            {/* VirtualHumanSDK 组件始终渲染，确保 ref 可用 */}
            {useVirtualHumanSDK && (
              <VirtualHumanSDK
                ref={virtualHumanRef}
                config={virtualHumanConfig}
                onStatusChange={handleVirtualHumanStatusChange}
                onVirtualHumanReply={handleVirtualHumanReply}
                onVirtualHumanStreamingEnd={finishVirtualHumanStreaming}
                onAvatarClick={() => {
                  message.info('您好！我是招聘灵犀，很高兴为您服务！');
                }}
                style={{ width: '280px', height: '350px' }}
              />
            )}
            
            {/* 未连接时显示占位符覆盖层 */}
            {!virtualHumanConnected && (
              <VirtualHumanPlaceholder $isError={virtualHumanError}>
                <div className="placeholder-icon">
                  {virtualHumanError ? <ExclamationCircleOutlined /> : <RobotOutlined />}
                </div>
                <div className="placeholder-title">{virtualHumanPlaceholderTitle}</div>
                <div className="placeholder-desc">{virtualHumanPlaceholderDescription}</div>
                {virtualHumanError && (
                  <div className="error-badge">
                    <ExclamationCircleOutlined />
                    连接异常
                  </div>
                )}
                {useVirtualHumanSDK && (
                  <button
                    className="retry-button"
                    onClick={connectVirtualHuman}
                  >
                    <ReloadOutlined />
                    {virtualHumanError ? '重新连接' : '连接数字人'}
                  </button>
                )}
              </VirtualHumanPlaceholder>
            )}
              </>
            )}
          </VirtualHumanContainer>
        </ChatContent>
      </ChatCard>
    </PageContainer>
  );
};

export default ChatPage;
