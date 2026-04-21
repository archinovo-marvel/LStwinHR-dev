import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, Card, Tag, Space, Typography, message } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import serverDataSync from '../utils/serverDataSync';

const { Option } = Select;
const { Search } = Input;
const { Text } = Typography;

import { colors } from '../theme/colors';

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
    border-radius: 16px 16px 0 0;
    padding: 24px 28px 20px;
    border-bottom: 1px solid ${colors.divider};
    margin: 0;
  }

  .ant-modal-title {
    font-family: 'Noto Serif SC', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: ${colors.title};
  }
`;

const ModalHeader = styled.div`
  padding: 28px 28px 20px;
  border-bottom: 1px solid ${colors.border};
`;

const ModalTitle = styled.h3`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  color: ${colors.title};
  margin: 0 0 4px 0;
`;

const ModalSubtitle = styled.p`
  font-size: 14px;
  color: ${colors.textMuted};
  margin: 0;
`;

const ModalBody = styled.div`
  padding: 24px 28px;
`;

const SearchRow = styled.div`
  margin-bottom: 20px;
`;

const StyledSearch = styled(Input)`
  height: 44px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  padding: 0 16px;
  font-size: 14px;
  transition: all 0.25s ease;

  &:hover, &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px ${colors.primaryLight};
  }

  .ant-input-prefix {
    color: ${colors.textMuted};
    margin-right: 12px;
  }
`;

const StyledSelect = styled(Select)`
  .ant-select-selector {
    height: 44px !important;
    border-radius: 10px !important;
    border: 1px solid ${colors.border} !important;
    padding: 4px 12px !important;

    &:hover, &:focus {
      border-color: ${colors.primary} !important;
      box-shadow: 0 0 0 3px ${colors.primaryLight} !important;
    }
  }

  .ant-select-selection-item {
    line-height: 34px !important;
    font-size: 14px;
  }
`;

const FilterRow = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const CandidateList = styled.div`
  max-height: 420px;
  overflow-y: auto;
  margin: 0 -28px;
  padding: 0 28px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${colors.bg};
  }

  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 3px;
  }
`;

const CandidateCard = styled(motion.div)`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: ${colors.highlight};
    box-shadow: 0 4px 20px rgba(74, 158, 207, 0.12);
    transform: translateY(-2px);
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const CandidateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const CandidateInfo = styled.div`
  flex: 1;
`;

const CandidateName = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`;

const NameText = styled.span`
  font-size: 16px;
  font-weight: 500;
  color: ${colors.title};
`;

const CandidateMeta = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
  line-height: 1.6;

  span {
    margin-right: 16px;
  }
`;

const ScoreSection = styled.div`
  text-align: right;
`;

const ScoreTag = styled(Tag)`
  border-radius: 6px;
  font-size: 13px;
  padding: 4px 10px;
`;

const SecondaryTag = styled(Tag)`
  border-radius: 6px;
  font-size: 12px;
  padding: 2px 8px;
  margin-top: 6px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: ${colors.textMuted};
`;

const FooterRow = styled.div`
  text-align: center;
  padding: 16px 28px 24px;
  border-top: 1px solid ${colors.divider};
  margin-top: 16px;
`;

const FooterText = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
`;

const CandidateSelector = ({ visible, onSelect, onCancel }) => {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');

  useEffect(() => {
    if (visible) {
      fetchCandidates();
    }
  }, [visible]);

  useEffect(() => {
    filterCandidates();
  }, [candidates, searchText, selectedPosition]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const serverCandidates = await serverDataSync.getAllCandidates();
      setCandidates(Array.isArray(serverCandidates) ? serverCandidates : []);
    } catch (error) {
      console.error('获取候选人列表失败:', error);
      message.error('获取候选人列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterCandidates = () => {
    let filtered = candidates;

    if (searchText) {
      filtered = filtered.filter(candidate =>
        candidate.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (selectedPosition) {
      filtered = filtered.filter(candidate =>
        candidate.position === selectedPosition
      );
    }

    setFilteredCandidates(filtered);
  };

  const handleSelect = (candidate) => {
    onSelect(candidate);
  };

  const getPositionOptions = () => {
    const positions = [...new Set(candidates.map(c => c.position))];
    return positions;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10B981';
    if (score >= 80) return '#4A9ECF';
    if (score >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreText = (score) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '待提升';
  };

  return (
    <StyledModal
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={820}
      closable={true}
      maskClosable={true}
      destroyOnClose
    >
      <ModalHeader>
        <ModalTitle>选择候选人</ModalTitle>
        <ModalSubtitle>选择一位候选人开始AI面试</ModalSubtitle>
      </ModalHeader>

      <ModalBody>
        <FilterRow>
          <StyledSearch
            placeholder="搜索候选人姓名"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
          <StyledSelect
            placeholder="选择岗位"
            value={selectedPosition}
            onChange={setSelectedPosition}
            style={{ width: 180 }}
            allowClear
          >
            {getPositionOptions().map(position => (
              <Option key={position} value={position}>
                {position}
              </Option>
            ))}
          </StyledSelect>
        </FilterRow>

        <CandidateList>
          {loading ? (
            <EmptyState>加载中...</EmptyState>
          ) : filteredCandidates.length === 0 ? (
            <EmptyState>没有找到符合条件的候选人</EmptyState>
          ) : (
            filteredCandidates.map((candidate, index) => (
              <CandidateCard
                key={candidate.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                onClick={() => handleSelect(candidate)}
              >
                <CandidateHeader>
                  <CandidateInfo>
                    <CandidateName>
                      <UserOutlined style={{ color: colors.highlight, fontSize: 16 }} />
                      <NameText>{candidate.name}</NameText>
                      <Tag color="blue" style={{ borderRadius: 6 }}>{candidate.position}</Tag>
                    </CandidateName>
                    <CandidateMeta>
                      <span>电话: {candidate.phone}</span>
                      <span>邮箱: {candidate.email}</span>
                    </CandidateMeta>
                    <CandidateMeta style={{ marginTop: 4 }}>
                      <span>MBTI: {candidate.mbti}</span>
                      <span>提交: {candidate.submitTime}</span>
                    </CandidateMeta>
                  </CandidateInfo>
                  <ScoreSection>
                    <ScoreTag color={getScoreColor(parseInt(candidate.matchScore))}>
                      简历评分: {candidate.matchScore}分
                    </ScoreTag>
                    <div style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {getScoreText(parseInt(candidate.matchScore))}
                      </Text>
                    </div>
                    {candidate.interviewScore && (
                      <SecondaryTag color={getScoreColor(candidate.interviewScore)}>
                        面试: {candidate.interviewScore}分
                      </SecondaryTag>
                    )}
                  </ScoreSection>
                </CandidateHeader>
              </CandidateCard>
            ))
          )}
        </CandidateList>
      </ModalBody>

      <FooterRow>
        <FooterText>
          共找到 {filteredCandidates.length} 位候选人
        </FooterText>
      </FooterRow>
    </StyledModal>
  );
};

export default CandidateSelector;
