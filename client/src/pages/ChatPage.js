import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Select, Slider, Tooltip, Popover, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import axios from 'axios';
import VirtualHumanSDK from '../components/VirtualHumanSDK';
import { virtualHumanConfig } from '../config/virtualHumanConfig';
import InterviewStorage from '../utils/interviewStorage';
import InterviewScoring from '../utils/interviewScoring';
import CandidateSelector from '../components/CandidateSelector';

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

const IconMic = ({ size = 20, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const IconStop = ({ size = 20, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const IconUser = ({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconBot = ({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" />
    <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" />
  </svg>
);

const IconVolume = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const IconPanelLeft = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

const IconPanelRight = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M15 3v18" />
  </svg>
);

const IconUpload = ({ size = 18, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconTrash = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconRefresh = ({ size = 14, color = 'currentColor', strokeWidth = 1.5, spin }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={spin ? { animation: 'spin 1s linear infinite' } : {}}>
    <path d="M21.5 2v6h-6" />
    <path d="M2.5 12a10 10 0 0 1 17.8-6.3L21.5 8" />
    <path d="M2.5 22v-6h6" />
    <path d="M21.5 12a10 10 0 0 1-17.8 6.3L2.5 16" />
  </svg>
);

const IconWarning = ({ size = 20, color = '#EF4444', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCheck = ({ size = 10, color = '#FFFFFF', strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconMemory = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10" />
    <path d="M12 2a10 10 0 0 1 10 10" />
    <path d="M12 6v6l4 2" />
    <circle cx="12" cy="12" r="3" />
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
  @keyframes errorPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }
`;

import { colors } from '../../theme/colors';

const COMPANY_PROFILE_CONTEXT = `嘉兴孪数光线科技有限公司成立于浙江嘉兴，是一家以BIM 技术为核心底座，深度聚焦空间数字模型构建与 AI 智慧场景应用创新的科技型企业。公司秉持 "产学研一体化" 的创业发展理念，依托数字孪生、人工智能、物联网集成技术，为工程建设领域提供从模型搭建、智能监测到自动管控的全链条解决方案。目前，公司自主研发的技术体系与产品平台已成功服务上海、苏州、嘉兴等长三角地区多个重点工程项目，覆盖智慧工地、工程数字孪生、AI 智能监测、人员智能管理、风险自动预警等核心场景，以技术创新推动工程管理向数字化、智能化、无人化升级。

一、公司文化
公司以技术立身、创新致远、务实担当、协同共赢为核心文化理念，坚持 "专业、严谨、开放、成长" 的价值导向。以 BIM 与空间数字模型为技术根基，鼓励技术探索与场景创新，倡导高效执行、诚信负责、主动协作的工作作风；注重员工成长与公司发展同频共振，打造有技术深度、有创新活力、有行业使命感的科技企业氛围。

二、工作时间与工作地点
工作时间：周一至周五 09:00–18:00，午休 12:00–13:00（1 小时），公司实行上下班打卡制度，依法保障员工休息权利，倡导高效工作、合理加班。
公司地址：浙江省嘉兴市经济技术开发区金穗路 79 号科技大楼 707 室。

三、团队氛围
公司团队以技术研发、工程数字化、AI 算法、项目实施为核心构成，整体年轻，专业、高效。团队氛围开放平等、沟通顺畅，重视技术交流与经验共享；工作中强调协作配合、结果导向，生活中互助包容、轻松务实。

四、晋升机制
公司建立公开、公平、透明的职业发展与晋升体系：
- 双通道晋升：专业通道（初级工程师→中级工程师→高级工程师→技术专家→首席专家）和管理通道（骨干员工→项目主管→部门经理→总监→高管）
- 晋升依据：月度/年度绩效考核结果、项目贡献、技术创新、团队协作与责任担当，专业能力提升、培训完成情况与岗位匹配度

五、福利待遇
基础保障：签订正式劳动合同，缴纳五险一金，享受国家法定节假日、带薪年假、病假、工伤假等完整休假体系。
薪酬激励：基础工资 + 绩效工资 + 奖金体系，月度绩效考核优秀者可享受 120% 绩效工资，配套全勤奖励、项目奖励、创新奖励。
加班补贴：工作日加班至 20:00 后享 25 元餐补；22:00 后享 30 元交通报销；非工作日加班享 25 元餐补，20:00 后享交通报销。

六、培训机会
公司高度重视人才培养，依托产学研一体化优势，搭建覆盖全职业周期的培训体系：
- 入职培训：公司制度、企业文化、业务流程、BIM 与数字孪生基础、产品体系培训
- 专业技能培训：BIM 技术深化、空间数字模型搭建、AI 智能识别、数字孪生平台应用、智慧工地解决方案培训

七、公司发展与价值
公司立足 BIM 与空间数字模型，深耕工程数字孪生与 AI 应用场景，以技术创新解决传统工程管理效率低、人工依赖高、风险响应慢等痛点，打造集智能监测、自动预警、自动推送、人员档案自动归档、设备智能联动、闭环管理于一体的智慧管控平台。`;

const COMPANY_CONTEXT_KEYWORDS = [
  '公司文化', '公司介绍', '公司简介', '公司背景', '公司业务',
  '公司是做什么', '企业文化', '文化', '福利', '福利待遇', '待遇',
  '团队氛围', '氛围', '培训', '培训机会', '晋升', '晋升机制',
  '工作时间', '工作地点', '办公地点', 'bim', '数字孪生', '嘉兴孪数光线'
];

const shouldInjectCompanyContext = (text = '') => {
  const normalizedText = String(text || '').trim().toLowerCase();
  if (!normalizedText) return false;
  return COMPANY_CONTEXT_KEYWORDS.some(keyword => normalizedText.includes(keyword.toLowerCase()));
};

const buildCompanyContextPrompt = (userText) => [
  '以下是招聘公司的背景资料，请优先基于这些资料回答，并自然融入答案中，不要提及"根据资料"或"根据背景信息"。',
  `公司简介：${COMPANY_PROFILE_CONTEXT}`,
  `用户问题：${userText}`,
  '',
  '【输出格式】禁止使用星号(*)、井号(#)、反引号(`)、波浪线(~)等特殊符号，使用自然语言表达。',
  '',
  '【回答风格】每次回答要有温度，像一位友善的HR在聊天，不要机械化。可以适当加入轻松的表达。',
  '',
  '【追问要求】回答结束后必须追问，但要自然变化。'
].join('\n');

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

const QuickBar = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 24px;

  .quick-label {
    color: ${colors.textMuted};
    font-size: 13px;
    font-weight: 500;
    margin-right: 4px;
  }

  .quick-btn {
    background: ${colors.bgSecondary};
    color: ${colors.text};
    border: none;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;

    &:hover {
      background: ${colors.accent};
      color: white;
      transform: translateY(-1px);
    }
  }
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

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 48px 24px;

  .wave-icon {
    font-size: 64px;
    margin-bottom: 24px;
    animation: float 3s ease-in-out infinite;
  }

  .empty-title {
    font-family: 'Noto Serif SC', Georgia, serif;
    font-size: 24px;
    font-weight: 400;
    color: ${colors.text};
    margin-bottom: 12px;
  }

  .empty-desc {
    font-size: 15px;
    color: ${colors.textMuted};
    max-width: 400px;
    line-height: 1.6;
  }
`;

const MessageRow = styled(motion.div)`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 24px;
  flex-direction: ${props => props.$isUser ? 'row-reverse' : 'row'};
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.$isUser ? colors.accent : `linear-gradient(135deg, ${colors.highlight} 0%, ${colors.accent} 100%)`};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px ${props => props.$isUser ? 'rgba(44, 44, 44, 0.2)' : 'rgba(139, 115, 85, 0.2)'};
`;

const Bubble = styled.div`
  max-width: 72%;
  padding: 14px 18px;
  border-radius: ${props => props.$isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
  background: ${props => props.$isUser ? colors.accent : '#FFFFFF'};
  color: ${props => props.$isUser ? '#FFFFFF' : colors.text};
  font-size: 15px;
  line-height: 1.65;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  border: ${props => props.$isUser ? 'none' : `1px solid ${colors.border}`};
  white-space: pre-wrap;
  word-break: break-word;
`;

const BotMetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: ${colors.textMuted};
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
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 12px;
  background: ${props => props.$active ? colors.bgSecondary : 'rgba(16, 185, 129, 0.1)'};
  color: ${props => props.$active ? colors.text : colors.success};
  font-size: 11px;
`;

const ThinkingSpinner = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${colors.border};
  border-top-color: ${colors.highlight};
  animation: spin 0.8s linear infinite;
`;

const ImageGrid = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
`;

const InlineImage = styled.img`
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.35);
`;

const InputRow = styled.div`
  background: #FFFFFF;
  padding: 16px 20px;
  border-top: 1px solid ${colors.border};
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const MemoryToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: ${props => props.$enabled ? colors.bgSecondary : 'rgba(148, 163, 184, 0.1)'};
  border: 1px solid ${props => props.$enabled ? colors.border : 'rgba(148, 163, 184, 0.2)'};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  color: ${props => props.$enabled ? colors.text : colors.textMuted};
  font-weight: 500;

  &:hover {
    background: ${props => props.$enabled ? colors.border : 'rgba(148, 163, 184, 0.15)'};
  }
`;

const CheckboxBox = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid ${props => props.$enabled ? colors.highlight : 'rgba(148, 163, 184, 0.4)'};
  background: ${props => props.$enabled ? colors.highlight : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
`;

const RoundCounter = styled.span`
  font-size: 13px;
  color: ${colors.textMuted};
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  strong {
    color: ${colors.accent};
    font-weight: 600;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 14px;
  padding: 8px 16px;
  transition: all 0.2s;

  &:focus-within {
    border-color: ${colors.highlight};
    box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.08);
  }
`;

const TextInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: ${colors.text};
  height: 40px;

  &::placeholder { color: ${colors.textMuted}; }
`;

const IconBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${colors.textMuted};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: ${colors.bgSecondary};
    color: ${colors.accent};
  }

  &.recording {
    background: rgba(239, 68, 68, 0.1);
    color: ${colors.danger};
  }
`;

const SendBtn = styled.button`
  height: 44px;
  padding: 0 22px;
  border-radius: 10px;
  background: ${colors.accent};
  border: none;
  color: white;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(44, 44, 44, 0.15);

  &:hover {
    background: ${colors.highlight};
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(44, 44, 44, 0.2);
  }

  &:disabled {
    background: ${colors.textMuted};
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const TextBtn = styled.button`
  background: none;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  color: ${colors.text};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${colors.bgSecondary};
    border-color: ${colors.textMuted};
  }
`;

const UploadBtn = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: ${colors.bgSecondary};
  color: ${colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);

  &:hover {
    background: ${colors.highlight};
    color: white;
  }
`;

const AttachmentTray = styled.div`
  display: flex;
  gap: 10px;
  padding: 0 20px 14px;
  flex-wrap: wrap;
`;

const AttachmentCard = styled.div`
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.border};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const RemoveBtn = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Virtual Human Panel
const VirtualHumanPanel = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 280px);
  min-height: 500px;
  position: sticky;
  top: 24px;
`;

const VHPanelHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid ${colors.border};

  h3 {
    font-family: 'Noto Serif SC', Georgia, serif;
    font-size: 18px;
    font-weight: 400;
    color: ${colors.text};
    margin: 0 0 4px 0;
  }

  p {
    font-size: 13px;
    color: ${colors.textMuted};
    margin: 0;
  }
`;

const VHPanelToggle = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textMuted};
  transition: all 0.2s;

  &:hover {
    border-color: ${colors.accent};
    color: ${colors.accent};
  }
`;

const VHContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
  background: ${colors.bg};
  position: relative;
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

const VHAvatar = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${colors.highlight} 0%, ${colors.accent} 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(139, 115, 85, 0.25);
  animation: float 4s ease-in-out infinite;
`;

const VHName = styled.div`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  color: ${colors.text};
  margin-bottom: 8px;
`;

const VHDesc = styled.p`
  font-size: 13px;
  color: ${colors.textMuted};
  line-height: 1.6;
  max-width: 240px;
`;

// Interview Results Card
const ResultsCardWrapper = styled.div`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  margin-top: 16px;
  background: ${colors.bg};
  overflow: hidden;
`;

const ResultsCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid ${colors.border};
`;

const ResultsCardTitle = styled.div`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 15px;
  color: ${colors.text};
`;

const ResultGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
`;

const ScoreBig = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 400;
  color: ${colors.highlight};
`;

const ScoreBar = styled.div`
  height: 8px;
  border-radius: 4px;
  background: ${colors.bgSecondary};
  margin-top: 8px;
  overflow: hidden;

  .fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, ${colors.highlight}, ${colors.accent});
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

const StrengthItem = styled.li`
  padding: 8px 0;
  border-bottom: 1px solid ${colors.border};
  font-size: 14px;
  color: ${colors.text};

  &:last-child { border-bottom: none; }
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

  const EDGE_TTS_VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: '女', style: '温柔' },
    { id: 'zh-CN-YunxiNeural', name: '云希', gender: '男', style: '阳光' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: '女', style: '温暖' },
    { id: 'zh-CN-YunjianNeural', name: '云健', gender: '男', style: '播音' },
  ];

  const chatContainerRef = useRef(null);
  const virtualHumanRef = useRef(null);
  const imageInputRef = useRef(null);
  const interviewStorage = useRef(new InterviewStorage());
  const interviewScoringSystem = useRef(new InterviewScoring());
  const recognitionRef = useRef(null);
  const hasInitializedRuntimeRef = useRef(false);

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

  const handleLocalModelChange = (model) => {
    setLocalModelPreference(model);
  };

  const handleMemoryToggleChange = (enabled) => {
    setMemoryEnabled(enabled);
    if (!enabled) { setMessages([]); message.info('已清空对话历史'); }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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

  const quickQuestions = [
    '公司文化是什么样的？',
    '有哪些福利待遇？',
    '工作时间和地点？',
    '晋升机制如何？',
    '团队氛围怎么样？',
    '培训机会有哪些？'
  ];

  const getLlmRuntimeDotColor = (runtime) => {
    if (!runtime || runtime.source === 'unknown') return colors.textMuted;
    const label = String(runtime.label || '');
    if (label.includes('未就绪') || label.includes('失败')) return colors.danger;
    return colors.success;
  };

  const renderBotBubble = (content, options = {}) => {
    const { active = false, timestamp = null } = options;
    return (
      <>
        <BotMetaRow>
          <BotMetaLeft>
            <span>虚拟面试官</span>
          </BotMetaLeft>
          <BotMetaRight>
            {active ? (
              <StatusPill $active>
                <ThinkingSpinner />
                <span>正在回复</span>
              </StatusPill>
            ) : (
              <>
                <StatusPill>已完成</StatusPill>
                {timestamp && <span style={{ fontSize: '12px', color: colors.textMuted }}>{timestamp.toLocaleTimeString()}</span>}
              </>
            )}
          </BotMetaRight>
        </BotMetaRow>
        <div style={{ lineHeight: '1.75', minHeight: '28px', whiteSpace: 'pre-wrap' }}>
          {content}
          {active && <span style={{ animation: 'blink 1s infinite', marginLeft: 2 }}>|</span>}
        </div>
      </>
    );
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
          <QuickBar>
            <span className="quick-label">快捷问题</span>
            {quickQuestions.map((q, i) => (
              <button key={i} className="quick-btn" onClick={() => setInputValue(q)}>{q}</button>
            ))}
          </QuickBar>

          <ChatPanel>
            <ChatMessagesArea ref={chatContainerRef}>
              {messages.length === 0 && !showActiveReplyBubble ? (
                <EmptyState>
                  <VHAvatar style={{ width: 80, height: 80, marginBottom: 20 }}>
                    <IconBot size={36} color="#FFFFFF" />
                  </VHAvatar>
                  <div className="empty-title">你好，我是招聘灵犀 AI面试官</div>
                  <div className="empty-desc">你可以问我关于岗位、公司、面试的问题，我会为你提供专业的解答</div>
                </EmptyState>
              ) : (
                <>
                  <AnimatePresence>
                    {messages.map((msg) => (
                      <MessageRow
                        key={msg.id}
                        $isUser={msg.type === 'user'}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <Avatar $isUser={msg.type === 'user'}>
                          {msg.type === 'user' ? <IconUser size={18} /> : <IconBot size={18} />}
                        </Avatar>
                        <Bubble $isUser={msg.type === 'user'}>
                          {msg.type === 'user' ? (
                            <>
                              {Array.isArray(msg.images) && msg.images.length > 0 && (
                                <ImageGrid>
                                  {msg.images.map(img => (
                                    <InlineImage key={img.id} src={img.dataUrl} alt={img.name} />
                                  ))}
                                </ImageGrid>
                              )}
                              {msg.content}
                            </>
                          ) : (
                            renderBotBubble(msg.content, { timestamp: msg.timestamp })
                          )}
                        </Bubble>
                      </MessageRow>
                    ))}
                  </AnimatePresence>

                  {showActiveReplyBubble && (
                    <MessageRow $isUser={false}>
                      <Avatar $isUser={false}>
                        <IconBot size={18} />
                      </Avatar>
                      <Bubble $isUser={false}>
                        {renderBotBubble(streamingMessage || '虚拟人正在思考...', { active: true })}
                      </Bubble>
                    </MessageRow>
                  )}
                </>
              )}
            </ChatMessagesArea>

            {localEngineSelected && localVisionEnabled && attachedImages.length > 0 && (
              <AttachmentTray>
                {attachedImages.map(img => (
                  <AttachmentCard key={img.id}>
                    <img src={img.dataUrl} alt={img.name} />
                    <RemoveBtn onClick={() => removeAttachedImage(img.id)}>
                      <IconTrash size={12} />
                    </RemoveBtn>
                  </AttachmentCard>
                ))}
              </AttachmentTray>
            )}

            <InputRow>
              <MemoryToggle
                $enabled={memoryEnabled}
                onClick={() => handleMemoryToggleChange(!memoryEnabled)}
              >
                <IconMemory size={14} color={memoryEnabled ? colors.highlight : colors.textMuted} />
                <span>记忆</span>
                <CheckboxBox $enabled={memoryEnabled}>
                  <IconCheck size={10} color="#FFFFFF" />
                </CheckboxBox>
              </MemoryToggle>

              <RoundCounter>
                轮数: <strong>{currentRounds}</strong>
              </RoundCounter>

              {enginePreference === 'local' && (
                <Popover
                  trigger="click"
                  placement="topLeft"
                  content={
                    <div style={{ width: 260, padding: '8px 0' }}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 4, fontSize: 13, color: '#666', fontWeight: 500 }}>音色选择</div>
                        <Select
                          style={{ width: '100%' }}
                          value={ttsConfig.voice}
                          onChange={v => setTtsConfig(prev => ({ ...prev, voice: v }))}
                          options={EDGE_TTS_VOICES.map(v => ({ value: v.id, label: `${v.name} (${v.gender} · ${v.style})` }))}
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>语速: {ttsConfig.rate}</div>
                        <Slider
                          min={-50} max={100} step={10}
                          value={parseInt(ttsConfig.rate) || 0}
                          onChange={v => setTtsConfig(prev => ({ ...prev, rate: `${v >= 0 ? '+' : ''}${v}%` }))}
                          marks={{ '-50': '慢', 0: '正常', 100: '快' }}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>音量: {ttsConfig.volume}</div>
                        <Slider
                          min={-50} max={50} step={10}
                          value={parseInt(ttsConfig.volume) || 0}
                          onChange={v => setTtsConfig(prev => ({ ...prev, volume: `${v >= 0 ? '+' : ''}${v}%` }))}
                          marks={{ '-50': '低', 0: '正常', 50: '高' }}
                        />
                      </div>
                    </div>
                  }
                >
                  <IconBtn title="语音设置（Edge-TTS）">
                    <IconVolume size={14} />
                  </IconBtn>
                </Popover>
              )}

              <InputWrapper>
                <TextInput
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入您的问题，招聘灵犀将为您提供专业解答..."
                />
                <IconBtn
                  className={isRecording ? 'recording' : ''}
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? '停止' : '语音输入'}
                >
                  {isRecording ? <IconStop size={16} color={colors.danger} /> : <IconMic size={16} />}
                </IconBtn>
              </InputWrapper>

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
                  <UploadBtn onClick={() => imageInputRef.current?.click()} title="上传图片">
                    <IconUpload size={18} color={colors.text} />
                  </UploadBtn>
                </>
              )}

              <SendBtn
                onClick={sendMessage}
                disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoading}
              >
                <IconSend size={15} />
                发送
              </SendBtn>
            </InputRow>
          </ChatPanel>

          {showInterviewResults && interviewScoring && completedInterviewCandidate && (
            <ResultsCardWrapper>
              <ResultsCardHeader>
                <ResultsCardTitle>面试评分结果 - {completedInterviewCandidate.name} ({completedInterviewCandidate.position})</ResultsCardTitle>
                <TextBtn onClick={() => setShowInterviewResults(false)}>关闭</TextBtn>
              </ResultsCardHeader>
              <ResultGrid>
                <div>
                  <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>总体评分</div>
                  <ScoreBig>{interviewScoring.totalScore}分</ScoreBig>
                  <ScoreBar><div className="fill" style={{ width: `${interviewScoring.totalScore}%` }} /></ScoreBar>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>分项评分</div>
                  <div style={{ fontSize: 14, lineHeight: 2 }}>
                    <div>回答质量: {interviewScoring.categoryScores?.answerQuality?.score || 0}/40</div>
                    <div>沟通能力: {interviewScoring.categoryScores?.communication?.score || 0}/25</div>
                    <div>专业能力: {interviewScoring.categoryScores?.professionalism?.score || 0}/20</div>
                    <div>态度动机: {interviewScoring.categoryScores?.attitude?.score || 0}/15</div>
                  </div>
                </div>
              </ResultGrid>
              {interviewScoring.strengths?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>优势</div>
                  <ul style={{ paddingLeft: 20 }}>
                    {interviewScoring.strengths.map((s, i) => <StrengthItem key={i}>{s.description}</StrengthItem>)}
                  </ul>
                </div>
              )}
              {interviewScoring.weaknesses?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>待改进</div>
                  <ul style={{ paddingLeft: 20 }}>
                    {interviewScoring.weaknesses.map((w, i) => <StrengthItem key={i}>{w.description}</StrengthItem>)}
                  </ul>
                </div>
              )}
            </ResultsCardWrapper>
          )}
        </ChatCard>

        {/* Right Column */}
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

        {/* Virtual Human Panel */}
        <VirtualHumanPanel>
          <VHPanelHeader style={{ position: 'relative' }}>
            <VHPanelToggle onClick={() => setIsVirtualPanelCollapsed(!isVirtualPanelCollapsed)}>
              {isVirtualPanelCollapsed ? <IconPanelLeft size={14} /> : <IconPanelRight size={14} />}
            </VHPanelToggle>
            <h3>数字人形象</h3>
            <p>AI虚拟面试官实时互动</p>
          </VHPanelHeader>

          <VHContent>
            <VHAvatar>
              {virtualHumanError ? (
                <IconWarning size={48} color={colors.danger} />
              ) : (
                <IconBot size={48} color="#FFFFFF" />
              )}
            </VHAvatar>
            <VHName>招聘灵犀</VHName>
            <VHDesc>
              {virtualHumanError
                ? '数字人服务连接失败，请检查网络配置或联系管理员'
                : '随时为您服务，支持语音对话与实时面试评估'}
            </VHDesc>
          </VHContent>

          <div style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>连接状态</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: virtualHumanConnected ? colors.success : colors.danger
              }} />
              <span style={{ fontSize: 13, color: colors.text }}>
                {virtualHumanConnected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>
        </VirtualHumanPanel>
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
