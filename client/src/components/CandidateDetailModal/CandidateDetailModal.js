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
import AnalysisLoadingProgress from './LoadingAnimation';
import './CandidateDetailModal.css';

const { Title, Text } = Typography;

import { colors } from '../../../theme/colors';

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
    // 确保 scores 对象包含候选人根级别的最新评分
    return {
      ...analysisResult,
      scores: {
        ...analysisResult.scores,
        // 使用候选人根级别的评分（优先级最高，因为面试后这些值会更新）
        mbtiScore: candidate.mbtiScore ?? analysisResult.scores?.mbtiScore ?? 0,
        interviewScore: candidate.interviewScore ?? analysisResult.scores?.interviewScore ?? 0,
        hasInterview: candidate.hasInterview ?? analysisResult.scores?.hasInterview ?? false,
        finalScore: candidate.finalScore ?? candidate.matchScore ?? analysisResult.scores?.finalScore ?? 0
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
      educationScore,
      workScore,
      projectScore,
      skillScore,
      expressionScore,
      riskPenalty: 0,
      resumeScore: educationScore + workScore + projectScore + skillScore + expressionScore,
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
  const [selectedAnalysisMode, setSelectedAnalysisMode] = useState('default');

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
      destroyOnClose
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
            <AnalysisLoadingProgress mode={selectedAnalysisMode} liveStatus={liveStatus} />
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
                <div className="candidate-detail-score-value" style={{ color: SCORE_COLOR(scores.finalScore ?? candidate.matchScore ?? 0) }}>
                  {formatScore(scores.finalScore ?? candidate.matchScore)}
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

              <section className="candidate-detail-card">
                <div className="candidate-detail-card-header">
                  <div className="candidate-detail-card-title">
                    <FileSearchOutlined /> 面试报告
                  </div>
                </div>
                {candidate.hasInterview && candidate.interviewDetails?.report ? (
                  <div className="candidate-detail-reason-list">
                    <div className="candidate-detail-reason-item" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                      {candidate.interviewDetails.report}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#9CA3AF', padding: '16px 0', textAlign: 'center' }}>
                    该应聘者还未面试
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
