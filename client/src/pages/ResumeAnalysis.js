import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Progress,
  Modal,
  Descriptions,
  Divider,
  message,
  Input,
  Select,
  DatePicker
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TrophyOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
  FilterOutlined,
  QrcodeOutlined,
  UpOutlined,
  DownOutlined,
  SwapOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  SolutionOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import candidateDB from '../utils/candidateDB';
import serverDataSync from '../utils/serverDataSync';
import axios from 'axios';
import resumeAnalyzerHelper from '../utils/resumeAnalyzer';
import { getCandidateStats } from '../utils/candidateStats';
import CandidateDetailModal from '../components/CandidateDetailModal';
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const getNumericScoreValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * 计算简历评分（细则评分之和）
 * 统一使用此函数，确保表格和详情页一致
 */
export const calculateResumeScore = (scores) => {
  if (!scores) return 0;
  return getNumericScoreValue(scores.educationScore) +
    getNumericScoreValue(scores.workScore) +
    getNumericScoreValue(scores.projectScore) +
    getNumericScoreValue(scores.skillScore) +
    getNumericScoreValue(scores.expressionScore);
};

/**
 * 从候选人记录获取简历评分
 */
export const getResumeScoreFromRecord = (record) => {
  const scores = record?.resumeAnalysisResult?.scores;
  return calculateResumeScore(scores);
};

const getResumeScoreBreakdownTotalFromRecord = (record) => {
  const score = getResumeScoreFromRecord(record);
  return score > 0 ? score : null;
};

const getResumeScoreValueFromRecord = (record) => {
  const breakdownTotal = getResumeScoreBreakdownTotalFromRecord(record);
  if (breakdownTotal !== null) {
    return breakdownTotal;
  }

  return getNumericScoreValue(
    record?.resumeScore ??
    record?.resumeAnalysis?.totalScore ??
    record?.analysisDetails?.resumeScore ??
    record?.analysisDetails?.resumeAnalysis?.overallScore
  );
};

const getRecommendationLabelFromResumeScore = (resumeScore) => {
  if (resumeScore >= 75) return '强烈推荐';
  if (resumeScore >= 60) return '推荐';
  if (resumeScore >= 45) return '待考虑';
  return '建议淘汰';
};

const getRecommendationLabelFromRecord = (record) => {
  const explicitRecommendation = String(
    record?.resumeAnalysisResult?.summary?.recommendation ||
    record?.resumeAnalysis?.recommendation?.level ||
    ''
  ).trim();

  if (explicitRecommendation) {
    return explicitRecommendation;
  }

  return getRecommendationLabelFromResumeScore(
    getResumeScoreValueFromRecord(record)
  );
};

const getCompositeScoreValueFromRecord = (record) => getNumericScoreValue(record?.matchScore);

const getCandidateSearchText = (record) => [
  record?.name,
  record?.phone,
  record?.email,
  record?.position,
  record?.resumeFileName
]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

const normalizeResumeAnalysis = (rawAnalysis) => {
  if (!rawAnalysis) return null;
  if (rawAnalysis.totalScore !== undefined && rawAnalysis.parseStatus !== undefined) {
    const normalizeArray = (arr) => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return item.message || item.description || item.text || JSON.stringify(item);
        return String(item);
      });
    };
    const extracted = rawAnalysis.extractedContent || {};
    const basicInfo = extracted.basicInfo || { name: '', phone: '', email: '' };
    const education = extracted.education || [];
    const workExperience = extracted.workExperience || [];
    const projectExperience = extracted.projectExperience || [];
    const skills = extracted.skills || [];
    const evaluation = extracted.evaluation || '';
    const filteredBasicInfo = {};
    if (basicInfo.name) filteredBasicInfo['姓名'] = basicInfo.name;
    if (basicInfo.phone) filteredBasicInfo['电话'] = basicInfo.phone;
    if (basicInfo.email) filteredBasicInfo['邮箱'] = basicInfo.email;
    if (basicInfo.age) filteredBasicInfo['年龄'] = basicInfo.age;
    if (basicInfo.gender) filteredBasicInfo['性别'] = basicInfo.gender;
    if (basicInfo.location) filteredBasicInfo['所在地'] = basicInfo.location;
    return {
      ...rawAnalysis,
      overallScore: Math.round(rawAnalysis.totalScore / 4),
      skillMatches: rawAnalysis.matchResult?.matchedSkills?.map(s => ({
        skill: s.skill,
        type: s.category || 'core',
        score: s.score || 3,
        description: s.description || ''
      })) || [],
      educationMatch: rawAnalysis.dimensionScores?.education?.score > 10,
      experienceMatch: rawAnalysis.dimensionScores?.experience?.score > 10,
      highlights: normalizeArray(rawAnalysis.strengths),
      recommendations: normalizeArray(rawAnalysis.suggestions),
      strengths: normalizeArray(rawAnalysis.strengths),
      suggestions: normalizeArray(rawAnalysis.suggestions),
      abilityAnalysis: [],
      projectAnalysis: [],
      detailedAnalysis: {
        contentAnalysis: {
          overallQuality: rawAnalysis.totalScore >= 70 ? '优秀' : rawAnalysis.totalScore >= 50 ? '良好' : '一般'
        }
      },
      extractedContent: {
        personalInfo: filteredBasicInfo,
        education: education,
        workExperience: workExperience,
        projects: projectExperience,
        skills: skills,
        achievements: [],
        keyPhrases: [],
        evaluation: evaluation
      }
    };
  }
  return rawAnalysis;
};

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
  cyan: '#06B6D4'
};

const AnalysisContainer = styled.div`
  min-height: 100%;
  background: ${colors.background};
  padding: 32px;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
  
  h2 {
    color: ${colors.title};
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  
  .subtitle {
    color: ${colors.muted};
    font-size: 15px;
  }
`;

const StatCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  }
  
  .ant-statistic-title {
    color: ${colors.muted};
    font-size: 14px;
    font-weight: 500;
  }
  .ant-statistic-content {
    color: ${colors.primary};
    font-weight: 600;
  }
`;

const ContentCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
  
  .ant-card-body {
    padding: 24px;
  }
`;

const InfoBanner = styled.div`
  padding: 16px 20px;
  background: ${colors.primaryLight};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  margin-bottom: 16px;
  
  .banner-title {
    color: ${colors.title};
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .banner-desc {
    color: ${colors.muted};
    font-size: 13px;
  }
`;

const StatusBanner = styled.div`
  padding: 16px 20px;
  background: ${props => props.$hasData ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.06)'};
  border: 1px solid ${props => props.$hasData ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)'};
  border-radius: 12px;
  margin-bottom: 20px;
  
  .status-title {
    color: ${props => props.$hasData ? colors.success : colors.danger};
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .status-desc {
    color: ${colors.muted};
    font-size: 13px;
  }
`;

const PrimaryButton = styled(Button)`
  && {
    height: 44px;
    border-radius: 10px;
    font-weight: 500;
    background: ${colors.primary};
    border-color: ${colors.primary};
    box-shadow: 0 4px 12px rgba(47, 128, 237, 0.25);
    transition: all 0.2s ease;
    
    &:hover {
      background: ${colors.primaryHover};
      border-color: ${colors.primaryHover};
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(47, 128, 237, 0.35);
    }
  }
`;

const SecondaryButton = styled(Button)`
  && {
    height: 44px;
    border-radius: 10px;
    font-weight: 500;
    border: 1px solid ${colors.border};
    color: ${colors.text};
    background: ${colors.cardBg};
    transition: all 0.2s ease;
    
    &:hover {
      border-color: ${colors.primary};
      color: ${colors.primary};
      background: ${colors.primaryLight};
    }
  }
`;

const FilterCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
  
  .ant-card-body {
    padding: 20px 24px;
  }
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const StyledInput = styled(Input)`
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  padding: 0 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  
  &:hover, &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primaryLight};
  }
  
  .ant-input {
    height: 42px;
    line-height: 42px;
  }
`;

const StyledSelect = styled(Select)`
  .ant-select-selector {
    height: 40px !important;
    border-radius: 10px !important;
    border: 1px solid ${colors.border} !important;
    padding: 0 12px !important;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  }
  
  .ant-select-selection-item {
    line-height: 38px !important;
  }
  
  .ant-select-selection-placeholder {
    line-height: 38px !important;
    color: ${colors.muted} !important;
    opacity: 0.6;
  }
  
  &:hover .ant-select-selector {
    border-color: ${colors.primary} !important;
  }
`;

const StyledRangePicker = styled(RangePicker)`
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  padding: 0 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  
  &:hover, &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primaryLight};
  }
  
  .ant-picker-input {
    height: 42px;
    display: flex;
    align-items: center;
  }
  
  input {
    height: 42px;
    line-height: 42px;
  }
`;

const TableCard = styled(Card)`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  
  .ant-card-body {
    padding: 0;
  }
  
  .ant-table-thead > tr > th {
    background: ${colors.background};
    border-bottom: 1px solid ${colors.divider};
    color: ${colors.muted};
    font-weight: 500;
    font-size: 12px;
    padding: 14px 16px;
    letter-spacing: 0.3px;
    text-align: center;
    
    &::before {
      display: none;
    }
  }
  
  .ant-table-tbody > tr > td {
    padding: 16px;
    border-bottom: 1px solid ${colors.divider};
    transition: all 0.2s ease;
    text-align: center;
    vertical-align: middle;
  }
  
  .ant-table-tbody > tr:hover > td {
    background: rgba(47, 128, 237, 0.02);
  }
  
  .ant-table-tbody > tr:last-child > td {
    border-bottom: none;
  }
  
  .ant-pagination {
    padding: 12px 16px;
    margin: 0;
    border-top: 1px solid ${colors.divider};
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ant-pagination-item {
    border-radius: 6px;
    border: 1px solid ${colors.border};
    min-width: 28px;
    height: 28px;
    line-height: 26px;

    &:hover {
      border-color: ${colors.primary};

      a {
        color: ${colors.primary};
      }
    }
  }

  .ant-pagination-item-active {
    border-color: ${colors.primary};
    background: ${colors.primary};

    a {
      color: white;
    }
  }

  .ant-pagination-options {
    display: flex;
    align-items: center;
    height: 28px;

    .ant-select {
      height: 28px;
    }

    .ant-select-selector {
      height: 28px !important;
      border-radius: 6px !important;
      font-size: 13px !important;
      padding: 0 8px !important;
    }

    .ant-select-selection-item {
      line-height: 26px !important;
    }
  }

  .ant-pagination-options-quick-jumper {
    height: 28px;
    line-height: 28px;
    font-size: 13px;
    margin-left: 8px;
    display: flex;
    align-items: center;

    input {
      height: 26px !important;
      width: 40px !important;
      border-radius: 6px !important;
      margin: 0 4px;
      padding: 0 6px;
      font-size: 13px;
      line-height: 24px;
    }
  }
`;

// 多列排序表头样式
const SortableHeaderCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  width: 100%;
  
  &:hover {
    color: ${colors.primary};
  }
`;

const SortIconWrapper = styled.span`
  display: inline-flex;
  flex-direction: column;
  margin-left: 6px;
  font-size: 10px;
  line-height: 1;
  opacity: ${props => props.$active ? 1 : 0.3};
  transition: opacity 0.2s ease;
  
  .anticon {
    font-size: 10px;
    height: 8px;
    color: ${props => props.$active ? colors.primary : colors.muted};
  }
`;

const SortOrderBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: ${colors.primary};
  border-radius: 50%;
`;

const SortIndicator = styled.div`
  display: flex;
  align-items: center;
  margin-left: 4px;
`;

const MultiSortHint = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 16px;
  background: ${colors.primaryLight};
  border-radius: 8px;
  font-size: 13px;
  color: ${colors.text};
  
  .hint-icon {
    color: ${colors.primary};
  }
  
  .clear-btn {
    margin-left: auto;
    color: ${colors.primary};
    cursor: pointer;
    font-weight: 500;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const ActionButton = styled(Button)`
  && {
    height: auto;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 13px;
    border: none;
    background: transparent;
    color: ${colors.muted};
    transition: all 0.2s ease;
    
    &:hover {
      background: ${colors.primaryLight};
      color: ${colors.primary};
    }
    
    &.danger:hover {
      background: rgba(239, 68, 68, 0.08);
      color: ${colors.danger};
    }
    
    &.primary-action {
      background: ${colors.primaryLight};
      color: ${colors.primary};
      font-weight: 500;
      
      &:hover {
        background: ${colors.primary};
        color: white;
      }
    }
  }
`;

const NameCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  
  .name-icon {
    font-size: 16px;
    color: ${colors.primary};
  }
  
  .name-text {
    font-weight: 600;
    color: ${colors.title};
    font-size: 14px;
    letter-spacing: -0.2px;
  }
`;

const CenterCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
`;

const ScoreCircle = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${props => `rgba(${props.$color}, 0.1)`};
  color: ${props => props.$color};
  font-weight: 600;
  font-size: 13px;
  border: 2px solid ${props => props.$color};
`;

const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
`;

const SmallButton = styled(Button)`
  padding: 2px 8px;
  height: 24px;
  font-size: 12px;
  line-height: 1;
  border-radius: 4px;

  &.danger {
    color: #ff4d4f;
    border-color: #ff4d4f;

    &:hover {
      color: #ff7875;
      border-color: #ff7875;
    }
  }
`;

// 状态徽章系统
const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch(props.$type) {
      case 'submitted': return 'rgba(16, 185, 129, 0.08)';
      case 'analyzing': return 'rgba(47, 128, 237, 0.08)';
      case 'analyzed': return 'rgba(16, 185, 129, 0.08)';
      case 'timeout': return 'rgba(239, 68, 68, 0.08)';
      // 细化状态颜色
      case 'queuing': return 'rgba(245, 158, 11, 0.1)';      // local-VL排队中 - 金色
      case 'preparing': return 'rgba(47, 128, 237, 0.08)';   // 准备中 - 蓝色
      case 'pdf-parsing': return 'rgba(79, 70, 229, 0.1)';   // PDF解析中 - 靛蓝色
      case 'vl-ocr': return 'rgba(6, 182, 212, 0.1)';        // VL OCR分析中 - 青色
      case 'ocr-fusion': return 'rgba(20, 184, 166, 0.1)';   // OCR融合分析中 - 青绿色
      case 'vl-text': return 'rgba(37, 99, 235, 0.1)';       // VL文本分析中 - 蓝色
      case 'deepseek': return 'rgba(139, 92, 246, 0.1)';     // DeepSeek分析中 - 紫色
      case 'pending': return 'rgba(251, 146, 60, 0.1)';      // 待分析 - 橙色
      default: return 'rgba(100, 116, 139, 0.08)';
    }
  }};
  color: ${props => {
    switch(props.$type) {
      case 'submitted': return '#16A34A';
      case 'analyzing': return '#2563EB';
      case 'analyzed': return '#16A34A';
      case 'timeout': return '#DC2626';
      // 细化状态颜色
      case 'queuing': return '#D97706';      // local-VL排队中 - 金色
      case 'preparing': return '#2563EB';    // 准备中 - 蓝色
      case 'pdf-parsing': return '#4F46E5';  // PDF解析中 - 靛蓝色
      case 'vl-ocr': return '#0891B2';       // VL OCR分析中 - 青色
      case 'ocr-fusion': return '#0D9488';   // OCR融合分析中 - 青绿色
      case 'vl-text': return '#2563EB';      // VL文本分析中 - 蓝色
      case 'deepseek': return '#7C3AED';     // DeepSeek分析中 - 紫色
      case 'pending': return '#EA580C';      // 待分析 - 橙色
      default: return '#64748B';
    }
  }};
`;

// 统一的标签样式
const UnifiedTag = styled(Tag)`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
  border: none;
  margin: 0;
  
  &.ant-tag-blue {
    background: rgba(37, 99, 235, 0.08);
    color: #2563EB;
  }
  
  &.ant-tag-purple {
    background: rgba(139, 92, 246, 0.08);
    color: #7C3AED;
  }
  
  &.ant-tag-green {
    background: rgba(16, 185, 129, 0.08);
    color: #16A34A;
  }
  
  &.ant-tag-orange {
    background: rgba(245, 158, 11, 0.08);
    color: #D97706;
  }
  
  &.ant-tag-red {
    background: rgba(239, 68, 68, 0.08);
    color: #DC2626;
  }
  
  &.ant-tag-default {
    background: rgba(100, 116, 139, 0.08);
    color: #64748B;
  }
`;

// 职位标签
const PositionTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(37, 99, 235, 0.08);
  color: #2563EB;
`;

// MBTI标签
const MBTITag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(139, 92, 246, 0.08);
  color: #7C3AED;
`;

// 推荐等级标签
const RecommendationTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch(props.$level) {
      case '强烈推荐': return 'rgba(16, 185, 129, 0.08)';
      case '推荐': return 'rgba(37, 99, 235, 0.08)';
      case '待考虑': return 'rgba(245, 158, 11, 0.08)';
      default: return 'rgba(100, 116, 139, 0.08)';
    }
  }};
  color: ${props => {
    switch(props.$level) {
      case '强烈推荐': return '#16A34A';
      case '推荐': return '#2563EB';
      case '待考虑': return '#D97706';
      default: return '#64748B';
    }
  }};
`;

// 文件名显示
const FileNameText = styled.span`
  font-size: 12px;
  color: ${colors.muted};
  background: ${colors.background};
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  cursor: default;
`;

// 时间文本
const TimeText = styled.span`
  font-size: 13px;
  color: ${colors.muted};
`;

// ========== 弹窗样式组件 ==========
const ModalHeaderCard = styled.div`
  background: linear-gradient(135deg, #2F80ED 0%, #1C5FD4 100%);
  border-radius: 16px;
  padding: 28px 32px;
  margin-bottom: 24px;
  color: white;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 200px;
    height: 200px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -10%;
    width: 150px;
    height: 150px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 50%;
  }
`;
const ModalHeaderName = styled.div`
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
`;
const ModalHeaderTags = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;
const ModalHeaderTag = styled.span`
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.3);
`;
const ModalHeaderContact = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.85;
`;
const ModalSection = styled.div`
  margin-bottom: 24px;
`;
const ModalSectionTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${colors.title};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  &::before {
    content: '';
    width: 4px;
    height: 18px;
    background: linear-gradient(180deg, #2F80ED 0%, #1C5FD4 100%);
    border-radius: 2px;
  }
`;
const MatchScoreCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  }
`;
const MatchScoreNumber = styled.div`
  font-size: 48px;
  font-weight: 700;
  color: ${props => props.$color || colors.primary};
  line-height: 1;
  margin-bottom: 8px;
`;
const MatchScoreLabel = styled.div`
  font-size: 13px;
  color: ${colors.muted};
  font-weight: 500;
`;
const MatchScoreBar = styled.div`
  margin-top: 16px;
  height: 8px;
  background: ${colors.background};
  border-radius: 4px;
  overflow: hidden;
  & > div {
    height: 100%;
    background: linear-gradient(90deg, #2F80ED 0%, #1C5FD4 100%);
    border-radius: 4px;
    transition: width 0.5s ease;
  }
`;
const SmallMatchCard = styled.div`
  background: ${colors.background};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 16px;
  text-align: center;
`;
const SmallMatchNumber = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.$color || colors.primary};
`;
const SmallMatchLabel = styled.div`
  font-size: 12px;
  color: ${colors.muted};
  margin-top: 4px;
`;
const EmptyAnalysisCard = styled.div`
  background: ${colors.background};
  border: 2px dashed ${colors.border};
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
`;
const EmptyAnalysisIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;
const EmptyAnalysisText = styled.div`
  font-size: 14px;
  color: ${colors.muted};
  margin-bottom: 20px;
`;
const RecommendationCard = styled.div`
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 16px;
  padding: 20px 24px;
`;
const RecommendationTitle = styled.div`
  font-size: 13px;
  color: ${colors.success};
  font-weight: 600;
  margin-bottom: 12px;
`;
const RecommendationTags = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;
const RecommendationBadge = styled.span`
  background: rgba(16, 185, 129, 0.12);
  color: ${colors.success};
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
`;
const DetailAnalysisCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 24px;
  line-height: 1.8;
  color: ${colors.text};
  font-size: 14px;
`;
const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;
const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const InfoLabel = styled.span`
  font-size: 12px;
  color: ${colors.muted};
  font-weight: 500;
`;
const InfoValue = styled.span`
  font-size: 14px;
  color: ${colors.title};
  font-weight: 500;
`;
const PreviewHeaderCard = styled.div`
  background: linear-gradient(135deg, #2F80ED 0%, #1C5FD4 100%);
  border-radius: 16px;
  padding: 24px 28px;
  margin-bottom: 24px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
const PreviewHeaderLeft = styled.div``;
const PreviewHeaderName = styled.div`
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
`;
const PreviewHeaderTags = styled.div`
  display: flex;
  gap: 8px;
`;
const PreviewHeaderRight = styled.div`
  text-align: right;
  font-size: 12px;
  opacity: 0.8;
`;
const PreviewSectionCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
`;
const PreviewSectionTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${colors.title};
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.divider};
`;
const MatchEvalCard = styled.div`
  background: linear-gradient(135deg, rgba(47, 128, 237, 0.08) 0%, rgba(28, 95, 212, 0.05) 100%);
  border: 1px solid rgba(47, 128, 237, 0.2);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 32px;
  margin-bottom: 20px;
  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
  }
`;
const MatchEvalScore = styled.div`
  flex-shrink: 0;
`;
const MatchEvalContent = styled.div`
  flex: 1;
`;
const MatchEvalReasons = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
`;
const AnalysisSummaryCard = styled.div`
  background: ${colors.background};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
`;
const AnalysisSummaryTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${colors.title};
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;
const AnalysisSummaryContent = styled.div`
  font-size: 13px;
  color: ${colors.text};
  line-height: 1.6;
`;
const SkillTagGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;
const SkillTag = styled.span`
  background: ${props => {
    if (props.$type === 'danger') return 'rgba(239, 68, 68, 0.1)';
    if (props.$type === 'warning') return 'rgba(245, 158, 11, 0.1)';
    if (props.$type === 'core') return 'rgba(37, 99, 235, 0.08)';
    return 'rgba(16, 185, 129, 0.08)';
  }};
  color: ${props => {
    if (props.$type === 'danger') return '#DC2626';
    if (props.$type === 'warning') return '#D97706';
    if (props.$type === 'core') return '#2563EB';
    return '#16A34A';
  }};
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  border: ${props => {
    if (props.$type === 'danger') return '1px solid rgba(239, 68, 68, 0.3)';
    if (props.$type === 'warning') return '1px solid rgba(245, 158, 11, 0.3)';
    return 'none';
  }};
`;
const HighlightList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;
const HighlightItem = styled.li`
  padding: 10px 0;
  border-bottom: 1px solid ${colors.divider};
  font-size: 13px;
  color: ${colors.text};
  display: flex;
  align-items: flex-start;
  gap: 8px;
  &:last-child {
    border-bottom: none;
  }
`;
const HighlightIcon = styled.span`
  color: ${colors.success};
  font-size: 14px;
  flex-shrink: 0;
`;
const ActionButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
`;
const GradientButton = styled(Button)`
  && {
    height: 44px;
    border-radius: 10px;
    font-weight: 500;
    background: linear-gradient(135deg, #2F80ED 0%, #1C5FD4 100%);
    border: none;
    color: white;
    box-shadow: 0 4px 12px rgba(47, 128, 237, 0.3);
    transition: all 0.2s ease;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(47, 128, 237, 0.4);
      background: linear-gradient(135deg, #3B8FF5 0%, #2A6FE0 100%);
    }
  }
`;
const OutlineButton = styled(Button)`
  && {
    height: 44px;
    border-radius: 10px;
    font-weight: 500;
    border: 1px solid ${colors.border};
    color: ${colors.text};
    background: ${colors.cardBg};
    transition: all 0.2s ease;
    &:hover {
      border-color: ${colors.primary};
      color: ${colors.primary};
      background: ${colors.primaryLight};
    }
  }
`;
const InterviewRecordCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
`;
const InterviewQuestionBox = styled.div`
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
`;
const InterviewAnswerBox = styled.div`
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
`;
const InterviewAIBox = styled.div`
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 12px;
  padding: 16px;
`;
const InterviewLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;
const ModalContentWrapper = styled.div`
  max-height: 75vh;
  overflow-y: auto;
  padding-right: 0;
  background: #F8F9FB;
  border-radius: 12px;
  &::-webkit-scrollbar {
    width: 0;
    display: none;
  }
  scrollbar-width: none;
  -ms-overflow-style: none;
`;
const StyledModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.12);
    background: #F8F9FB;
  }
  .ant-modal-header {
    border-bottom: none;
    padding: 24px 32px 0;
    background: #F8F9FB;
  }
  .ant-modal-title {
    font-size: 18px;
    font-weight: 600;
    color: ${colors.title};
  }
  .ant-modal-body {
    padding: 16px 32px 32px;
    background: #F8F9FB;
  }
  .ant-modal-close {
    top: 20px;
    right: 24px;
  }
  .ant-modal-close-x {
    width: 36px;
    height: 36px;
    line-height: 36px;
    font-size: 16px;
    border-radius: 50%;
    transition: all 0.2s ease;
    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  }
`;
const DetailCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;
const DetailCardTitle = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #6B7280;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const DetailCardContent = styled.div`
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
`;
const DetailRow = styled.div`
  display: flex;
  margin-bottom: 8px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const DetailLabel = styled.span`
  font-size: 13px;
  color: #9CA3AF;
  min-width: 80px;
  flex-shrink: 0;
`;
const DetailValue = styled.span`
  font-size: 14px;
  color: ${colors.title};
  font-weight: 500;
`;
const TimelineContainer = styled.div`
  position: relative;
  padding-left: 24px;
  &::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: #E5E7EB;
    border-radius: 1px;
  }
`;
const TimelineItem = styled.div`
  position: relative;
  padding-bottom: 20px;
  &:last-child {
    padding-bottom: 0;
  }
  &::before {
    content: '';
    position: absolute;
    left: -20px;
    top: 6px;
    width: 10px;
    height: 10px;
    background: white;
    border: 2px solid #3B82F6;
    border-radius: 50%;
  }
`;
const TimelineTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${colors.title};
  margin-bottom: 4px;
`;
const TimelineMeta = styled.div`
  font-size: 12px;
  color: #9CA3AF;
  margin-bottom: 6px;
`;
const TimelineDesc = styled.div`
  font-size: 13px;
  color: ${colors.text};
  line-height: 1.6;
  padding: 10px 12px;
  background: #F9FAFB;
  border-radius: 8px;
  margin-top: 8px;
`;
const SkillTagContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;
const SkillTagItem = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  background: ${props => {
    if (props.$type === 'core') return 'rgba(59, 130, 246, 0.08)';
    if (props.$type === 'business') return 'rgba(16, 185, 129, 0.08)';
    return 'rgba(139, 92, 246, 0.08)';
  }};
  color: ${props => {
    if (props.$type === 'core') return '#2563EB';
    if (props.$type === 'business') return '#059669';
    return '#7C3AED';
  }};
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;
const RiskWarningBar = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 10px;
  margin-bottom: 16px;
`;
const RiskWarningIcon = styled.span`
  font-size: 16px;
  flex-shrink: 0;
`;
const RiskWarningContent = styled.div`
  flex: 1;
`;
const RiskWarningTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #B45309;
  margin-bottom: 4px;
`;
const RiskWarningText = styled.div`
  font-size: 12px;
  color: #92400E;
  line-height: 1.5;
`;
const ScoreCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
`;
const ScoreNumber = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.$color || '#3B82F6'};
  line-height: 1;
  margin-bottom: 6px;
`;
const ScoreLabel = styled.div`
  font-size: 12px;
  color: #6B7280;
  font-weight: 500;
`;
const HeaderCard = styled.div`
  background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
  border-radius: 12px;
  padding: 24px 28px;
  margin-bottom: 20px;
  color: white;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: -40%;
    right: -15%;
    width: 180px;
    height: 180px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }
`;
const HeaderName = styled.div`
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: -0.3px;
`;
const HeaderTags = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;
const HeaderTag = styled.span`
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.25);
`;
const HeaderContact = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 14px;
  font-size: 12px;
  opacity: 0.9;
`;
const SectionTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${colors.title};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #9CA3AF;
`;
const EmptyIcon = styled.div`
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.6;
`;
const EmptyText = styled.div`
  font-size: 14px;
`;

const ResumeAnalysis = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [reanalyzingCandidateId, setReanalyzingCandidateId] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const uploadFileInputRef = useRef(null);
  const isDeletingRef = useRef(false);
  const candidatesLengthRef = useRef(0);
  const candidatesSnapshotRef = useRef('');
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [previewResume, setPreviewResume] = useState(null);

  // 分页状态
  const [pageSize, setPageSize] = useState(10);

  // 多列排序状态管理
  const [sortConfig, setSortConfig] = useState([]);
  const sortConfigRef = useRef([]);

  // 从URL恢复排序状态
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sortParam = urlParams.get('sort');
    if (sortParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sortParam));
        setSortConfig(parsed);
        sortConfigRef.current = parsed;
      } catch (e) {
        console.error('Failed to parse sort config from URL:', e);
      }
    }
  }, []);

  // 保存排序状态到URL
  const saveSortToUrl = useCallback((config) => {
    const url = new URL(window.location.href);
    if (config && config.length > 0) {
      url.searchParams.set('sort', encodeURIComponent(JSON.stringify(config)));
    } else {
      url.searchParams.delete('sort');
    }
    window.history.replaceState({}, '', url);
  }, []);

  // 多列排序处理函数
  const handleMultiSort = useCallback((columnKey) => {
    setSortConfig(prevConfig => {
      const existingIndex = prevConfig.findIndex(item => item.key === columnKey);
      let newConfig;
      if (existingIndex === -1) {
        newConfig = [...prevConfig, { key: columnKey, direction: 'ascend' }];
      } else {
        const existing = prevConfig[existingIndex];
        if (existing.direction === 'ascend') {
          newConfig = [...prevConfig];
          newConfig[existingIndex] = { ...existing, direction: 'descend' };
        } else {
          newConfig = prevConfig.filter(item => item.key !== columnKey);
        }
      }
      sortConfigRef.current = newConfig;
      saveSortToUrl(newConfig);
      return newConfig;
    });
  }, [saveSortToUrl]);

  // 清除所有排序
  const clearAllSorts = useCallback(() => {
    setSortConfig([]);
    sortConfigRef.current = [];
    saveSortToUrl([]);
  }, [saveSortToUrl]);

  // 获取列的排序状态
  const getColumnSortState = useCallback((columnKey) => {
    const index = sortConfig.findIndex(item => item.key === columnKey);
    if (index === -1) return { active: false, direction: null, order: null };
    return {
      active: true,
      direction: sortConfig[index].direction,
      order: index + 1
    };
  }, [sortConfig]);

  // 稳定的多列排序算法
  const getSortedData = useCallback((data) => {
    if (!sortConfig || sortConfig.length === 0) return data;
    const startTime = performance.now();
    const sorted = [...data].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
        let aValue = a[key];
        let bValue = b[key];
        // 处理特殊字段
        if (key === 'submitTime') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        } else if (key === 'resumeScore') {
          // 使用统一的计算函数
          aValue = getResumeScoreFromRecord(a);
          bValue = getResumeScoreFromRecord(b);
        } else if (key === 'matchScore' || key === 'finalScore') {
          aValue = aValue || 0;
          bValue = bValue || 0;
          if (key === 'finalScore') {
            aValue = a.hasInterview && a.finalScore ? a.finalScore : 0;
            bValue = b.hasInterview && b.finalScore ? b.finalScore : 0;
          }
        } else if (key === 'recommendation') {
          const recommendationRank = {
            '强烈推荐': 4,
            '推荐': 3,
            '待考虑': 2,
            '建议淘汰': 1
          };
          aValue = recommendationRank[getRecommendationLabelFromRecord(a)] || 0;
          bValue = recommendationRank[getRecommendationLabelFromRecord(b)] || 0;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        if (aValue < bValue) return direction === 'ascend' ? -1 : 1;
        if (aValue > bValue) return direction === 'ascend' ? 1 : -1;
      }
      return 0;
    });
    const endTime = performance.now();
    if (endTime - startTime > 100) {
      console.log(`Multi-sort took ${endTime - startTime}ms for ${data.length} records`);
    }
    return sorted;
  }, [sortConfig]);

  // 使用useMemo优化排序性能
  const sortedCandidates = useMemo(() => {
    return getSortedData(candidates);
  }, [candidates, getSortedData]);

  // 自定义排序表头组件
  const SortableHeader = useCallback(({ title, columnKey }) => {
    const { active, direction, order } = getColumnSortState(columnKey);
    return (
      <SortableHeaderCell onClick={() => handleMultiSort(columnKey)}>
        <span>{title}</span>
        <SortIndicator>
          <SortIconWrapper $active={active}>
            <UpOutlined style={{ color: direction === 'ascend' && active ? colors.primary : undefined }} />
            <DownOutlined style={{ color: direction === 'descend' && active ? colors.primary : undefined }} />
          </SortIconWrapper>
          {active && order > 1 && <SortOrderBadge>{order}</SortOrderBadge>}
        </SortIndicator>
      </SortableHeaderCell>
    );
  }, [getColumnSortState, handleMultiSort]);

  // 模拟数据 - 展示统一二维码收集的候选人数据
  const mockCandidates = [
    {
      id: 1,
      name: '张三',
      position: '商务管培生',
      phone: '138****1234',
      email: 'zhangsan@email.com',
      mbti: 'ENTJ',
      submitTime: '2024-01-15 10:30:00',
      matchScore: 92,
      recommendation: '强烈推荐',
      status: '已分析',
      resumeUrl: '/resumes/zhangsan.pdf'
    },
    {
      id: 2,
      name: '李四',
      position: '数据类管培生',
      phone: '139****5678',
      email: 'lisi@email.com',
      mbti: 'INTJ',
      submitTime: '2024-01-15 14:20:00',
      matchScore: 88,
      recommendation: '推荐',
      status: '已分析',
      resumeUrl: '/resumes/lisi.pdf'
    },
    {
      id: 3,
      name: '王五',
      position: '运营管培生',
      phone: '137****9012',
      email: 'wangwu@email.com',
      mbti: 'ENFP',
      submitTime: '2024-01-16 09:15:00',
      matchScore: 76,
      recommendation: '待考虑',
      status: '分析中',
      resumeUrl: '/resumes/wangwu.pdf'
    },
    {
      id: 4,
      name: '赵六',
      position: '供应链管培生',
      phone: '136****3456',
      email: 'zhaoliu@email.com',
      mbti: 'ISTJ',
      submitTime: '2024-01-16 11:45:00',
      matchScore: 85,
      recommendation: '推荐',
      status: '已分析',
      resumeUrl: '/resumes/zhaoliu.pdf'
    },
    {
      id: 5,
      name: '孙七',
      position: '设计类管培生',
      phone: '135****7890',
      email: 'sunqi@email.com',
      mbti: 'ISFP',
      submitTime: '2024-01-16 15:20:00',
      matchScore: 79,
      recommendation: '待考虑',
      status: '已分析',
      resumeUrl: '/resumes/sunqi.pdf'
    },
    {
      id: 6,
      name: '周八',
      position: '人力管培生',
      phone: '134****2468',
      email: 'zhouba@email.com',
      mbti: 'ENFJ',
      submitTime: '2024-01-17 08:30:00',
      matchScore: 91,
      recommendation: '强烈推荐',
      status: '已分析',
      resumeUrl: '/resumes/zhouba.pdf'
    },
    {
      id: 7,
      name: '吴九',
      position: '商务管培生',
      phone: '133****1357',
      email: 'wujiu@email.com',
      mbti: 'ESTP',
      submitTime: '2024-01-17 13:15:00',
      matchScore: 73,
      recommendation: '待考虑',
      status: '分析中',
      resumeUrl: '/resumes/wujiu.pdf'
    },
    {
      id: 8,
      name: '郑十',
      position: '数据类管培生',
      phone: '132****9753',
      email: 'zhengshi@email.com',
      mbti: 'INTP',
      submitTime: '2024-01-17 16:45:00',
      matchScore: 89,
      recommendation: '推荐',
      status: '已分析',
      resumeUrl: '/resumes/zhengshi.pdf'
    }
  ];

  const buildCandidatesSnapshot = useCallback((candidateList = []) => (
    JSON.stringify(
      candidateList.map(candidate => ({
        id: candidate.id,
        resumeFileName: candidate.resumeFileName || '',
        resumeSize: candidate.resumeSize || '',
        status: candidate.status || '',
        recommendation: candidate.recommendation || '',
        matchScore: candidate.matchScore ?? null,
        finalScore: candidate.finalScore ?? null,
        interviewScore: candidate.interviewScore ?? null,
        createdAt: candidate.createdAt || '',
        submitTime: candidate.submitTime || ''
      }))
    )
  ), []);

  // 加载候选人数据函数
  useEffect(() => {
    candidatesLengthRef.current = candidates.length;
    candidatesSnapshotRef.current = buildCandidatesSnapshot(candidates);
  }, [buildCandidatesSnapshot, candidates]);

  const loadCandidates = async ({ silent = false, normalizeResumeFiles = false } = {}) => {
    try {
      // 首先检查URL参数
      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');
      
      if (dataParam) {
        try {
          const urlData = JSON.parse(decodeURIComponent(dataParam));
          console.log('从URL参数加载数据:', urlData);
          setCandidates(urlData);
          if (!silent) {
            message.success(`已从URL参数加载 ${urlData.length} 条候选人数据`);
          }
          
          // 清除URL参数，避免刷新时重复加载
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        } catch (error) {
          console.error('解析URL参数失败:', error);
        }
      }

      // 从服务器加载数据
      console.log('从服务器加载数据...');
      const serverData = await serverDataSync.getAllCandidates({ normalizeResumeFiles });
      if (serverData.length > 0) {
        console.log('从服务器加载候选人数据:', serverData);
        setCandidates(serverData);
        if (!silent) {
          message.success(`已从服务器加载 ${serverData.length} 条候选人数据`);
        }
        return;
      }

      // 回退到IndexedDB
      console.log('服务器无数据，从IndexedDB加载...');
      const indexedData = await candidateDB.getAllCandidates();
      console.log('从IndexedDB加载所有候选人数据:', indexedData);
      setCandidates(indexedData);
      
      if (indexedData.length > 0) {
        if (!silent) {
          message.success(`已从IndexedDB加载 ${indexedData.length} 条候选人数据`);
        }
      } else if (!silent) {
        message.info('暂无候选人数据，请等待候选人提交申请');
      }
    } catch (error) {
      console.error('加载候选人数据失败:', error);
      message.error('加载数据失败，请刷新页面重试');
    }
  };

  const handleResumeReanalysis = async (candidate, mode = 'default') => {
    if (!candidate?.id || reanalyzingCandidateId) {
      return;
    }

    const loadingKey = `resume-reanalysis-${candidate.id}`;
    setReanalyzingCandidateId(candidate.id);
    
    const modeLabels = {
      'default': '默认模式',
      'local-vl': 'Qwen3.5-9B多模态模型',
      'deepseek': 'DeepSeek API'
    };
    
    message.loading({
      content: `正在使用${modeLabels[mode]}重新分析简历，请稍候...`,
      key: loadingKey,
      duration: 0
    });

    try {
      setCandidates(prev =>
        prev.map(item =>
          item.id === candidate.id ? {
            ...item,
            status: 'Qwen3.5-9B排队中',
            recommendation: '正在加入Qwen3.5-9B串行队列',
            resumeAnalysis: null,
            resumeAnalysisResult: null,
            analysisDetails: {
              ...item.analysisDetails,
              resumeAnalysis: null
            }
          } : item
        )
      );
      if (selectedCandidate?.id === candidate.id) {
        setSelectedCandidate(prev => prev ? {
          ...prev,
          status: 'Qwen3.5-9B排队中',
          recommendation: '正在加入Qwen3.5-9B串行队列',
          resumeAnalysis: null,
          resumeAnalysisResult: null,
          analysisDetails: {
            ...prev.analysisDetails,
            resumeAnalysis: null
          }
        } : prev);
      }

      const response = await fetch(`/api/analyze-resume/${candidate.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.error || errorResult?.message || '简历分析失败');
      }

      const result = await response.json();
      message.success({
        content: result?.queued ? `已加入后台分析队列（${modeLabels[mode]}），结果会自动刷新` : '简历重新分析完成',
        key: loadingKey
      });
      await loadCandidates({ silent: true });
    } catch (error) {
      console.error('重新分析失败:', error);
      message.error({
        content: error.message || '重新分析失败',
        key: loadingKey
      });
      await loadCandidates({ silent: true });
    } finally {
      setReanalyzingCandidateId(null);
    }
  };

  useEffect(() => {

    loadCandidates({ silent: true });
    
    // 设置定期刷新，从服务器检查新数据
    const refreshInterval = setInterval(async () => {
      // 如果正在删除操作，跳过自动刷新
      if (isDeletingRef.current) {
        console.log('删除操作进行中，跳过自动刷新');
        return;
      }
      
      try {
        const serverData = await serverDataSync.getAllCandidates();
        const serverSnapshot = buildCandidatesSnapshot(serverData);
        console.log('定期检查 - 服务器数据数量:', serverData.length, '页面数据数量:', candidatesLengthRef.current);
        
        // 人数变化或关键字段变化时自动刷新
        if (serverData.length > 0 && (
          serverData.length !== candidatesLengthRef.current ||
          serverSnapshot !== candidatesSnapshotRef.current
        )) {
          console.log('检测到新数据，自动刷新');
          setCandidates(serverData);
          if (selectedCandidate?.id) {
            const refreshedSelectedCandidate = serverData.find(item => item.id === selectedCandidate.id);
            if (refreshedSelectedCandidate) {
              setSelectedCandidate(refreshedSelectedCandidate);
            }
          }
          message.success('实时更新：候选人数据已同步');
        }
      } catch (error) {
        console.error('定期刷新失败:', error);
      }
    }, 3000); // 每3秒检查一次

    return () => {
      clearInterval(refreshInterval);
    };
  }, [buildCandidatesSnapshot, selectedCandidate?.id]); // 首次进入静默加载，避免因状态变化重复触发

  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case '强烈推荐': return 'green';
      case '推荐': return 'blue';
      case '待考虑': return 'orange';
      default: return 'default';
    }
  };

const getStatusColor = (status) => {
    const normalizedStatus = String(status || '');
    if (
      normalizedStatus.includes('失败') ||
      normalizedStatus.includes('异常') ||
      normalizedStatus.includes('超时') ||
      normalizedStatus.includes('无法')
    ) {
      return 'red';
    }

    switch (status) {
      case '已分析': return 'green';
      case '已分析(VL)': return 'green';
      case '已分析(local-VL)':
      case '已分析(Qwen3.5-9B)': return 'green';
      case '分析中': return 'blue';
      case 'local-VL排队中':
      case 'Qwen3.5-9B排队中': return 'gold';
      case 'local-VL分析准备中':
      case 'Qwen3.5-9B分析准备中': return 'blue';
      case 'PDF解析中': return 'blue';
      case 'local-VL OCR分析中':
      case 'Qwen3.5-9B OCR分析中': return 'geekblue';
      case 'OCR融合分析中': return 'cyan';
      case 'local-VL文本分析中':
      case 'Qwen3.5-9B文本分析中': return 'geekblue';
      case 'DeepSeek分析中': return 'purple';
      case '分析超时': return 'red';
      case 'VL分析超时': return 'red';
      case 'local-VL分析超时':
      case 'Qwen3.5-9B分析超时': return 'red';
      case '待分析': return 'orange';
      default: return 'default';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 85) return '#10B981';
    if (score >= 75) return '#3B82F6';
    return '#F59E0B';
  };

  const handleViewDetail = (record) => {
    setSelectedCandidate(record);
    setDetailModalVisible(true);
  };

  const handleDownloadResume = async (record) => {
    console.log('开始下载简历:', record);
    
    if (!record.id) {
      message.error('候选人ID不存在');
      return;
    }
    
    try {
      console.log(`正在请求下载API: /api/download-resume/${record.id}`);
      
      // 使用axios下载文件
      const response = await axios({
        method: 'GET',
        url: `/api/download-resume/${record.id}`,
        responseType: 'blob', // 重要：设置响应类型为blob
        timeout: 30000, // 30秒超时
        headers: {
          'Accept': 'application/pdf,application/octet-stream,*/*',
        }
      });
      
      console.log('API响应成功:', response.status, response.headers);
      
      // 检查响应数据
      if (!response.data || response.data.size === 0) {
        throw new Error('下载的文件为空');
      }
      
      // 创建blob URL
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      
      // 创建下载链接
      const link = document.createElement('a');
      link.href = url;
      // 根据文件类型设置默认扩展名
      const contentType = response.headers['content-type'] || 'application/pdf';
      const defaultExt = contentType.includes('image/jpeg') ? '.jpg' : '.pdf';
      link.download = record.resumeFileName || `简历_${record.name}${defaultExt}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`正在下载 ${record.name} 的简历`);
      console.log('下载简历成功:', record.resumeFileName);
      
    } catch (error) {
      console.error('API下载失败:', error);
      
      // 如果API下载失败，尝试直接访问文件
      if (record.resumeFileName) {
        try {
          console.log('尝试直接文件访问:', record.resumeFileName);
          const directUrl = `/uploads/resumes/${record.resumeFileName}`;
          const link = document.createElement('a');
          link.href = directUrl;
          link.download = record.resumeFileName || `简历_${record.name}.pdf`;
          link.target = '_blank';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          message.success(`正在下载 ${record.name} 的简历`);
        } catch (directError) {
          console.error('直接下载也失败:', directError);
          message.error(`下载失败: ${error.response?.status || error.message}。请检查文件是否存在或联系管理员`);
        }
      } else {
        message.error(`下载失败: ${error.response?.status || error.message}。简历文件信息不完整`);
      }
    }
  };

  const handlePreviewResume = (record) => {
    if (record.resumeFileName) {
      setPreviewResume(record);
      setPdfPreviewVisible(true);
      console.log('预览简历:', record.resumeFileName);
    } else {
      message.error('简历文件不存在');
    }
  };

  const previewFileExt = previewResume?.resumeFileName
    ? previewResume.resumeFileName.substring(previewResume.resumeFileName.lastIndexOf('.')).toLowerCase()
    : '';
  const previewFileUrl = previewResume
    ? `${serverDataSync.baseUrl}/resume-file/${previewResume.id}`
    : '';
  const isImagePreview = ['.jpg', '.jpeg', '.png'].includes(previewFileExt);
  const isPdfPreview = previewFileExt === '.pdf';
  const isWordPreview = ['.doc', '.docx'].includes(previewFileExt);

  // 处理参考文献点击
  const handleReferenceClick = (documentId, page, text) => {
    console.log('参考文献点击:', { documentId, page, text });
    
    // 如果没有documentId，尝试使用当前选中的候选人ID
    let actualDocumentId = documentId;
    
    if (!actualDocumentId && selectedCandidate) {
      actualDocumentId = selectedCandidate.id;
      console.log('使用候选人ID作为文档ID:', actualDocumentId);
    }
    
    if (!actualDocumentId) {
      console.warn('无法获取文档ID，无法打开文件预览');
      message.warning('无法获取文档信息，请先选择候选人');
      return;
    }
    
    // 尝试打开文件预览
    try {
      const previewUrl = `/api/resume-file/${actualDocumentId}`;
      console.log('打开文件预览:', previewUrl);
      window.open(previewUrl, '_blank');
    } catch (error) {
      console.error('打开文件预览失败:', error);
      message.error('打开文件预览失败');
    }
  };

  // 全局参考文献点击处理函数
  useEffect(() => {
    // 添加全局点击事件监听器来处理参考文献点击
    const handleGlobalReferenceClick = (event) => {
      const target = event.target;
      
      // 检查是否是参考文献链接
      if (target.tagName === 'A' && target.href && target.href.includes('documentId')) {
        event.preventDefault();
        
        // 从href中提取参数
        const url = new URL(target.href);
        const documentId = url.searchParams.get('documentId');
        const page = url.searchParams.get('page') || 1;
        const text = url.searchParams.get('text') || '';
        
        console.log('全局参考文献点击:', { documentId, page, text });
        handleReferenceClick(documentId, page, text);
      }
    };
    
    // 添加事件监听器
    document.addEventListener('click', handleGlobalReferenceClick);
    
    // 清理函数
    return () => {
      document.removeEventListener('click', handleGlobalReferenceClick);
    };
  }, [selectedCandidate]);

  // 添加全局参考文献点击处理函数到window对象
  useEffect(() => {
    // 将处理函数添加到全局，以便其他地方调用
    window.handleReferenceClick = handleReferenceClick;
    
    // 清理函数
    return () => {
      delete window.handleReferenceClick;
    };
  }, [selectedCandidate]);

  // 刷新候选人列表 - 必须在 handleUploadResume 之前定义
  const refreshCandidates = async () => {
    try {
      // 优先从服务器刷新
      const serverData = await serverDataSync.getAllCandidates({ normalizeResumeFiles: true });
      if (serverData.length > 0) {
        console.log('刷新数据，从服务器读取:', serverData);
        setCandidates(serverData);
        message.success(`已从服务器刷新 ${serverData.length} 条数据`);
      } else {
        // 回退到IndexedDB
        const indexedData = await candidateDB.getAllCandidates();
        console.log('刷新数据，从IndexedDB读取:', indexedData);
        setCandidates(indexedData);
      }
    } catch (error) {
      console.error('刷新数据失败:', error);
      message.error('刷新数据失败，请重试');
    }
  };

  const handleUploadResume = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadLoading(true);
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const fileName = file.name;
        const namePart = fileName.replace(/\.[^.]+$/, '');
        const parts = namePart.split('_');
        const candidateName = parts[0] || '未知';
        const position = parts[1] || '未指定岗位';

        const formData = new FormData();
        formData.append('name', candidateName);
        formData.append('position', position);
        formData.append('status', '待分析');
        formData.append('submitTime', new Date().toLocaleString('zh-CN'));
        formData.append('resume', file);

        const result = await serverDataSync.addCandidateWithFile(formData);
        if (result) {
          successCount++;
        }
      } catch (err) {
        if (err.message?.includes('已存在') || err.message?.includes('409')) {
          skipCount++;
        } else {
          console.error('上传简历失败:', file.name, err);
          errorCount++;
        }
      }
    }

    setUploadLoading(false);
    if (e.target) e.target.value = '';

    if (successCount > 0 || skipCount > 0) {
      message.success(`上传完成：成功 ${successCount} 个${skipCount > 0 ? `，跳过 ${skipCount} 个（已存在）` : ''}${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
      await refreshCandidates();
    } else if (errorCount > 0) {
      message.error(`上传失败 ${errorCount} 个文件，请重试`);
    }
  }, [refreshCandidates]);

  const syncCandidatesToIndexedDB = async (candidateList) => {
    await candidateDB.clearAll();
    for (const candidate of candidateList) {
      await candidateDB.addCandidate(candidate);
    }
  };

  const cleanupInvalidCandidates = async () => {
    if (cleanupLoading) {
      return;
    }

    setCleanupLoading(true);
    try {
      const preview = await serverDataSync.previewInvalidCandidatesCleanup();
      const invalidCandidates = preview?.candidates || [];

      if (!preview?.success) {
        message.error('预扫描失败，请稍后重试');
        setCleanupLoading(false);
        return;
      }

      if (invalidCandidates.length === 0) {
        message.info('未发现需要清理的异常候选人');
        setCleanupLoading(false);
        return;
      }

      const previewText = invalidCandidates
        .slice(0, 5)
        .map(candidate => `${candidate.name || '未命名候选人'}：${candidate.reasons.join('、')}`)
        .join('\n');

      Modal.confirm({
        title: '确认清理异常候选人',
        content: `检测到 ${invalidCandidates.length} 条异常候选人记录。\n\n${previewText}${invalidCandidates.length > 5 ? '\n...' : ''}\n\n将继续二次确认后才会真正删除。`,
        okText: '继续',
        cancelText: '取消',
        async onOk() {
          Modal.confirm({
            title: '二次确认',
            content: `本次将删除 ${invalidCandidates.length} 条简历文件损坏、丢失或未上传的候选人记录，此操作不可恢复。`,
            okText: '确认清理',
            okType: 'danger',
            cancelText: '取消',
            async onOk() {
              try {
                const result = await serverDataSync.cleanupInvalidCandidates();
                if (!result?.success) {
                  throw new Error('清理失败');
                }

                const serverData = await serverDataSync.getAllCandidates();
                setCandidates(serverData);
                await syncCandidatesToIndexedDB(serverData);
                if (selectedCandidate && result.removedCandidates?.some(candidate => candidate.id === selectedCandidate.id)) {
                  setSelectedCandidate(null);
                }
                message.success(`已清理 ${result.removedCount || 0} 条异常候选人记录`);
              } catch (error) {
                console.error('清理异常候选人失败:', error);
                message.error('清理失败，请重试');
              } finally {
                setCleanupLoading(false);
              }
            },
            onCancel() {
              setCleanupLoading(false);
            }
          });
        },
        onCancel() {
          setCleanupLoading(false);
        }
      });
    } catch (error) {
      console.error('预览异常候选人清理失败:', error);
      message.error('预扫描失败，请稍后重试');
      setCleanupLoading(false);
    }
  };

  const clearAllData = () => {
    Modal.confirm({
      title: '确认清空所有数据',
      content: (
        <div>
          <p>此操作将执行以下操作：</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>停止所有正在进行的简历分析任务</li>
            <li>清空服务器数据库中的所有候选人数据</li>
            <li>清空本地缓存数据</li>
          </ul>
          <p style={{ marginTop: '10px', color: '#ff4d4f' }}>⚠️ 此操作不可恢复，请确认！</p>
        </div>
      ),
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          isDeletingRef.current = true;
          console.log('开始清空服务器数据...');
          message.loading({
            content: '正在安全清理后台分析任务并清空所有数据...',
            key: 'clear-all-candidates',
            duration: 0
          });

          // 清空服务器数据库中的数据
          const result = await serverDataSync.clearAllCandidates();

          if (result) {
            // 同时清空本地 IndexedDB 缓存
            await candidateDB.clearAll();

            // 更新本地状态
            setCandidates([]);
            setSelectedCandidate(null);
            setDetailModalVisible(false);
            setReanalyzingCandidateId(null);

            const cancelledCount = Number(result.cancelledAnalysisJobs || 0);
            const restartedVlContainer = Boolean(result.restartedVlContainer);
            const restartSkippedReason = String(result.restartSkippedReason || '').trim();

            message.success({
              key: 'clear-all-candidates',
              content: cancelledCount > 0
                ? `所有数据已清空，已安全停止 ${cancelledCount} 个后台分析任务${restartedVlContainer ? '，本地VL服务已重启' : ''}`
                : `所有数据已从服务器清空！${restartedVlContainer ? ' 本地VL服务已同步重启。' : ''}`
            });
            if (!restartedVlContainer && restartSkippedReason) {
              message.info(`提示：${restartSkippedReason}`);
            }
            console.log('清空数据完成');
          } else {
            throw new Error('服务器返回失败');
          }
        } catch (error) {
          console.error('清空数据失败:', error);
          message.error({
            key: 'clear-all-candidates',
            content: '清空数据失败，请重试'
          });
        } finally {
          setTimeout(() => {
            isDeletingRef.current = false;
            console.log('删除状态已重置');
          }, 2000);
        }
      },
    });
  };

  const testDataTransfer = () => {
    // 模拟从候选人表单传递的数据
    const testData = {
      name: '测试用户',
      position: '商务管培生',
      phone: '138****1234',
      email: 'test@example.com',
      mbti: 'ENTJ',
      submitTime: new Date().toLocaleString('zh-CN'),
      matchScore: 88,
      recommendation: '推荐',
      status: '已分析',
      resumeFileName: '测试简历.pdf',
      resumeSize: 1024
    };

    // 构建URL参数
    const params = new URLSearchParams(testData);
    const testUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    console.log('测试数据传递URL:', testUrl);
    console.log('测试数据:', testData);
    
    // 重新加载页面以触发URL参数处理
    window.location.href = testUrl;
  };

  const copyCurrentUrl = () => {
    const currentUrl = window.location.href;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        message.success('当前URL已复制到剪贴板！');
      }).catch(() => {
        Modal.info({
          title: '当前URL',
          content: (
            <div>
              <p>请复制以下URL：</p>
              <Input.TextArea 
                value={currentUrl} 
                readOnly 
                rows={4}
                style={{ marginTop: '8px' }}
              />
            </div>
          ),
          okText: '知道了'
        });
      });
    } else {
      Modal.info({
        title: '当前URL',
        content: (
          <div>
            <p>请复制以下URL：</p>
            <Input.TextArea 
              value={currentUrl} 
              readOnly 
              rows={4}
              style={{ marginTop: '8px' }}
            />
          </div>
        ),
        okText: '知道了'
      });
    }
  };

  const showDataInfo = async () => {
    const currentDomain = window.location.origin;
    
    try {
      const allCandidates = await candidateDB.getAllCandidates();
      
      Modal.info({
        title: '数据状态说明',
        content: (
          <div>
            <p><strong>当前域名：</strong>{currentDomain}</p>
            <p><strong>页面数据数量：</strong>{candidates.length} 条候选人数据</p>
            <p><strong>IndexedDB数据数量：</strong>{allCandidates.length} 条候选人数据</p>
            <p><strong>数据来源：</strong>IndexedDB数据库</p>
            <br />
            <p><strong>说明：</strong></p>
            <p>• 手机端填写的数据保存到IndexedDB数据库</p>
            <p>• 任何设备访问分析页面都能看到所有候选人数据</p>
            <p>• 数据持久化存储，不依赖URL参数</p>
          </div>
        ),
        okText: '知道了'
      });
    } catch (error) {
      console.error('获取数据信息失败:', error);
      message.error('获取数据信息失败');
    }
  };


  const deleteCandidate = (candidateId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个候选人数据吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          isDeletingRef.current = true;
          console.log('开始删除候选人:', candidateId);

          // 只从服务器删除（数据是从服务器加载的）
          const serverDeleteResult = await serverDataSync.deleteCandidate(candidateId);

          // 如果服务器删除成功，更新本地状态
          if (serverDeleteResult) {
            const updatedCandidates = candidates.filter(c => c.id !== candidateId);
            setCandidates(updatedCandidates);
            message.success('候选人数据已删除！');
            console.log('删除完成，剩余候选人数量:', updatedCandidates.length);
          } else {
            throw new Error('服务器删除失败');
          }
        } catch (error) {
          console.error('删除候选人数据失败:', error);
          message.error('删除数据失败，请重试');
        } finally {
          setTimeout(() => {
            isDeletingRef.current = false;
            console.log('删除状态已重置');
          }, 2000);
        }
      },
    });
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      align: 'center',
      render: (text, record) => (
        <NameCell>
          <UserOutlined className="name-icon" />
          <span className="name-text">{text || '未填写'}</span>
        </NameCell>
      ),
    },
    {
      title: '应聘职位',
      dataIndex: 'position',
      key: 'position',
      width: 120,
      align: 'center',
      filters: [
        { text: '商务管培生', value: '商务管培生' },
        { text: '运营管培生', value: '运营管培生' },
        { text: '数据类管培生', value: '数据类管培生' },
        { text: '供应链管培生', value: '供应链管培生' },
        { text: '设计类管培生', value: '设计类管培生' },
        { text: '人力管培生', value: '人力管培生' },
      ],
      onFilter: (value, record) => record.position === value,
      render: (text) => <PositionTag>{text || '未填写'}</PositionTag>,
    },
    {
      title: 'MBTI',
      dataIndex: 'mbti',
      key: 'mbti',
      width: 80,
      align: 'center',
      render: (text) => <MBTITag>{text || '未完成'}</MBTITag>,
    },
    {
      title: <SortableHeader title="简历评分" columnKey="resumeScore" />,
      key: 'resumeScore',
      width: 100,
      align: 'center',
      render: (score, record) => {
        // 使用统一的计算函数
        const resumeScore = getResumeScoreFromRecord(record);
        // 简历分析未完成时显示 "-"，与综合评分保持一致
        if (!resumeScore || resumeScore === 0) {
          return <CenterCell><StatusBadge $type="default">-</StatusBadge></CenterCell>;
        }
        return (
          <CenterCell>
            <Progress
              type="circle"
              size={44}
              percent={resumeScore}
              strokeColor={getScoreColor(resumeScore)}
              format={() => `${resumeScore}分`}
              strokeWidth={10}
            />
          </CenterCell>
        );
      },
    },
    {
      title: <SortableHeader title="综合评分" columnKey="finalScore" />,
      dataIndex: 'finalScore',
      key: 'finalScore',
      width: 100,
      align: 'center',
      render: (score, record) => {
        if (record.hasInterview && score) {
          return (
            <CenterCell>
              <Progress 
                type="circle" 
                size={44} 
                percent={score} 
                strokeColor={getScoreColor(score)}
                format={() => `${score}分`}
                strokeWidth={10}
              />
            </CenterCell>
          );
        }
        return <CenterCell><StatusBadge $type="default">-</StatusBadge></CenterCell>;
      },
    },
    {
      title: <SortableHeader title="推荐等级" columnKey="recommendation" />,
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 120,
      align: 'center',
      render: (_, record) => {
        // 简历分析未完成时显示 "-"，与综合评分保持一致
        const resumeScore = getResumeScoreFromRecord(record);
        if (!resumeScore || resumeScore === 0) {
          return <CenterCell><StatusBadge $type="default">-</StatusBadge></CenterCell>;
        }
        const recommendationLabel = getRecommendationLabelFromRecord(record);
        return (
          <CenterCell>
            <RecommendationTag $level={recommendationLabel}>{recommendationLabel}</RecommendationTag>
          </CenterCell>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (text) => {
        let type = 'default';
        const normalizedStatus = String(text || '');

        // 失败/超时状态
        if (
          normalizedStatus.includes('失败') ||
          normalizedStatus.includes('异常') ||
          normalizedStatus.includes('超时') ||
          normalizedStatus.includes('无法')
        ) {
          type = 'timeout';
        }
        // 已提交
        else if (text === '已提交') {
          type = 'submitted';
        }
        // 已分析
        else if (text === '已分析' || text === '已分析(VL)' || text === '已分析(local-VL)' || text === '已分析(Qwen3.5-9B)') {
          type = 'analyzed';
        }
        // 待分析
        else if (text === '待分析') {
          type = 'pending';
        }
        // 分析中 - 细化各阶段
        else if (text === '分析中') {
          type = 'analyzing';
        }
        else if (text === 'local-VL排队中' || text === 'Qwen3.5-9B排队中') {
          type = 'queuing';
        }
        else if (text === 'local-VL分析准备中' || text === 'Qwen3.5-9B分析准备中') {
          type = 'preparing';
        }
        else if (text === 'PDF解析中') {
          type = 'pdf-parsing';
        }
        else if (text === 'local-VL OCR分析中' || text === 'Qwen3.5-9B OCR分析中') {
          type = 'vl-ocr';
        }
        else if (text === 'OCR融合分析中') {
          type = 'ocr-fusion';
        }
        else if (text === 'local-VL文本分析中' || text === 'Qwen3.5-9B文本分析中') {
          type = 'vl-text';
        }
        else if (text === 'DeepSeek分析中') {
          type = 'deepseek';
        }

        return <CenterCell><StatusBadge $type={type}>{text}</StatusBadge></CenterCell>;
      },
    },
    {
      title: <SortableHeader title="提交时间" columnKey="submitTime" />,
      dataIndex: 'submitTime',
      key: 'submitTime',
      width: 140,
      align: 'center',
      render: (text) => <CenterCell><TimeText>{text}</TimeText></CenterCell>,
    },
    {
      title: '简历文件',
      dataIndex: 'resumeFileName',
      key: 'resumeFileName',
      width: 200,
      align: 'center',
      render: (text, record) => {
        // 显示格式：姓名_岗位
        const displayName = `${record.name || '未命名'}_${record.position || '未知岗位'}`;
        return text ? (
          <CenterCell>
            <FileNameText title={text}>{displayName}</FileNameText>
          </CenterCell>
        ) : <CenterCell><TimeText>-</TimeText></CenterCell>;
      },
    },
    {
      title: '面试情况',
      dataIndex: 'hasInterview',
      key: 'hasInterview',
      width: 120,
      align: 'center',
      render: (hasInterview, record) => {
        if (hasInterview) {
          return <CenterCell><StatusBadge $type="submitted">已完成面试</StatusBadge></CenterCell>;
        }
        return (
          <CenterCell>
            <ActionButton
              className="primary-action"
              onClick={() => {
                const candidateInfo = {
                  id: record.id,
                  name: record.name,
                  position: record.position
                };
                window.open(`/chat?candidate=${encodeURIComponent(JSON.stringify(candidateInfo))}`, '_blank');
              }}
            >
              去进行面试
            </ActionButton>
          </CenterCell>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_, record) => (
        <ActionGroup>
          <ActionRow>
            <ActionButton
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </ActionButton>
            <ActionButton
              icon={<FileTextOutlined />}
              onClick={() => handlePreviewResume(record)}
            >
              预览
            </ActionButton>
          </ActionRow>
          <ActionRow>
            <ActionButton
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadResume(record)}
            >
              下载
            </ActionButton>
            <ActionButton
              className="danger"
              onClick={() => deleteCandidate(record.id)}
            >
              删除
            </ActionButton>
          </ActionRow>
        </ActionGroup>
      ),
    },
  ];

  const statistics = useMemo(() => {
    const statsResult = getCandidateStats(candidates);
    return {
      total: statsResult.totalCandidates,
      analyzed: candidates.filter(c => c.status === '已分析' || c.status === '已分析(VL)' || c.status === '已分析(local-VL)' || c.status === '已分析(Qwen3.5-9B)').length,
      analyzing: candidates.filter(c => ['分析中', 'local-VL排队中', 'Qwen3.5-9B排队中', 'local-VL分析准备中', 'Qwen3.5-9B分析准备中', 'PDF解析中', 'local-VL OCR分析中', 'Qwen3.5-9B OCR分析中', 'OCR融合分析中', 'local-VL文本分析中', 'Qwen3.5-9B文本分析中', 'DeepSeek分析中'].includes(c.status)).length,
      timeout: candidates.filter(c => c.status === '分析超时' || c.status === 'VL分析超时' || c.status === 'local-VL分析超时' || c.status === 'Qwen3.5-9B分析超时').length,
      recommended: statsResult.recommendedCandidates,
      avgScore: statsResult.averageResumeScore
    };
  }, [candidates]);

  return (
    <AnalysisContainer>
      <PageHeader>
        <h2>候选管理</h2>
        <div className="subtitle">查看和管理候选人简历分析结果，支持智能筛选与评估</div>
      </PageHeader>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8}>
          <StatCard>
            <Statistic
              title="总申请数"
              value={statistics.total}
              prefix={<UserOutlined />}
            />
          </StatCard>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard>
            <Statistic
              title="已分析"
              value={statistics.analyzed}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: colors.success }}
            />
          </StatCard>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard>
            <Statistic
              title="强烈推荐"
              value={statistics.recommended}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: colors.warning }}
            />
          </StatCard>
        </Col>
      </Row>

      {/* 操作栏 */}
      <FilterCard>
        <FilterRow style={{ justifyContent: 'flex-end' }}>
          <FilterRight>
            <input
              type="file"
              ref={uploadFileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              onChange={handleUploadResume}
            />
            <SecondaryButton
              icon={<UploadOutlined />}
              onClick={() => uploadFileInputRef.current?.click()}
              loading={uploadLoading}
            >
              上传简历
            </SecondaryButton>
            <SecondaryButton
              icon={<FilterOutlined />}
              onClick={refreshCandidates}
              loading={loading}
            >
              刷新数据
            </SecondaryButton>
            <Button
              danger
              loading={cleanupLoading}
              onClick={cleanupInvalidCandidates}
              style={{ borderRadius: '10px', height: '44px' }}
            >
              清除异常数据
            </Button>
            <Button 
              danger
              onClick={clearAllData}
              style={{ borderRadius: '10px', height: '44px' }}
            >
              清空所有数据
            </Button>
          </FilterRight>
        </FilterRow>
      </FilterCard>

      {/* 多列排序提示 */}
      {sortConfig.length > 0 && (
        <MultiSortHint>
          <SwapOutlined className="hint-icon" />
          <span>
            当前排序：{sortConfig.map((item, index) => {
              const columnNames = {
                resumeScore: '简历评分',
                matchScore: '匹配评分',
                finalScore: '综合评分',
                recommendation: '推荐等级',
                submitTime: '提交时间'
              };
              return `${columnNames[item.key] || item.key} ${item.direction === 'ascend' ? '↑' : '↓'}`;
            }).join(' → ')}
          </span>
          <span className="clear-btn" onClick={clearAllSorts}>清除排序</span>
        </MultiSortHint>
      )}

      {/* 候选人列表 */}
      <TableCard>
        <Table
          columns={columns}
          dataSource={sortedCandidates}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1300, y: 600 }}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', color: colors.muted }}>📋</div>
                <div style={{ fontSize: '16px', color: colors.text, marginBottom: '8px', fontWeight: 500 }}>
                  暂无候选人数据
                </div>
                <div style={{ fontSize: '14px', color: colors.muted }}>
                  请等待候选人扫描二维码提交申请
                </div>
              </div>
            )
          }}
          pagination={{
            pageSize: pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => setPageSize(size),
          }}
        />
      </TableCard>

      {/* 详情模态框 */}
      <CandidateDetailModal
        visible={detailModalVisible}
        candidate={selectedCandidate}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCandidate(null);
        }}
        onRefreshAnalysis={handleResumeReanalysis}
        refreshingAnalysis={reanalyzingCandidateId === selectedCandidate?.id}
      />

      {/* PDF预览模态框 */}
      <StyledModal
        title={`预览简历 - ${previewResume?.name}`}
        open={pdfPreviewVisible}
        onCancel={() => setPdfPreviewVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: '1000px' }}
        centered={true}
      >
        {previewResume && (
          <ModalContentWrapper>
            {/* 顶部卡片 */}
            <PreviewHeaderCard>
              <PreviewHeaderLeft>
                <PreviewHeaderName>{previewResume.name}</PreviewHeaderName>
                <PreviewHeaderTags>
                  <ModalHeaderTag>{previewResume.position}</ModalHeaderTag>
                  {previewResume.mbti && <ModalHeaderTag>{previewResume.mbti}</ModalHeaderTag>}
                </PreviewHeaderTags>
              </PreviewHeaderLeft>
              <PreviewHeaderRight>
                <div>📄 {previewResume.name}_{previewResume.position}</div>
                <div style={{ marginTop: '4px' }}>{previewResume.resumeSize ? `${(previewResume.resumeSize / 1024).toFixed(1)} KB` : '未知大小'}</div>
              </PreviewHeaderRight>
            </PreviewHeaderCard>
            {/* PDF预览区域 */}
            <PreviewSectionCard>
              <div style={{ width: '100%', height: '600px', borderRadius: '12px', overflow: 'hidden', background: colors.background }}>
                {previewResume.resumeFilePath ? (
                  isImagePreview ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f9fc' }}>
                      <img
                        src={previewFileUrl}
                        alt={`${previewResume.name}的简历预览`}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ) : isPdfPreview ? (
                    <iframe
                      src={previewFileUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                      title={`${previewResume.name}的简历预览`}
                    />
                  ) : isWordPreview ? (
                    <div style={{ height: '100%', padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
                      <FileTextOutlined style={{ fontSize: '42px', color: colors.primary }} />
                      <div style={{ fontSize: '18px', fontWeight: 600, color: colors.title }}>当前浏览器内不稳定支持 Word 直接预览</div>
                      <div style={{ fontSize: '13px', color: colors.textSecondary, maxWidth: '520px', lineHeight: 1.8 }}>
                        可以使用"新标签打开"查看原始文件，或直接下载到本地打开。
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <GradientButton onClick={() => window.open(previewFileUrl, '_blank', 'noopener,noreferrer')}>
                          新标签打开
                        </GradientButton>
                        <OutlineButton onClick={() => handleDownloadResume(previewResume)}>
                          下载简历
                        </OutlineButton>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={previewFileUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                      title={`${previewResume.name}的简历预览`}
                    />
                  )
                ) : (
                  <div style={{ padding: '60px 24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <FileTextOutlined style={{ fontSize: '48px', color: colors.primary, marginBottom: '16px' }} />
                    <div style={{ fontSize: '18px', fontWeight: '600', color: colors.title, marginBottom: '8px' }}>{previewResume.name} - 个人简历</div>
                    <Text type="secondary" style={{ fontSize: '14px' }}>（简历文件未上传）</Text>
                  </div>
                )}
              </div>
            </PreviewSectionCard>
          </ModalContentWrapper>
        )}
      </StyledModal>
    </AnalysisContainer>
  );
};

export default ResumeAnalysis;
