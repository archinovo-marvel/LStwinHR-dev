import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Table, Tag, Button, Modal, message, Input, Select } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import candidateDB from '../utils/candidateDB';
import serverDataSync from '../utils/serverDataSync';
import axios from 'axios';
import { getCandidateStats } from '../utils/candidateStats';
import CandidateDetailModal from '../components/CandidateDetailModal';

// Custom SVG Icons
const IconUser = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconDocument = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
);

const IconTrophy = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconEye = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconDownload = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconFilter = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconSwap = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const IconTrash = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconUpload = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconSearch = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconArrowUp = ({ size = 8, color = 'currentColor', strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const IconArrowDown = ({ size = 8, color = 'currentColor', strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconSync = ({ size = 14, color = 'currentColor', strokeWidth = 1.5, spin }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={spin ? { animation: 'spin 1s linear infinite' } : {}}>
    <path d="M21.5 2v6h-6" />
    <path d="M2.5 12a10 10 0 0 1 17.8-6.3L21.5 8" />
    <path d="M2.5 22v-6h6" />
    <path d="M21.5 12a10 10 0 0 1-17.8 6.3L2.5 16" />
  </svg>
);

const IconChevronUp = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const { Option } = Select;

import { colors } from '../theme/colors';

const PageWrapper = styled.div`
  min-height: 100vh;
  background: ${colors.bg};
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const PageHeader = styled.header`
  padding: 120px 60px 32px;
  border-bottom: 1px solid ${colors.border};
`;

const HeaderContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const HeaderLeft = styled.div``;

const PageTitle = styled.h1`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 16px 0;
  line-height: 1.2;
`;

const PageSubtitle = styled.p`
  font-size: 14px;
  color: ${colors.textMuted};
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
`;

const MainContent = styled.main`
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 60px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background: ${colors.border};
  margin-bottom: 24px;
`;

const StatCard = styled(motion.div)`
  background: ${colors.bg};
  padding: 24px 20px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 20px;
    top: 24px;
    width: 24px;
    height: 1px;
    background: ${colors.highlight};
  }
`;

const StatLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 8px;
`;

const StatValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 400;
  color: ${colors.text};
  line-height: 1;
`;

const StatIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  color: ${props => props.$color || colors.textMuted};
`;

const FilterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
`;

const FilterLeft = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
`;

const FilterRight = styled.div`
  display: flex;
  gap: 12px;
`;

const SearchInput = styled(Input)`
  width: 280px;
  height: 40px;
  border-radius: 8px;
  border-color: ${colors.border};

  &:hover, &:focus {
    border-color: ${colors.highlight};
  }
`;

const FilterSelect = styled(Select)`
  min-width: 140px;

  .ant-select-selector {
    height: 40px !important;
    border-radius: 8px !important;
    border-color: ${colors.border} !important;
  }

  &:hover .ant-select-selector {
    border-color: ${colors.highlight} !important;
  }
`;

const ActionButton = styled(Button)`
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  ${props => props.$primary ? `
    background: ${colors.accent};
    border-color: ${colors.accent};
    color: white;

    &:hover {
      background: ${colors.highlight} !important;
      border-color: ${colors.highlight} !important;
      transform: translateY(-1px);
    }
  ` : `
    background: ${colors.bg};
    border-color: ${colors.border};
    color: ${colors.text};

    &:hover {
      border-color: ${colors.highlight};
      color: ${colors.highlight};
      transform: translateY(-1px);
    }
  `}

  &:active {
    transform: translateY(0);
  }
`;

const DangerButton = styled(ActionButton)`
  background: #FFFFFF;
  border-color: ${colors.danger};
  color: ${colors.danger};

  &:hover {
    background: ${colors.danger} !important;
    border-color: ${colors.danger} !important;
    color: #FFFFFF !important;
  }
`;

const MultiSortHint = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  margin-bottom: 16px;
  background: ${colors.bgSecondary};
  border-radius: 8px;
  font-size: 13px;
  color: ${colors.text};

  .sort-info {
    flex: 1;
    color: ${colors.textMuted};
  }

  .clear-btn {
    color: ${colors.highlight};
    cursor: pointer;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const TableWrapper = styled.div`
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  overflow: hidden;
`;

const StyledTable = styled(Table)`
  .ant-table {
    background: transparent;
  }

  .ant-table-thead > tr > th {
    background: ${colors.bgSecondary};
    border-bottom: 1px solid ${colors.border};
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${colors.textMuted};
  }

  .ant-table-tbody > tr > td {
    padding: 10px 12px;
    border-bottom: 1px solid ${colors.border};
    transition: background 0.2s ease;
  }

  .ant-table-tbody > tr:hover > td {
    background: ${colors.bgSecondary};
  }

  .ant-table-tbody > tr:last-child > td {
    border-bottom: none;
  }

  .ant-pagination {
    padding: 16px 20px;
    margin: 0;
    border-top: 1px solid ${colors.border};
  }
`;

const SortHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
  width: 100%;

  &:hover {
    color: ${colors.highlight};
  }
`;

const SortBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  background: ${colors.highlight};
  border-radius: 50%;
  margin-left: 4px;
`;

const CandidateName = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${colors.bgSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: ${colors.textMuted};
`;

const NameText = styled.span`
  font-weight: 500;
  color: ${colors.text};
`;

const PositionTag = styled.span`
  display: inline-flex;
  padding: 4px 10px;
  font-size: 12px;
  background: ${colors.bgSecondary};
  color: ${colors.textMuted};
  border-radius: 4px;
`;

const MBTITag = styled.span`
  display: inline-flex;
  padding: 4px 10px;
  font-size: 12px;
  background: rgba(139, 115, 85, 0.1);
  color: ${colors.highlight};
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
`;

const ScoreCircle = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  background: ${props => `rgba(${props.$rgb}, 0.1)`};
  color: ${props => props.$color};
  border: 2px solid ${props => props.$color};
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch(props.$type) {
      case 'analyzed': return 'rgba(16, 185, 129, 0.1)';
      case 'analyzing': return 'rgba(47, 128, 237, 0.1)';
      case 'queuing': return 'rgba(245, 158, 11, 0.1)';
      case 'timeout': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgba(100, 116, 139, 0.1)';
    }
  }};
  color: ${props => {
    switch(props.$type) {
      case 'analyzed': return colors.success;
      case 'analyzing': return '#2563EB';
      case 'queuing': return colors.warning;
      case 'timeout': return colors.danger;
      default: return colors.textMuted;
    }
  }};
`;

const RecommendationTag = styled.span`
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch(props.$level) {
      case '强烈推荐': return 'rgba(16, 185, 129, 0.1)';
      case '推荐': return 'rgba(139, 115, 85, 0.1)';
      case '待考虑': return 'rgba(245, 158, 11, 0.1)';
      default: return 'rgba(100, 116, 139, 0.1)';
    }
  }};
  color: ${props => {
    switch(props.$level) {
      case '强烈推荐': return colors.success;
      case '推荐': return colors.highlight;
      case '待考虑': return colors.warning;
      default: return colors.textMuted;
    }
  }};
`;

const FileNameText = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
  background: ${colors.bgSecondary};
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
`;

const TimeText = styled.span`
  font-size: 13px;
  color: ${colors.textMuted};
`;

const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
`;

const SmallButton = styled(Button)`
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: ${colors.highlight} !important;
    border-color: ${colors.highlight} !important;
  }
`;

const InterviewButton = styled(Button)`
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 6px;
  background: rgba(139, 115, 85, 0.1);
  border-color: transparent;
  color: ${colors.highlight};

  &:hover {
    background: ${colors.highlight} !important;
    border-color: ${colors.highlight} !important;
    color: white !important;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 80px 40px;
  color: ${colors.textMuted};
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.4;
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 8px;
`;

const EmptyDesc = styled.div`
  font-size: 14px;
  color: ${colors.textMuted};
`;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const getNumericScoreValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateResumeScore = (scores) => {
  if (!scores) return 0;
  return getNumericScoreValue(scores.educationScore) +
    getNumericScoreValue(scores.workScore) +
    getNumericScoreValue(scores.projectScore) +
    getNumericScoreValue(scores.skillScore) +
    getNumericScoreValue(scores.expressionScore);
};

export const getResumeScoreFromRecord = (record) => {
  const scores = record?.resumeAnalysisResult?.scores;
  return calculateResumeScore(scores);
};

const getResumeScoreValueFromRecord = (record) => {
  const breakdownTotal = getResumeScoreFromRecord(record);
  if (breakdownTotal > 0) return breakdownTotal;
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

  if (explicitRecommendation) return explicitRecommendation;
  return getRecommendationLabelFromResumeScore(getResumeScoreValueFromRecord(record));
};

const getScoreColor = (score) => {
  if (score >= 85) return { color: '#10B981', rgb: '16, 185, 129' };
  if (score >= 75) return { color: '#3B82F6', rgb: '59, 130, 246' };
  return { color: '#F59E0B', rgb: '245, 158, 11' };
};

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
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [positionFilter, setPositionFilter] = useState(null);

  const sortConfigRef = useRef([]);

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

  const saveSortToUrl = useCallback((config) => {
    const url = new URL(window.location.href);
    if (config && config.length > 0) {
      url.searchParams.set('sort', encodeURIComponent(JSON.stringify(config)));
    } else {
      url.searchParams.delete('sort');
    }
    window.history.replaceState({}, '', url);
  }, []);

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

  const clearAllSorts = useCallback(() => {
    setSortConfig([]);
    sortConfigRef.current = [];
    saveSortToUrl([]);
  }, [saveSortToUrl]);

  const getColumnSortState = useCallback((columnKey) => {
    const index = sortConfig.findIndex(item => item.key === columnKey);
    if (index === -1) return { active: false, direction: null, order: null };
    return { active: true, direction: sortConfig[index].direction, order: index + 1 };
  }, [sortConfig]);

  const getSortedData = useCallback((data) => {
    if (!sortConfig || sortConfig.length === 0) return data;
    return [...data].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
        let aValue = a[key];
        let bValue = b[key];
        if (key === 'submitTime') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        } else if (key === 'resumeScore') {
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
          const recommendationRank = { '强烈推荐': 4, '推荐': 3, '待考虑': 2, '建议淘汰': 1 };
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
  }, [sortConfig]);

  const buildCandidatesSnapshot = useCallback((candidateList = []) => (
    JSON.stringify(candidateList.map(candidate => ({
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
    })))
  ), []);

  useEffect(() => {
    candidatesLengthRef.current = candidates.length;
    candidatesSnapshotRef.current = buildCandidatesSnapshot(candidates);
  }, [buildCandidatesSnapshot, candidates]);

  const loadCandidates = async ({ silent = false, normalizeResumeFiles = false } = {}) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');

      if (dataParam) {
        try {
          const urlData = JSON.parse(decodeURIComponent(dataParam));
          setCandidates(urlData);
          if (!silent) message.success(`已从URL参数加载 ${urlData.length} 条候选人数据`);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        } catch (error) {
          console.error('解析URL参数失败:', error);
        }
      }

      const serverData = await serverDataSync.getAllCandidates({ normalizeResumeFiles });
      if (serverData.length > 0) {
        setCandidates(serverData);
        if (!silent) message.success(`已从服务器加载 ${serverData.length} 条候选人数据`);
        return;
      }

      const indexedData = await candidateDB.getAllCandidates();
      setCandidates(indexedData);

      if (indexedData.length > 0) {
        if (!silent) message.success(`已从IndexedDB加载 ${indexedData.length} 条候选人数据`);
      } else if (!silent) {
        message.info('暂无候选人数据，请等待候选人提交申请');
      }
    } catch (error) {
      console.error('加载候选人数据失败:', error);
      message.error('加载数据失败，请刷新页面重试');
    }
  };

  const handleResumeReanalysis = async (candidate, mode = 'default') => {
    if (!candidate?.id || reanalyzingCandidateId) return;

    const loadingKey = `resume-reanalysis-${candidate.id}`;
    setReanalyzingCandidateId(candidate.id);

    const modeLabels = { 'default': '默认模式', 'local-vl': 'Qwen3.5-9B多模态模型', 'deepseek': 'DeepSeek API' };

    message.loading({ content: `正在使用${modeLabels[mode]}重新分析简历，请稍候...`, key: loadingKey, duration: 0 });

    try {
      setCandidates(prev => prev.map(item =>
        item.id === candidate.id ? {
          ...item,
          status: 'Qwen3.5-9B排队中',
          recommendation: '正在加入Qwen3.5-9B串行队列',
          resumeAnalysis: null,
          resumeAnalysisResult: null,
          analysisDetails: { ...item.analysisDetails, resumeAnalysis: null }
        } : item
      ));

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
        content: result?.queued ? `已加入后台分析队列，结果会自动刷新` : '简历重新分析完成',
        key: loadingKey
      });
      await loadCandidates({ silent: true });
    } catch (error) {
      console.error('重新分析失败:', error);
      message.error({ content: error.message || '重新分析失败', key: loadingKey });
      await loadCandidates({ silent: true });
    } finally {
      setReanalyzingCandidateId(null);
    }
  };

  useEffect(() => {
    loadCandidates({ silent: true });

    const refreshInterval = setInterval(async () => {
      if (isDeletingRef.current) return;

      try {
        const serverData = await serverDataSync.getAllCandidates();
        const serverSnapshot = buildCandidatesSnapshot(serverData);

        if (serverData.length > 0 && (
          serverData.length !== candidatesLengthRef.current ||
          serverSnapshot !== candidatesSnapshotRef.current
        )) {
          setCandidates(serverData);
          if (selectedCandidate?.id) {
            const refreshed = serverData.find(item => item.id === selectedCandidate.id);
            if (refreshed) setSelectedCandidate(refreshed);
          }
          message.success('实时更新：候选人数据已同步');
        }
      } catch (error) {
        console.error('定期刷新失败:', error);
      }
    }, 3000);

    return () => clearInterval(refreshInterval);
  }, [buildCandidatesSnapshot, selectedCandidate?.id]);

  useEffect(() => {
    const handleInterviewScoreSaved = async () => {
      if (selectedCandidate?.id) {
        try {
          const serverData = await serverDataSync.getAllCandidates();
          const refreshed = serverData.find(item => item.id === selectedCandidate.id);
          if (refreshed) {
            setSelectedCandidate(refreshed);
          }
        } catch (error) {
          console.error('刷新面试分数失败:', error);
        }
      }
    };

    window.addEventListener('interviewScoreSaved', handleInterviewScoreSaved);
    return () => window.removeEventListener('interviewScoreSaved', handleInterviewScoreSaved);
  }, [selectedCandidate?.id]);

  const refreshCandidates = async () => {
    try {
      const serverData = await serverDataSync.getAllCandidates({ normalizeResumeFiles: true });
      if (serverData.length > 0) {
        setCandidates(serverData);
        message.success(`已从服务器刷新 ${serverData.length} 条数据`);
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
    let successCount = 0, skipCount = 0, errorCount = 0;

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
        if (result) successCount++;
      } catch (err) {
        if (err.message?.includes('已存在') || err.message?.includes('409')) {
          skipCount++;
        } else {
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

  const cleanupInvalidCandidates = async () => {
    if (cleanupLoading) return;

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

      Modal.confirm({
        title: '确认清理异常候选人',
        content: `检测到 ${invalidCandidates.length} 条异常候选人记录。继续将删除这些记录，此操作不可恢复。`,
        okText: '继续',
        cancelText: '取消',
        async onOk() {
          Modal.confirm({
            title: '二次确认',
            content: `本次将删除 ${invalidCandidates.length} 条异常候选人记录，此操作不可恢复。`,
            okText: '确认清理',
            okType: 'danger',
            cancelText: '取消',
            async onOk() {
              try {
                const result = await serverDataSync.cleanupInvalidCandidates();
                if (!result?.success) throw new Error('清理失败');

                const serverData = await serverDataSync.getAllCandidates();
                setCandidates(serverData);
                await candidateDB.clearAll();
                for (const c of serverData) await candidateDB.addCandidate(c);

                if (selectedCandidate && result.removedCandidates?.some(c => c.id === selectedCandidate.id)) {
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
            onCancel() { setCleanupLoading(false); }
          });
        },
        onCancel() { setCleanupLoading(false); }
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
          <p style={{ marginTop: '10px', color: colors.danger }}>此操作不可恢复，请确认！</p>
        </div>
      ),
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          isDeletingRef.current = true;
          message.loading({ content: '正在安全清理后台分析任务并清空所有数据...', key: 'clear-all-candidates', duration: 0 });

          const result = await serverDataSync.clearAllCandidates();

          if (result) {
            await candidateDB.clearAll();
            setCandidates([]);
            setSelectedCandidate(null);
            setDetailModalVisible(false);
            setReanalyzingCandidateId(null);

            const cancelledCount = Number(result.cancelledAnalysisJobs || 0);
            const restartedVlContainer = Boolean(result.restartedVlContainer);

            message.success({
              key: 'clear-all-candidates',
              content: cancelledCount > 0
                ? `所有数据已清空，已安全停止 ${cancelledCount} 个后台分析任务${restartedVlContainer ? '，本地VL服务已重启' : ''}`
                : `所有数据已从服务器清空！${restartedVlContainer ? ' 本地VL服务已同步重启。' : ''}`
            });
          } else {
            throw new Error('服务器返回失败');
          }
        } catch (error) {
          console.error('清空数据失败:', error);
          message.error({ key: 'clear-all-candidates', content: '清空数据失败，请重试' });
        } finally {
          setTimeout(() => { isDeletingRef.current = false; }, 2000);
        }
      },
    });
  };

  const handleViewDetail = (record) => {
    setSelectedCandidate(record);
    setDetailModalVisible(true);
  };

  const handlePreviewResume = (record) => {
    if (record.resumeFileName) {
      setPreviewResume(record);
      setPdfPreviewVisible(true);
    } else {
      message.error('简历文件不存在');
    }
  };

  const handleDownloadResume = async (record) => {
    if (!record.id) {
      message.error('候选人ID不存在');
      return;
    }

    try {
      const response = await axios({
        method: 'GET',
        url: `/api/download-resume/${record.id}`,
        responseType: 'blob',
        timeout: 30000,
        headers: { 'Accept': 'application/pdf,application/octet-stream,*/*' }
      });

      if (!response.data || response.data.size === 0) {
        throw new Error('下载的文件为空');
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const contentType = response.headers['content-type'] || 'application/pdf';
      const defaultExt = contentType.includes('image/jpeg') ? '.jpg' : '.pdf';
      link.download = record.resumeFileName || `简历_${record.name}${defaultExt}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success(`正在下载 ${record.name} 的简历`);
    } catch (error) {
      console.error('API下载失败:', error);
      if (record.resumeFileName) {
        try {
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
          message.error(`下载失败: ${error.response?.status || error.message}`);
        }
      } else {
        message.error(`下载失败: ${error.response?.status || error.message}`);
      }
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
          const serverDeleteResult = await serverDataSync.deleteCandidate(candidateId);

          if (serverDeleteResult) {
            const updatedCandidates = candidates.filter(c => c.id !== candidateId);
            setCandidates(updatedCandidates);
            message.success('候选人数据已删除！');
          } else {
            throw new Error('服务器删除失败');
          }
        } catch (error) {
          console.error('删除候选人数据失败:', error);
          message.error('删除数据失败，请重试');
        } finally {
          setTimeout(() => { isDeletingRef.current = false; }, 2000);
        }
      },
    });
  };

  const SortableHeader = ({ title, columnKey }) => {
    const { active, direction, order } = getColumnSortState(columnKey);
    return (
      <SortHeader onClick={() => handleMultiSort(columnKey)}>
        <span>{title}</span>
        <span style={{ display: 'flex', flexDirection: 'column', opacity: active ? 1 : 0.3 }}>
          <IconArrowUp size={8} color={direction === 'ascend' && active ? colors.highlight : 'inherit'} />
          <IconArrowDown size={8} color={direction === 'descend' && active ? colors.highlight : 'inherit'} />
        </span>
        {active && order > 1 && <SortBadge>{order}</SortBadge>}
      </SortHeader>
    );
  };

  const filteredCandidates = useMemo(() => {
    let result = candidates;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(c =>
        (c.name?.toLowerCase().includes(lower)) ||
        (c.phone?.toLowerCase().includes(lower)) ||
        (c.email?.toLowerCase().includes(lower)) ||
        (c.position?.toLowerCase().includes(lower)) ||
        (c.resumeFileName?.toLowerCase().includes(lower))
      );
    }
    if (positionFilter) {
      result = result.filter(c => c.position === positionFilter);
    }
    return result;
  }, [candidates, searchText, positionFilter]);

  const sortedCandidates = useMemo(() => getSortedData(filteredCandidates), [filteredCandidates, getSortedData]);

  const statistics = useMemo(() => {
    const statsResult = getCandidateStats(candidates);
    return {
      total: statsResult.totalCandidates,
      analyzed: candidates.filter(c => ['已分析', '已分析(VL)', '已分析(local-VL)', '已分析(Qwen3.5-9B)'].includes(c.status)).length,
      recommended: statsResult.recommendedCandidates,
      avgScore: statsResult.averageResumeScore
    };
  }, [candidates]);

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (text, record) => (
        <CandidateName>
          <Avatar style={{ width: '28px', height: '28px', fontSize: '12px' }}><IconUser size={14} /></Avatar>
          <NameText style={{ fontSize: '13px' }}>{text || '未填写'}</NameText>
        </CandidateName>
      ),
    },
    {
      title: '应聘职位',
      dataIndex: 'position',
      key: 'position',
      width: 100,
      render: (text) => <PositionTag style={{ fontSize: '11px', padding: '2px 8px' }}>{text || '未填写'}</PositionTag>,
    },
    {
      title: 'MBTI',
      dataIndex: 'mbti',
      key: 'mbti',
      width: 60,
      align: 'center',
      render: (text) => text ? <MBTITag style={{ fontSize: '11px', padding: '2px 8px' }}>{text}</MBTITag> : <TimeText>-</TimeText>,
    },
    {
      title: <SortableHeader title="简历评分" columnKey="resumeScore" />,
      key: 'resumeScore',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const resumeScore = getResumeScoreFromRecord(record);
        if (!resumeScore || resumeScore === 0) {
          return <TimeText>-</TimeText>;
        }
        const { color, rgb } = getScoreColor(resumeScore);
        return <ScoreCircle style={{ width: '36px', height: '36px', fontSize: '12px' }} $color={color} $rgb={rgb}>{resumeScore}</ScoreCircle>;
      },
    },
    {
      title: <SortableHeader title="综合评分" columnKey="finalScore" />,
      dataIndex: 'finalScore',
      key: 'finalScore',
      width: 80,
      align: 'center',
      render: (score, record) => {
        if (record.hasInterview && score) {
          const { color, rgb } = getScoreColor(score);
          return <ScoreCircle style={{ width: '36px', height: '36px', fontSize: '12px' }} $color={color} $rgb={rgb}>{score}</ScoreCircle>;
        }
        return <TimeText>-</TimeText>;
      },
    },
    {
      title: <SortableHeader title="推荐等级" columnKey="recommendation" />,
      key: 'recommendation',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const resumeScore = getResumeScoreFromRecord(record);
        if (!resumeScore || resumeScore === 0) {
          return <TimeText>-</TimeText>;
        }
        const label = getRecommendationLabelFromRecord(record);
        return <RecommendationTag style={{ fontSize: '11px', padding: '2px 8px' }} $level={label}>{label}</RecommendationTag>;
      },
    },
    {
      title: <SortableHeader title="提交时间" columnKey="submitTime" />,
      dataIndex: 'submitTime',
      key: 'submitTime',
      width: 120,
      render: (text) => text ? <TimeText style={{ fontSize: '12px' }}>{text}</TimeText> : <TimeText>-</TimeText>,
    },
    {
      title: '面试',
      dataIndex: 'hasInterview',
      key: 'hasInterview',
      width: 80,
      align: 'center',
      render: (hasInterview, record) => {
        if (hasInterview) {
          return <StatusBadge $type="analyzed" style={{ fontSize: '11px', padding: '2px 8px' }}>已完成</StatusBadge>;
        }
        return (
          <InterviewButton
            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
            onClick={() => {
              const candidateInfo = { id: record.id, name: record.name, position: record.position };
              window.open(`/chat?candidate=${encodeURIComponent(JSON.stringify(candidateInfo))}`, '_blank');
            }}
          >
            去面试
          </InterviewButton>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <ActionGroup>
          <ActionRow>
            <SmallButton icon={<IconEye />} onClick={() => handleViewDetail(record)} style={{ height: '24px', fontSize: '11px' }}>详情</SmallButton>
            <SmallButton icon={<IconDocument />} onClick={() => handlePreviewResume(record)} style={{ height: '24px', fontSize: '11px' }}>预览</SmallButton>
          </ActionRow>
          <ActionRow>
            <SmallButton icon={<IconDownload />} onClick={() => handleDownloadResume(record)} style={{ height: '24px', fontSize: '11px' }}>下载</SmallButton>
            <SmallButton icon={<IconTrash />} onClick={() => deleteCandidate(record.id)} danger style={{ height: '24px', fontSize: '11px' }}>删除</SmallButton>
          </ActionRow>
        </ActionGroup>
      ),
    },
  ];

  const uniquePositions = useMemo(() => {
    const positions = [...new Set(candidates.map(c => c.position).filter(Boolean))];
    return positions;
  }, [candidates]);

  return (
    <PageWrapper>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${colors.bg}; }
        ::-webkit-scrollbar-thumb { background: ${colors.border}; }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <PageHeader>
        <HeaderContent>
          <HeaderLeft>
            <PageTitle>候选管理</PageTitle>
            <PageSubtitle>查看和管理候选人简历分析结果，支持智能筛选与评估</PageSubtitle>
          </HeaderLeft>
          <HeaderActions>
            <input
              type="file"
              ref={uploadFileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              onChange={handleUploadResume}
            />
            <ActionButton $primary icon={<IconUpload />} onClick={() => uploadFileInputRef.current?.click()} loading={uploadLoading}>
              上传简历
            </ActionButton>
          </HeaderActions>
        </HeaderContent>
      </PageHeader>

      <MainContent>
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <StatsGrid>
            <StatCard variants={fadeInUp}>
              <StatLabel>总申请数</StatLabel>
              <StatValue>{statistics.total}</StatValue>
              <StatIndicator>
                <IconUser size={13} /> 位候选人
              </StatIndicator>
            </StatCard>
            <StatCard variants={fadeInUp}>
              <StatLabel>已分析</StatLabel>
              <StatValue>{statistics.analyzed}</StatValue>
              <StatIndicator $color={colors.success}>
                <IconTrophy size={13} /> 分析完成
              </StatIndicator>
            </StatCard>
            <StatCard variants={fadeInUp}>
              <StatLabel>强烈推荐</StatLabel>
              <StatValue>{statistics.recommended}</StatValue>
              <StatIndicator $color={colors.highlight}>
                <IconDocument size={13} /> 待面试
              </StatIndicator>
            </StatCard>
          </StatsGrid>
        </motion.div>

        <FilterBar>
          <FilterLeft>
            <SearchInput
              placeholder="搜索姓名、职位、邮箱..."
              prefix={<IconSearch size={14} color={colors.textMuted} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <FilterSelect
              placeholder="筛选职位"
              allowClear
              value={positionFilter}
              onChange={setPositionFilter}
              style={{ width: 160 }}
            >
              {uniquePositions.map(pos => (
                <Option key={pos} value={pos}>{pos}</Option>
              ))}
            </FilterSelect>
          </FilterLeft>
          <FilterRight>
            <ActionButton icon={<IconSync size={14} spin={loading} />} onClick={refreshCandidates} loading={loading}>
              刷新数据
            </ActionButton>
            <DangerButton icon={<IconFilter size={14} />} onClick={cleanupInvalidCandidates} loading={cleanupLoading}>
              清除异常
            </DangerButton>
            <DangerButton icon={<IconTrash size={14} />} onClick={clearAllData}>
              清空所有
            </DangerButton>
          </FilterRight>
        </FilterBar>

        <AnimatePresence>
          {sortConfig.length > 0 && (
            <MultiSortHint
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <IconSwap size={14} />
              <span className="sort-info">
                当前排序：
                {sortConfig.map((item, index) => {
                  const names = { resumeScore: '简历评分', matchScore: '匹配评分', finalScore: '综合评分', recommendation: '推荐等级', submitTime: '提交时间' };
                  return `${names[item.key] || item.key} ${item.direction === 'ascend' ? '↑' : '↓'}`;
                }).join(' → ')}
              </span>
              <span className="clear-btn" onClick={clearAllSorts}>清除排序</span>
            </MultiSortHint>
          )}
        </AnimatePresence>

        <TableWrapper>
          <StyledTable
            columns={columns}
            dataSource={sortedCandidates}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{
              emptyText: (
                <EmptyState>
                  <EmptyIcon><IconUser size={48} /></EmptyIcon>
                  <EmptyTitle>暂无候选人数据</EmptyTitle>
                  <EmptyDesc>请等待候选人扫描二维码提交申请</EmptyDesc>
                </EmptyState>
              )
            }}
            pagination={{
              pageSize: pageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
          />
        </TableWrapper>
      </MainContent>

      <CandidateDetailModal
        visible={detailModalVisible}
        candidate={selectedCandidate}
        onClose={() => { setDetailModalVisible(false); setSelectedCandidate(null); }}
        onRefreshAnalysis={handleResumeReanalysis}
        refreshingAnalysis={reanalyzingCandidateId === selectedCandidate?.id}
      />

      <Modal
        title={`预览简历 - ${previewResume?.name}`}
        open={pdfPreviewVisible}
        onCancel={() => setPdfPreviewVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: '1000px' }}
        centered
      >
        {previewResume && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ padding: '20px', background: colors.bgSecondary, borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{previewResume.name}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {previewResume.position && <Tag>{previewResume.position}</Tag>}
                {previewResume.mbti && <Tag color="gold">{previewResume.mbti}</Tag>}
              </div>
            </div>
            <div style={{ height: '600px', borderRadius: '12px', overflow: 'hidden', background: colors.bg }}>
              {previewResume.resumeFilePath ? (
                previewResume.resumeFileName?.endsWith('.pdf') ? (
                  <iframe src={`${serverDataSync.baseUrl}/resume-file/${previewResume.id}`} width="100%" height="100%" style={{ border: 'none' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
                    <IconDocument size={48} color={colors.textMuted} />
                    <Button type="primary" onClick={() => window.open(`${serverDataSync.baseUrl}/resume-file/${previewResume.id}`, '_blank')}>
                      打开文件
                    </Button>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '8px', color: colors.textMuted }}>
                  <IconDocument size={48} />
                  <span>简历文件未上传</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
};

export default ResumeAnalysis;
