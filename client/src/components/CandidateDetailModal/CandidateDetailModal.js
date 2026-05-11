import React, { useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Divider,
  Empty,
  Modal,
  Progress,
  Select,
  Tag,
  Typography
} from 'antd';
import {
  BankOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SafetyOutlined,
  TrophyOutlined,
  MailOutlined,
  BulbOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { calculateResumeScore } from '../../pages/ResumeAnalysis';
import TechLoadingAnimation from './LoadingAnimation';
import './CandidateDetailModal.css';
import { colors } from '../../theme/colors';

const { Title, Text } = Typography;

const StyledModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 16px;
    padding: 0;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }

  .ant-modal-body {
    padding: 0;
  }

  .ant-modal-header {
    display: none;
  }
`;

const MATCH_LEVEL_META = {
  high: { label: '高匹配', color: 'success' },
  medium: { label: '中等匹配', color: 'processing' },
  low: { label: '低匹配', color: 'warning' },
  reject: null
};

const RISK_LEVEL_META = {
  low: { label: '低风险', color: 'success' },
  medium: { label: '中风险', color: 'warning' },
  high: { label: '高风险', color: 'error' }
};

const SCORE_COLOR = (value) => {
  if (value >= 85) return '#10B981';
  if (value >= 70) return '#2F80ED';
  if (value >= 55) return '#F59E0B';
  return '#EF4444';
};

const getResumeRecommendationLabel = (resumeScore) => {
  if (resumeScore >= 75) return '强烈推荐';
  if (resumeScore >= 60) return '推荐';
  if (resumeScore >= 45) return '待考虑';
  return '建议淘汰';
};

const getResumeMatchMeta = (resumeScore) => {
  if (resumeScore >= 75) return MATCH_LEVEL_META.high;
  if (resumeScore >= 60) return MATCH_LEVEL_META.medium;
  return MATCH_LEVEL_META.low;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const clampScore = (value, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(max, Math.round(numeric)));
};

const toTextArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap(item => toTextArray(item))
      .filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized ? [normalized] : [];
};

const hasMeaningfulExperienceContent = (items = [], fields = []) => {
  return safeArray(items).some(item => {
    if (typeof item === 'string') {
      return item.trim().length > 0;
    }
    return fields.some(field => {
      const fieldValue = item?.[field];
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(entry => String(entry || '').trim().length > 0);
      }
      return String(fieldValue || '').trim().length > 0;
    });
  });
};

const deriveScoreFallbacksFromContent = (scores = {}, extractedContent = {}) => {
  const workExperience = safeArray(extractedContent.workExperience);
  const projectExperience = safeArray(extractedContent.projectExperience || extractedContent.projects);
  const campusExperience = safeArray(extractedContent.campusExperience);
  const education = safeArray(extractedContent.education);
  const skills = safeArray(extractedContent.skills);

  const hasWorkExperience = hasMeaningfulExperienceContent(workExperience, ['company', 'companyOrOrg', 'position', 'role', 'description', 'responsibilities']);
  const hasProjectExperience = hasMeaningfulExperienceContent(projectExperience, ['projectName', 'name', 'role', 'description', 'responsibilities']);
  const hasCampusExperience = hasMeaningfulExperienceContent(campusExperience, ['organization', 'role', 'description']);
  const hasEducation = hasMeaningfulExperienceContent(education, ['school', 'major', 'degree']);
  const hasSkills = skills.length > 0;

  const workScore = scores.workScore > 0
    ? clampScore(scores.workScore, 20)
    : (hasWorkExperience ? clampScore(Math.min(20, workExperience.length * 8 + (hasProjectExperience ? 4 : 0)), 20) : 0);

  const projectScore = scores.projectScore > 0
    ? clampScore(scores.projectScore, 30)
    : (hasProjectExperience || hasCampusExperience
      ? clampScore(Math.min(30, projectExperience.length * 10 + campusExperience.length * 6), 30)
      : 0);

  const expressionSignals = [
    hasEducation,
    hasWorkExperience,
    hasProjectExperience || hasCampusExperience,
    hasSkills,
  ].filter(Boolean).length;

  const expressionScore = scores.expressionScore > 0
    ? clampScore(scores.expressionScore, 5)
    : clampScore(Math.min(5, expressionSignals), 5);

  return {
    educationScore: clampScore(scores.educationScore, 20),
    workScore,
    projectScore,
    skillScore: clampScore(scores.skillScore, 25),
    expressionScore,
    riskPenalty: clampScore(scores.riskPenalty, 20),
  };
};

const REPORT_SECTION_ALIASES = {
  '综合评价': '整体评价',
  '面试官评价': '整体评价',
  '优势亮点': '核心优势',
  '候选人优势': '核心优势',
  '优点': '核心优势',
  '主要优点': '核心优势',
  '改进建议': '待提升项',
  '主要短板': '待提升项',
  '候选人短板': '待提升项',
  '缺点': '待提升项',
  '主要缺点': '待提升项',
  '录用结论': '录用建议',
};

const REPORT_SECTION_CANONICAL_LABELS = [
  '整体评价',
  'IQ分析',
  'EQ分析',
  'AQ分析',
  'MQ分析',
  '核心优势',
  '待提升项',
  '录用建议',
];

const REPORT_SECTION_MATCHER = new RegExp(
  `(${[...REPORT_SECTION_CANONICAL_LABELS, ...Object.keys(REPORT_SECTION_ALIASES)]
    .sort((left, right) => right.length - left.length)
    .join('|')})[：:]`,
  'g'
);

const INTERVIEW_DIMENSION_META = {
  iq: {
    label: 'IQ分析',
    title: '智商 IQ',
    max: 50,
    type: 'iq',
    icon: <BulbOutlined />,
    positive: '专业知识和逻辑表达比较扎实，能围绕岗位问题给出有结构的回答。',
    negative: '专业知识呈现还不够稳定，部分回答停留在概念层面，缺少关键细节支撑。',
  },
  eq: {
    label: 'EQ分析',
    title: '情商 EQ',
    max: 20,
    type: 'eq',
    icon: <SafetyOutlined />,
    positive: '沟通表达自然，能兼顾协作关系和业务情境，互动感较好。',
    negative: '沟通中的同理心和协作表达偏弱，遇到人际场景时说服力还不够。',
  },
  aq: {
    label: 'AQ分析',
    title: '逆商 AQ',
    max: 15,
    type: 'aq',
    icon: <TrophyOutlined />,
    positive: '面对压力与困难时有一定复盘和应对思路，表现出较好的韧性。',
    negative: '面对挑战时的拆解思路还不够清晰，抗压和复盘能力需要更多案例支撑。',
  },
  mq: {
    label: 'MQ分析',
    title: '德商 MQ',
    max: 15,
    type: 'mq',
    icon: <SafetyOutlined />,
    positive: '职业判断和价值观表达比较稳定，能体现责任意识与边界感。',
    negative: '职业判断和价值观表达略显笼统，责任意识与原则性还需要更具体的例子。',
  },
};

const deriveInterviewRecommendation = (totalScore = 0) => {
  if (totalScore >= 85) return '建议优先推进复试或录用评估，重点核实薪酬与到岗时间。';
  if (totalScore >= 75) return '建议进入下一轮，围绕岗位深水区问题继续验证稳定性和实战细节。';
  if (totalScore >= 65) return '可作为备选候选人，建议补充考察关键技能和真实项目贡献。';
  return '暂不建议直接推进录用，除非后续补充面试能明显弥补关键短板。';
};

const deriveInterviewOverallSummary = ({ totalScore = 0, candidateName, strongestDimensionLabel, weakestDimensionLabel }) => {
  const candidateLabel = candidateName ? `${candidateName}` : '该候选人';
  const scoreLevel = totalScore >= 85
    ? '整体表现比较突出'
    : totalScore >= 75
      ? '整体表现稳健'
      : totalScore >= 65
        ? '具备一定岗位匹配度'
        : '当前匹配度仍需谨慎评估';

  const strengthPart = strongestDimensionLabel
    ? `其中${strongestDimensionLabel}是当前最明显的优势维度。`
    : '';
  const weaknessPart = weakestDimensionLabel
    ? `相对需要继续确认的是${weakestDimensionLabel}相关表现。`
    : '';

  return `${candidateLabel}${scoreLevel}，面试总分为${Math.round(totalScore)}分。${strengthPart}${weaknessPart}`.trim();
};

const buildDimensionSectionFallback = (dimensionKey, score = 0) => {
  const meta = INTERVIEW_DIMENSION_META[dimensionKey];
  if (!meta) return '';
  const ratio = meta.max > 0 ? score / meta.max : 0;
  if (ratio >= 0.72) return meta.positive;
  if (ratio <= 0.45) return meta.negative;
  return `${meta.title}表现中等，基础能力具备，但还需要更多具体案例来增强判断把握。`;
};

const parseInterviewReportSections = (reportText = '') => {
  const normalized = String(reportText || '').replace(/\r/g, '').trim();
  if (!normalized) return {};

  const matches = [...normalized.matchAll(REPORT_SECTION_MATCHER)];
  if (matches.length === 0) return {};

  const sections = {};
  matches.forEach((match, index) => {
    const label = REPORT_SECTION_ALIASES[match[1]] || match[1];
    const valueStart = match.index + match[0].length;
    const valueEnd = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const value = normalized.slice(valueStart, valueEnd).trim();
    if (value) {
      sections[label] = value;
    }
  });

  return sections;
};

const normalizeReportSectionLines = (value = '') => {
  if (!value) return [];
  const bulletSplit = String(value)
    .replace(/[；;]\s*/g, '\n')
    .split(/\n|(?=•)|(?=\d+[.、])|(?=优点[：:])|(?=缺点[：:])/)
    .map(item => item.replace(/^(优点|缺点)[：:]/, '').replace(/^[-•\s]+/, '').trim())
    .filter(Boolean);

  return bulletSplit.length > 0 ? bulletSplit : [String(value).trim()];
};

const dedupeReportLines = (items = []) => {
  const visited = new Set();
  return items.filter(item => {
    const normalized = String(item || '').trim();
    if (!normalized || visited.has(normalized)) return false;
    visited.add(normalized);
    return true;
  });
};

const buildInterviewReportViewModel = (candidate) => {
  const interviewDetails = candidate?.interviewDetails || {};
  const reportText = interviewDetails.report || '';
  const parsedSections = parseInterviewReportSections(reportText);
  const categoryScores = interviewDetails.categoryScores || {};
  const dimensionEntries = Object.entries(INTERVIEW_DIMENSION_META).map(([key, meta]) => ({
    key,
    meta,
    score: Number(categoryScores?.[key]?.score || 0),
  }));
  const sortedDimensions = [...dimensionEntries].sort((left, right) => right.score - left.score);
  const strongestDimension = sortedDimensions[0];
  const weakestDimension = sortedDimensions[sortedDimensions.length - 1];

  const strengths = dedupeReportLines(
    normalizeReportSectionLines(parsedSections['核心优势']).concat(
      strongestDimension?.score > 0
        ? [buildDimensionSectionFallback(strongestDimension.key, strongestDimension.score)]
        : []
    )
  ).slice(0, 3);

  const improvements = dedupeReportLines(
    normalizeReportSectionLines(parsedSections['待提升项']).concat(
      weakestDimension?.score > 0
        ? [buildDimensionSectionFallback(weakestDimension.key, weakestDimension.score)]
        : []
    )
  ).slice(0, 3);

  const overall = dedupeReportLines(
    normalizeReportSectionLines(parsedSections['整体评价']).concat(
      deriveInterviewOverallSummary({
        totalScore: interviewDetails.totalScore || 0,
        candidateName: candidate?.name,
        strongestDimensionLabel: strongestDimension?.meta?.title,
        weakestDimensionLabel: weakestDimension?.meta?.title,
      })
    )
  ).slice(0, 3);

  const recommendationLines = dedupeReportLines(
    normalizeReportSectionLines(parsedSections['录用建议']).concat(
      deriveInterviewRecommendation(interviewDetails.totalScore || 0)
    )
  ).slice(0, 2);

  const dimensionCards = dimensionEntries.map(({ key, meta, score }) => ({
    key,
    label: meta.label,
    title: meta.title,
    type: meta.type,
    icon: meta.icon,
    score,
    content: dedupeReportLines(
      normalizeReportSectionLines(parsedSections[meta.label]).concat(buildDimensionSectionFallback(key, score))
    ).slice(0, 2),
  }));

  return {
    reportText,
    overall,
    strengths,
    improvements,
    recommendationLines,
    dimensionCards,
    hasStructuredContent: Boolean(
      overall.length || strengths.length || improvements.length || recommendationLines.length || dimensionCards.some(card => card.content.length)
    ),
  };
};

const buildFallbackInterviewSuggestions = ({ risks, scores, extractedContent, position }) => {
  const suggestions = [];
  const { education, workExperience, projectExperience, skills } = extractedContent || {};

  if (Array.isArray(projectExperience) && projectExperience.length > 0) {
    const mainProject = projectExperience[0];
    const projectName = mainProject.projectName || mainProject.name || '你的项目';
    suggestions.push(`请详细介绍在"${projectName}"项目中担任的具体角色和主要贡献？`);

    if (projectExperience.length > 1) {
      const secondProject = projectExperience[1];
      const secondName = secondProject.projectName || secondProject.name || '该项目';
      suggestions.push(`在"${secondName}"项目中遇到了哪些技术难点，是如何解决的？`);
    }
  }

  if (Array.isArray(workExperience) && workExperience.length > 0) {
    const mainWork = workExperience[0];
    const company = mainWork.company || mainWork.companyOrOrg || '该公司';
    const role = mainWork.position || mainWork.role || '该岗位';
    suggestions.push(`在${company}担任${role}期间，最有成就感的工作成果是什么？`);

    if (workExperience.length > 1) {
      suggestions.push(`请说明从上一份工作离职的主要原因？`);
    }
  }

  if (Array.isArray(education) && education.length > 0) {
    const edu = education[0];
    const major = edu.major || '你的专业';
    if (major && major !== '未标注') {
      suggestions.push(`你所学的${major}专业对申请${position || '该岗位'}有哪些帮助？`);
    }
  }

  if (Array.isArray(skills) && skills.length > 0) {
    const mainSkill = skills[0];
    const skillName = typeof mainSkill === 'string' ? mainSkill : (mainSkill.name || mainSkill.skill || '该技能');
    suggestions.push(`你提到熟悉${skillName}，请举例说明在实际项目中的应用经验？`);
  }

  if (safeArray(risks?.items).length > 0) {
    const highRisks = risks.items.filter(r => r.severity === 'high');
    if (highRisks.length > 0) {
      const risk = highRisks[0];
      const riskTitle = risk.title || '该方面';
      suggestions.push(`关于"${riskTitle}"，能否提供更多细节或证明材料？`);
    }
  }

  if ((scores?.workScore || 0) === 0 && (scores?.projectScore || 0) <= 8 && suggestions.length === 0) {
    suggestions.push('请具体介绍一段最能体现你能力的实习、项目或兼职经历，你的职责和产出分别是什么？');
  }

  if ((scores?.skillScore || 0) < 15 && suggestions.length < 3) {
    suggestions.push('请举例说明你在实际场景中如何使用岗位关键技能完成任务，最终效果如何？');
  }

  if (suggestions.length === 0) {
    suggestions.push('如果只选一段最贴近目标岗位的经历来证明自己，你会选哪一段，为什么？');
  }

  return [...new Set(suggestions)].slice(0, 5);
};

const formatScore = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}分` : '--');
const formatInterviewScore = (value, hasInterview) => {
  if (!hasInterview) return '未面试（0分）';
  return formatScore(value ?? 0);
};

const formatValue = (value, fallback = '未提及') => {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
};

/**
 * 规范化手机号显示格式
 * - 移除所有空格、横线等分隔符
 * - 移除国际区号前缀 (+86, 86)
 * - 返回纯数字格式
 */
const normalizePhoneDisplay = (phone) => {
  if (!phone) return '';
  let normalized = String(phone).trim();
  // 移除所有分隔符
  normalized = normalized.replace(/[\s\-\—\–\_\.\/\\\(\)\[\]\{\}]/g, '');
  // 移除国际区号
  normalized = normalized.replace(/^(\+86|86|0086)/, '');
  // 提取数字部分
  const digits = normalized.replace(/[^\d]/g, '');
  // 验证手机号格式
  if (/^1[3-9]\d{9}$/.test(digits)) {
    return digits;
  }
  // 返回原始值（已清理分隔符）
  return normalized || phone;
};

/**
 * 规范化邮箱显示格式
 * - 移除所有空格
 * - 转小写
 * - 修复常见的格式问题
 */
const normalizeEmailDisplay = (email) => {
  if (!email) return '';
  let normalized = String(email).trim().toLowerCase();
  // 移除所有空格
  normalized = normalized.replace(/\s+/g, '');
  // 修复常见的缺少@的情况
  const emailProviders = ['qq.com', '163.com', '126.com', 'gmail.com', 'outlook.com', 'hotmail.com'];
  for (const provider of emailProviders) {
    if (normalized.includes(provider.replace('.', '')) && !normalized.includes('@')) {
      normalized = normalized.replace(provider.replace('.', ''), `@${provider}`);
    }
  }
  return normalized;
};

const ANALYZING_STATUSES = new Set([
  '分析中',
  'local-VL排队中',
  'Qwen3.5-9B排队中',
  'local-VL分析准备中',
  'Qwen3.5-9B分析准备中',
  'PDF解析中',
  'local-VL OCR分析中',
  'Qwen3.5-9B OCR分析中',
  'OCR融合分析中',
  'local-VL文本分析中',
  'Qwen3.5-9B文本分析中',
  'DeepSeek分析中',
  '分析中'
]);

const getLiveStatusFromCandidate = (candidate) => {
  const currentStatus = String(candidate?.status || '');
  const currentMessage = String(candidate?.recommendation || '').trim();

  if (ANALYZING_STATUSES.has(currentStatus)) {
    return {
      state: 'processing',
      title: currentStatus,
      message: currentMessage || '正在进行Qwen3.5-9B分析'
    };
  }

  if (currentStatus === 'local-VL分析超时' || currentStatus === 'Qwen3.5-9B分析超时' || currentStatus === 'VL分析超时' || currentStatus === '分析超时') {
    return {
      state: 'error',
      title: 'Qwen3.5-9B分析超时',
      message: currentMessage || 'Qwen3.5-9B分析超时，请稍后重试'
    };
  }

  return null;
};

const getAnalysisTagColor = (status) => {
  switch (String(status || '')) {
    case 'local-VL排队中':
    case 'Qwen3.5-9B排队中':
      return 'gold';
    case 'local-VL分析准备中':
    case 'Qwen3.5-9B分析准备中':
      return 'blue';
    case 'PDF解析中':
      return 'geekblue';
    case 'local-VL OCR分析中':
    case 'Qwen3.5-9B OCR分析中':
      return 'cyan';
    case 'OCR融合分析中':
      return 'geekblue';
    case 'local-VL文本分析中':
    case 'Qwen3.5-9B文本分析中':
      return 'processing';
    case 'DeepSeek分析中':
      return 'purple';
    case 'local-VL分析超时':
    case 'Qwen3.5-9B分析超时':
    case 'VL分析超时':
    case '分析超时':
      return 'error';
    default:
      return 'processing';
  }
};

const renderTimelineList = (items, renderItem, emptyText) => {
  if (items.length === 0) {
    return (
      <div className="candidate-detail-empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      </div>
    );
  }

  return <div className="candidate-detail-list">{items.map(renderItem)}</div>;
};

const getAnalysisFromCandidate = (candidate) => {
  // 优先使用 resumeAnalysisResult，但需要合并候选人根级别的评分字段
  if (candidate?.resumeAnalysisResult) {
    const analysisResult = candidate.resumeAnalysisResult;
    const normalizedScores = deriveScoreFallbacksFromContent(analysisResult.scores || {}, analysisResult);
    // 确保 scores 对象包含候选人根级别的最新评分
    return {
      ...analysisResult,
      scores: {
        ...analysisResult.scores,
        ...normalizedScores,
        // 使用候选人根级别的评分（优先级最高，因为面试后这些值会更新）
        mbtiScore: candidate.mbtiScore ?? analysisResult.scores?.mbtiScore ?? 0,
        interviewScore: candidate.interviewScore ?? analysisResult.scores?.interviewScore ?? 0,
        hasInterview: candidate.hasInterview ?? analysisResult.scores?.hasInterview ?? false,
        finalScore: candidate.finalScore ?? candidate.matchScore ?? analysisResult.scores?.finalScore ?? 0,
        resumeScore: calculateResumeScore(normalizedScores)
      }
    };
  }

  const legacyAnalysis = candidate?.analysisDetails?.resumeAnalysis || candidate?.resumeAnalysis;
  if (!legacyAnalysis) {
    return null;
  }

  const extractedContent = legacyAnalysis.extractedContent || {};
  const education = extractedContent.education || [];
  const workExperience = extractedContent.workExperience || [];
  const projectExperience = extractedContent.projectExperience || [];
  const campusExperience = extractedContent.campusExperience || [];
  const skills = extractedContent.skills || [];
  const hasContent = education.length > 0 || workExperience.length > 0 || projectExperience.length > 0 || campusExperience.length > 0 || skills.length > 0;

  const skillMatches = legacyAnalysis.skillMatches || [];
  const highlights = legacyAnalysis.highlights || [];
  const interviewSuggestions = legacyAnalysis.interviewSuggestions || legacyAnalysis.interviewQuestions || [];

  const educationScore = Math.min(20, Math.round((legacyAnalysis.educationMatch?.score || 0) * 20));
  const workScore = Math.min(20, Math.round((legacyAnalysis.experienceMatch?.score || 0) * 20));
  const projectScore = Math.min(30, Math.round(skillMatches.length * 5));
  const skillScore = Math.min(25, Math.round(skillMatches.length * 8));
  const expressionScore = Math.min(5, highlights.length > 0 ? 3 : 0);

  const normalizedLegacyScores = deriveScoreFallbacksFromContent({
    educationScore,
    workScore,
    projectScore,
    skillScore,
    expressionScore,
    riskPenalty: 0,
  }, {
    education,
    workExperience,
    projectExperience,
    campusExperience,
    skills,
  });

  return {
    summary: {
      matchLevel: legacyAnalysis.overallScore >= 75 ? 'high' : legacyAnalysis.overallScore >= 60 ? 'medium' : 'low',
      recommendation: legacyAnalysis.overallScore >= 75 ? '强烈推荐' : legacyAnalysis.overallScore >= 60 ? '推荐' : legacyAnalysis.overallScore >= 45 ? '待考虑' : '建议淘汰',
      reasons: highlights.slice(0, 3),
      interviewSuggestions: Array.isArray(interviewSuggestions) ? interviewSuggestions : []
    },
    education: education.map(item => ({
      school: item.school || '未标注',
      major: item.major || '未标注',
      degree: item.degree || '未标注',
      degreeSource: 'unknown',
      degreeLabel: item.degree || '未标注',
      startDate: '未标注',
      endDate: '未标注',
      gpa: '未标注',
      extra: ['暂无额外信息']
    })),
    workExperience: workExperience.map(item => ({
      company: item.company || item.companyOrOrg || '未标注',
      position: item.role || item.position || '未标注',
      startDate: '未标注',
      endDate: '未标注',
      responsibilities: [item.description || item.responsibilities || '暂无详细描述'].filter(Boolean),
      relevance: '待核实'
    })),
    projectExperience: projectExperience.map(item => ({
      projectName: item.projectName || item.name || '未标注',
      role: item.role || '未标注',
      startDate: '未标注',
      endDate: '未标注',
      description: [item.description || '暂无详细描述'].filter(Boolean),
      contribution: [item.responsibilities || item.description || '暂无详细描述'].filter(Boolean),
      relevance: '待核实'
    })),
    campusExperience: campusExperience.map(item => ({
      organization: item.organization || '未标注',
      role: item.role || '未标注',
      startDate: '未标注',
      endDate: '未标注',
      description: [item.description || '暂无详细描述'].filter(Boolean),
      achievements: []
    })),
    skills: {
      coreSkills: [],
      matchedSkills: skillMatches.map(s => s.skill || s).filter(Boolean),
      missingSkills: [],
      bonusSkills: [],
      positionTags: []
    },
    risks: {
      level: 'low',
      items: []
    },
    scores: {
      ...normalizedLegacyScores,
      resumeScore: calculateResumeScore(normalizedLegacyScores),
      mbtiScore: candidate.mbtiScore || 0,
      interviewScore: candidate.interviewScore || 0,
      hasInterview: Boolean(candidate.hasInterview),
      finalScore: candidate.finalScore || candidate.matchScore || 0
    },
    status: {
      state: hasContent ? 'ready' : 'empty',
      title: hasContent ? '简历分析完成' : '暂无有效简历内容',
      message: hasContent ? '已生成结构化解析、岗位匹配与综合评分' : '暂未识别到有效简历内容'
    },
    metadata: {
      analyzedAt: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
      parseStatus: 'SUCCESS',
      position: candidate.position || '',
      hasContent
    },
    extractedContent: {
      education,
      workExperience,
      projectExperience,
      campusExperience,
      skills
    }
  };
};

const buildInterviewPanels = (candidate) => {
  return safeArray(candidate?.interviewRecords).map((record, index) => ({
    key: String(index),
    label: `面试记录 ${index + 1}`,
    children: (
      <div className="candidate-detail-bullet-list">
        {safeArray(record?.conversation?.questions).map((question, qIndex) => (
          <div key={`${index}-${qIndex}`} className="candidate-detail-list-card">
            <Text strong style={{ display: 'block', marginBottom: 8 }}>面试官问题</Text>
            <div className="candidate-detail-summary-text">{question?.question || question || '-'}</div>
            <Text strong style={{ display: 'block', marginTop: 14, marginBottom: 8 }}>候选人回答</Text>
            <div className="candidate-detail-summary-text">
              {record?.conversation?.candidateAnswers?.[qIndex]?.answer || '-'}
            </div>
          </div>
        ))}
      </div>
    )
  }));
};

const CandidateDetailModal = ({ visible, candidate, onClose, onRefreshAnalysis, refreshingAnalysis = false }) => {
  const [selectedAnalysisMode, setSelectedAnalysisMode] = useState('deepseek');

  if (!candidate) return null;

  const liveStatus = getLiveStatusFromCandidate(candidate);
  const analysis = getAnalysisFromCandidate(candidate);

  const isAnalyzing = refreshingAnalysis || liveStatus?.state === 'processing';

  // 计算状态
  const status = analysis?.status || {
    state: 'empty',
    title: '暂无分析结果',
    message: '暂未识别到有效简历内容'
  };

  const summary = analysis?.summary || {};
  const scores = analysis?.scores || {};
  const rawRisks = analysis?.risks || { level: 'low', items: [] };
  const filteredRiskItems = safeArray(rawRisks.items).filter(item => {
    const title = String(item.title || item.message || '').toLowerCase();
    return !title.includes('时间存疑') && !title.includes('时间疑似');
  });
  const risks = { ...rawRisks, items: filteredRiskItems };
  const riskMeta = RISK_LEVEL_META[risks.level] || RISK_LEVEL_META.low;
  const interviewPanels = buildInterviewPanels(candidate);
  const interviewReport = buildInterviewReportViewModel(candidate);
  const hasInterviewReport = candidate.hasInterview && (
    candidate.interviewDetails?.report
    || candidate.interviewDetails?.totalScore != null
    || candidate.interviewDetails?.categoryScores
  );

  // 只有在非分析状态才计算评分和详情
  const scoreBreakdown = !isAnalyzing ? [
    { key: 'educationScore', label: '教育背景', value: scores.educationScore || 0, max: 20 },
    { key: 'workScore', label: '工作经历', value: scores.workScore || 0, max: 20 },
    { key: 'projectScore', label: '项目/活动经历', value: scores.projectScore || 0, max: 30 },
    { key: 'skillScore', label: '技能匹配度', value: scores.skillScore || 0, max: 25 },
    { key: 'expressionScore', label: '表达完整性', value: scores.expressionScore || 0, max: 5 }
  ] : [];

  // 使用统一的计算函数
  const displayedResumeScore = !isAnalyzing ? calculateResumeScore(scores) : 0;
  // 综合评分 = 简历*0.4 + MBTI*0.1 + 面试*0.5
  const computedFinalScore = !isAnalyzing && displayedResumeScore > 0
    ? Math.round(displayedResumeScore * 0.4 + (scores.mbtiScore || 0) * 0.1 + (scores.interviewScore || 0) * 0.5)
    : 0;
  const resumeRecommendationLabel = !isAnalyzing ? getResumeRecommendationLabel(displayedResumeScore) : '';
  const matchMeta = !isAnalyzing ? getResumeMatchMeta(displayedResumeScore) : null;
  const suggestionText = !isAnalyzing ? String(
    candidate.recommendation ||
    summary?.recommendationReason ||
    safeArray(summary.reasons)[0] ||
    ''
  ).trim() : '';
  const interviewSuggestions = !isAnalyzing
    ? (safeArray(summary.interviewSuggestions).length > 0
      ? safeArray(summary.interviewSuggestions)
      : buildFallbackInterviewSuggestions({
          risks,
          scores: { ...scores, resumeScore: displayedResumeScore },
          extractedContent: analysis?.extractedContent || {},
          position: candidate.position
        }))
    : [];

  return (
    <StyledModal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1180}
      destroyOnHidden
      styles={{ body: { padding: 0, maxHeight: '84vh', overflow: 'auto' } }}
    >
      <div className="candidate-detail-modal">
        <section className="candidate-detail-hero">
          <div className="candidate-detail-hero-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Title level={2} className="candidate-detail-hero-name">
                {candidate.name || '未命名候选人'}
              </Title>
              <div className="candidate-detail-hero-tags">
                <Tag color="blue">{formatValue(candidate.position, '未填写职位')}</Tag>
                {!isAnalyzing && !liveStatus && matchMeta && <Tag color={matchMeta.color}>{matchMeta.label}</Tag>}
                {!isAnalyzing && !liveStatus && <Tag color={riskMeta.color}>{riskMeta.label}</Tag>}
                {candidate.mbti && <Tag color="purple">{candidate.mbti}</Tag>}
                {candidate.resumeAnalysisMeta?.cached && <Tag color="cyan">已缓存分析</Tag>}
                {(isAnalyzing || liveStatus) && (
                  <Tag color={getAnalysisTagColor(liveStatus?.title || candidate?.status)}>
                    {liveStatus?.title || candidate?.status || '正在分析中...'}
                  </Tag>
                )}
              </div>
              <div className="candidate-detail-hero-meta">
                <div className="candidate-detail-meta-item">
                  <div className="candidate-detail-meta-label"><PhoneOutlined /> 联系电话</div>
                  <div className="candidate-detail-meta-value">{formatValue(normalizePhoneDisplay(candidate.phone), '未提供')}</div>
                </div>
                <div className="candidate-detail-meta-item">
                  <div className="candidate-detail-meta-label"><MailOutlined /> 邮箱</div>
                  <div className="candidate-detail-meta-value">{formatValue(normalizeEmailDisplay(candidate.email), '未提供')}</div>
                </div>
                <div className="candidate-detail-meta-item">
                  <div className="candidate-detail-meta-label"><FileTextOutlined /> 简历文件</div>
                  <div className="candidate-detail-meta-value">{candidate.name && candidate.position ? `${candidate.name}_${candidate.position}` : (candidate.resumeFileName || '未上传简历')}</div>
                </div>
                <div className="candidate-detail-meta-item">
                  <div className="candidate-detail-meta-label"><BankOutlined /> 提交时间</div>
                  <div className="candidate-detail-meta-value">{formatValue(candidate.submitTime, '未记录')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 正在分析时显示动画进度条，清空原有内容 */}
        {isAnalyzing && (
          <div className="candidate-detail-analysis-block">
            <TechLoadingAnimation mode={selectedAnalysisMode} liveStatus={liveStatus} />
          </div>
        )}

        {/* 非分析状态显示正常内容 */}
        {!isAnalyzing && (
          <>
            <div className="candidate-detail-status-row">
              <Alert
                className="candidate-detail-alert"
                type={status.state === 'error' ? 'error' : status.state === 'empty' ? 'warning' : status.state === 'processing' ? 'info' : 'success'}
                showIcon
                message={status.title}
                description={status.message}
              />
              {suggestionText && (
                <Alert
                  className="candidate-detail-suggestion-alert"
                  type="info"
                  showIcon
                  icon={<BulbOutlined />}
                  message="建议"
                  description={suggestionText}
                />
              )}
            </div>

            <div className="candidate-detail-grid-top">
              <section className="candidate-detail-card candidate-detail-card-attention">
                <div className="candidate-detail-card-header">
                  <div className="candidate-detail-card-title">
                    <SafetyOutlined /> 风险评估
                  </div>
                  <Tag color={riskMeta.color}>{riskMeta.label}</Tag>
                </div>
                {renderTimelineList(
                  safeArray(risks.items),
                  (item, index) => (
                    <div className={`candidate-detail-risk-item ${item.severity || 'low'}`} key={`${item.title}-${index}`}>
                      <div className="candidate-detail-risk-title">
                        <span>{item.title}</span>
                        <Tag color={item.severity === 'high' ? 'error' : item.severity === 'medium' ? 'warning' : 'blue'}>
                          {item.severity === 'high' ? '高' : item.severity === 'medium' ? '中' : '低'}
                        </Tag>
                      </div>
                      {item.suggestion && item.suggestion !== item.title && (
                        <div className="candidate-detail-risk-suggestion">{item.suggestion}</div>
                      )}
                    </div>
                  ),
                  '简历整体良好，未发现明显风险点'
                )}
              </section>

              <section className="candidate-detail-card">
                <div className="candidate-detail-card-header">
                  <div className="candidate-detail-card-title">
                    <TrophyOutlined /> 综合评估
                  </div>
                </div>
                <div className="candidate-detail-score-value" style={{ color: SCORE_COLOR(computedFinalScore || (scores.finalScore ?? candidate.matchScore ?? 0)) }}>
                  {formatScore(computedFinalScore || (scores.finalScore ?? candidate.matchScore))}
                </div>
                {scores.note && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ margin: '16px 0' }}
                    message={scores.note}
                  />
                )}
                <div className="candidate-detail-weight-list">
                  <div className="candidate-detail-weight-item">
                    <span className="candidate-detail-inline-value">简历评分</span>
                    <span className="candidate-detail-inline-value">{formatScore(displayedResumeScore)}</span>
                  </div>
                  <div className="candidate-detail-weight-item">
                    <span className="candidate-detail-inline-value">面试评分</span>
                    <span className="candidate-detail-inline-value">{formatInterviewScore(scores.interviewScore, scores.hasInterview)}</span>
                  </div>
                  <div className="candidate-detail-weight-item">
                    <span className="candidate-detail-inline-value">MBTI 适配度</span>
                    <span className="candidate-detail-inline-value">{formatScore(scores.mbtiScore)}</span>
                  </div>
                </div>
                <Divider style={{ margin: '18px 0 14px' }} />
                <div className="candidate-detail-score-breakdown">
                  {scoreBreakdown.map((item) => (
                    <div key={item.key} className="candidate-detail-score-break-item">
                      <div className="candidate-detail-score-break-label">
                        <span className="candidate-detail-inline-value">{item.label}</span>
                        <span className="candidate-detail-inline-value">{item.value}/{item.max}</span>
                      </div>
                      <Progress
                        percent={Math.round((item.value / item.max) * 100)}
                        showInfo={false}
                        strokeColor={SCORE_COLOR((item.value / item.max) * 100)}
                        trailColor="#eaf0fb"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 面试报告模块 - Premium Design */}
              <section className="interview-report-section">
                {hasInterviewReport ? (
                  <>
                    {/* 报告头部 */}
                    <div className="interview-report-header">
                      <div className="interview-report-title">
                        <div className="interview-report-title-icon">
                          <FileSearchOutlined />
                        </div>
                        <span>面试报告</span>
                      </div>
                      {candidate.interviewDetails?.totalScore != null && (
                        <div className="interview-report-total">
                          <span className="interview-report-total-label">总分</span>
                          <span className="interview-report-total-value" style={{ color: SCORE_COLOR(candidate.interviewDetails.totalScore) }}>
                            {candidate.interviewDetails.totalScore}
                          </span>
                          <span className="interview-report-total-max">/ 100</span>
                        </div>
                      )}
                    </div>

                    {/* 四维度得分网格 */}
                    {candidate.interviewDetails.categoryScores && (
                      <div className="dimension-grid">
                        {[
                          { key: 'iq', label: '智商 IQ', max: 50 },
                          { key: 'eq', label: '情商 EQ', max: 20 },
                          { key: 'aq', label: '逆商 AQ', max: 15 },
                          { key: 'mq', label: '德商 MQ', max: 15 }
                        ].map(dim => {
                          const score = candidate.interviewDetails.categoryScores[dim.key]?.score || 0;
                          const percent = dim.max > 0 ? (score / dim.max) * 100 : 0;
                          return (
                            <div key={dim.key} className="dimension-card" data-dim={dim.key}>
                              <div className="dimension-label">{dim.label}</div>
                              <div className="dimension-score">{score}</div>
                              <div className="dimension-max">/ {dim.max}</div>
                              <div className="dimension-bar">
                                <div className="dimension-bar-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 结构化报告内容 */}
                    <div className="report-content-wrapper">
                      <div className="report-overview-layout">
                        <article className="report-hero-card">
                          <div className="report-hero-eyebrow">AI面试官综合判断</div>
                          <div className="report-hero-title-row">
                            <div className="report-hero-title-icon">
                              <FileTextOutlined />
                            </div>
                            <div>
                              <h3 className="report-hero-title">综合评价</h3>
                              <p className="report-hero-subtitle">结合总分、四维表现与回答细节给出的面试官判断</p>
                            </div>
                          </div>
                          <div className="report-hero-content">
                            {interviewReport.overall.map((line, index) => (
                              <p key={`overall-${index}`} className="report-hero-line">{line}</p>
                            ))}
                          </div>
                        </article>

                        <div className="report-feedback-grid">
                          <article className="report-feedback-card strengths">
                            <div className="report-feedback-header">
                              <div className="report-feedback-icon">
                                <TrophyOutlined />
                              </div>
                              <div>
                                <div className="report-feedback-title">候选人优势</div>
                                <div className="report-feedback-subtitle">面试中体现较稳定的加分项</div>
                              </div>
                            </div>
                            <div className="report-feedback-list">
                              {interviewReport.strengths.map((line, index) => (
                                <div key={`strength-${index}`} className="report-feedback-item">{line}</div>
                              ))}
                            </div>
                          </article>

                          <article className="report-feedback-card improvements">
                            <div className="report-feedback-header">
                              <div className="report-feedback-icon">
                                <BulbOutlined />
                              </div>
                              <div>
                                <div className="report-feedback-title">候选人短板</div>
                                <div className="report-feedback-subtitle">后续复试或录用前应重点确认的风险点</div>
                              </div>
                            </div>
                            <div className="report-feedback-list">
                              {interviewReport.improvements.map((line, index) => (
                                <div key={`improvement-${index}`} className="report-feedback-item">{line}</div>
                              ))}
                            </div>
                          </article>
                        </div>

                        <div className="report-analysis-grid">
                          {interviewReport.dimensionCards.map((card) => (
                            <article key={card.key} className="report-analysis-card" data-type={card.type}>
                              <div className="report-analysis-card-header">
                                <div className="report-analysis-card-icon">{card.icon}</div>
                                <div>
                                  <div className="report-analysis-card-title">{card.label}</div>
                                  <div className="report-analysis-card-score">{card.score}/{INTERVIEW_DIMENSION_META[card.key].max}</div>
                                </div>
                              </div>
                              <div className="report-analysis-card-content">
                                {card.content.map((line, index) => (
                                  <div key={`${card.key}-${index}`} className="report-analysis-line">{line}</div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>

                        <article className="report-recommendation-card">
                          <div className="report-recommendation-header">
                            <div className="report-recommendation-icon">
                              <FileSearchOutlined />
                            </div>
                            <div>
                              <div className="report-recommendation-title">下一步建议</div>
                              <div className="report-recommendation-subtitle">给招聘方的推进建议与关注重点</div>
                            </div>
                          </div>
                          <div className="report-recommendation-content">
                            {interviewReport.recommendationLines.map((line, index) => (
                              <p key={`recommendation-${index}`} className="report-recommendation-line">{line}</p>
                            ))}
                          </div>
                        </article>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="interview-empty-state">
                    <div className="interview-empty-icon">
                      <FileSearchOutlined />
                    </div>
                    <div className="interview-empty-text">该应聘者还未面试</div>
                    <div className="interview-empty-sub">完成面试后将在此显示详细报告</div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {!isAnalyzing && candidate.hasInterview && interviewPanels.length > 0 && (
          <section className="candidate-detail-card candidate-detail-interview">
            <div className="candidate-detail-card-header">
              <div className="candidate-detail-card-title">
                <FileTextOutlined /> 面试记录
              </div>
            </div>
            <Collapse items={interviewPanels} bordered={false} />
          </section>
        )}

        {/* AI面试评分 */}
        {!isAnalyzing && candidate.interviewDetails && candidate.interviewDetails.questionScores && candidate.interviewDetails.questionScores.length > 0 && (
          <section className="candidate-detail-card candidate-detail-ai-scores">
            <div className="candidate-detail-card-header">
              <div className="candidate-detail-card-title">
                <BulbOutlined /> AI面试评分
              </div>
              <div className="ai-total-score">
                总分: <span style={{ color: SCORE_COLOR(candidate.interviewDetails.totalScore) }}>{candidate.interviewDetails.totalScore}</span>/100
              </div>
            </div>
            {/* 四维度得分概览 */}
            {candidate.interviewDetails.categoryScores && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { key: 'iq', label: '智商IQ', max: 50 },
                  { key: 'eq', label: '情商EQ', max: 20 },
                  { key: 'aq', label: '逆商AQ', max: 15 },
                  { key: 'mq', label: '德商MQ', max: 15 }
                ].map(dim => {
                  const score = candidate.interviewDetails.categoryScores[dim.key]?.score || 0;
                  return (
                    <div key={dim.key} style={{ textAlign: 'center', padding: '10px 8px', background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{dim.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: SCORE_COLOR(score / dim.max * 100) }}>{score}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>/ {dim.max}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* P0改进：8维度详细评分展示 */}
            {candidate.interviewDetails.evaluationScores && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3f', marginBottom: 12 }}>8维度详细评分</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { key: 'relevance', label: '相关性', color: '#1890ff' },
                    { key: 'depth', label: '深度', color: '#52c41a' },
                    { key: 'clarity', label: '清晰度', color: '#faad14' },
                    { key: 'professionalism', label: '专业性', color: '#722ed1' },
                    { key: 'evidence', label: '证据性', color: '#eb2f96' },
                    { key: 'actionability', label: '可执行性', color: '#13c2c2' },
                    { key: 'selfAwareness', label: '自我认知', color: '#fa8c16' },
                    { key: 'growthMindset', label: '成长思维', color: '#2f54eb' }
                  ].map(dim => {
                    const score = candidate.interviewDetails.evaluationScores[dim.key] || 5;
                    const percentage = score * 10;
                    return (
                      <div key={dim.key} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{dim.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: dim.color }}>{score}</div>
                        <div style={{ marginTop: 4, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: dim.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="interview-analysis-section">
              {candidate.interviewDetails.questionScores.map((q, i) => {
                // 根据题目索引判断所属维度
                const dimLabel = i < 3 ? 'IQ' : i < 6 ? 'EQ' : i < 9 ? 'AQ' : 'MQ';
                const dimColor = i < 3 ? '#2F80ED' : i < 6 ? '#10B981' : i < 9 ? '#F59E0B' : '#8B5CF6';
                return (
                  <div key={i} className="question-score-item">
                    <div className="question-score-header">
                      <span className="question-index">Q{i + 1}</span>
                      <Tag color={dimColor} style={{ marginLeft: 4, marginRight: 8 }}>{dimLabel}</Tag>
                      <span className="question-text">{q.question}</span>
                    </div>
                    <div className="question-score-answer">
                      <Text type="secondary" style={{ fontSize: 12 }}>回答:</Text>
                      <span className="answer-text">{q.answer || '-'}</span>
                    </div>
                    {/* P0改进：显示8维度评分 */}
                    <div className="score-details">
                      <span className="score-item"><Text type="secondary">相关性:</Text> {q.relevance}</span>
                      <span className="score-item"><Text type="secondary">深度:</Text> {q.depth}</span>
                      <span className="score-item"><Text type="secondary">清晰:</Text> {q.clarity}</span>
                      <span className="score-item"><Text type="secondary">专业性:</Text> {q.professionalism || q.completeness || '-'}</span>
                      {/* 新增维度 */}
                      {q.evidence !== undefined && <span className="score-item"><Text type="secondary">证据性:</Text> {q.evidence}</span>}
                      {q.actionability !== undefined && <span className="score-item"><Text type="secondary">可执行:</Text> {q.actionability}</span>}
                      {q.selfAwareness !== undefined && <span className="score-item"><Text type="secondary">自我认知:</Text> {q.selfAwareness}</span>}
                      {q.growthMindset !== undefined && <span className="score-item"><Text type="secondary">成长思维:</Text> {q.growthMindset}</span>}
                    </div>
                    {q.comment && <div className="question-comment">{q.comment}</div>}
                  </div>
                );
              })}
              {candidate.interviewDetails.summary && (
                <div className="interview-summary">
                  <Text strong style={{ fontSize: 13, color: '#1a2a3f' }}>整体评价:</Text>
                  <div className="summary-text">{candidate.interviewDetails.summary}</div>
                </div>
              )}
            </div>
          </section>
        )}

        {onRefreshAnalysis && (
          <div className="candidate-detail-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, color: '#6B7280' }}>分析模式：</Text>
                <Select
                  value={selectedAnalysisMode}
                  onChange={setSelectedAnalysisMode}
                  style={{ width: 180 }}
                  disabled={refreshingAnalysis}
                  options={[
                    { value: 'default', label: '默认模式（推荐）' },
                    { value: 'local-vl', label: 'Qwen3.5-9B多模态模型' },
                    { value: 'deepseek', label: 'DeepSeek API' }
                  ]}
                />
              </div>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={refreshingAnalysis}
                onClick={() => onRefreshAnalysis(candidate, selectedAnalysisMode)}
                style={{ height: 42, borderRadius: 12, background: '#2F80ED', borderColor: '#2F80ED', boxShadow: '0 8px 18px rgba(47,128,237,0.22)' }}
              >
                重新分析简历
              </Button>
            </div>
          </div>
        )}
      </div>
    </StyledModal>
  );
};

export default CandidateDetailModal;
