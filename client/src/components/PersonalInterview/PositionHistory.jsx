/**
 * 岗位历史列表组件
 * 显示用户保存的岗位历史
 */
import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';

// ============================================
// STYLED COMPONENTS
// ============================================
const HistoryWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HistoryCard = styled(motion.div)`
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    border-color: ${colors.accent};
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PositionName = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CompanyName = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
  margin-bottom: 8px;
`;

const Description = styled.div`
  font-size: 13px;
  color: ${colors.textSecondary};
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${colors.textMuted};

  .anticon {
    font-size: 12px;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;

  ${HistoryCard}:hover & {
    opacity: 1;
  }
`;

const ActionBtn = styled.button`
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: ${colors.textMuted};
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: ${colors.frost};
    color: ${props => props.$danger ? colors.error : colors.accent};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: ${colors.textMuted};
`;

const EmptyIcon = styled.div`
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 14px;
`;

// ============================================
// COMPONENT
// ============================================
const PositionHistory = ({
  positions = [],
  onSelect,
  onEdit,
  onDelete,
  loading = false
}) => {
  if (loading) {
    return (
      <EmptyState>
        <EmptyIcon>⏳</EmptyIcon>
        <EmptyText>加载中...</EmptyText>
      </EmptyState>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon>📋</EmptyIcon>
        <EmptyText>暂无保存的岗位信息</EmptyText>
      </EmptyState>
    );
  }

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <HistoryWrapper>
      <AnimatePresence>
        {positions.map((position, index) => (
          <HistoryCard
            key={position.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            onClick={() => onSelect?.(position)}
          >
            <CardHeader>
              <CardInfo>
                <PositionName>{position.positionName}</PositionName>
                {position.companyName && (
                  <CompanyName>{position.companyName}</CompanyName>
                )}
                <Description>{position.description}</Description>
              </CardInfo>
              <ActionButtons onClick={(e) => e.stopPropagation()}>
                <ActionBtn onClick={() => onEdit?.(position)} title="编辑">
                  <EditOutlined />
                </ActionBtn>
                <ActionBtn $danger onClick={() => onDelete?.(position.id)} title="删除">
                  <DeleteOutlined />
                </ActionBtn>
              </ActionButtons>
            </CardHeader>
            <CardMeta>
              <MetaItem>
                <ClockCircleOutlined />
                {formatDate(position.lastUsedAt || position.createdAt)}
              </MetaItem>
              {position.usageCount > 0 && (
                <MetaItem>
                  使用 {position.usageCount} 次
                </MetaItem>
              )}
            </CardMeta>
          </HistoryCard>
        ))}
      </AnimatePresence>
    </HistoryWrapper>
  );
};

export default PositionHistory;
