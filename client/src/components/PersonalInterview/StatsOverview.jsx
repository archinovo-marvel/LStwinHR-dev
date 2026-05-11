/**
 * 统计概览组件
 * 显示用户的训练统计数据
 */
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { TrophyOutlined, ClockCircleOutlined, RiseOutlined, FireOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';
import { formatDuration, getGradeLabel, getGradeColor } from '../../utils/personalInterviewApi';

// ============================================
// STYLED COMPONENTS
// ============================================
const StatsWrapper = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const StatsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${colors.border};
`;

const StatsIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 18px;
    color: ${colors.accent};
  }
`;

const StatsTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${colors.text};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: ${colors.frost};
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${props => props.$bg || colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 18px;
    color: ${props => props.$color || colors.accent};
  }
`;

const StatInfo = styled.div`
  flex: 1;
`;

const StatValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 700;
  color: ${colors.text};
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
  margin-top: 2px;
`;

const HighlightCard = styled(StatCard)`
  grid-column: span 2;

  @media (max-width: 480px) {
    grid-column: span 1;
  }
`;

const HighlightContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ScoreDisplay = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const ScoreValue = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.$color || colors.accent};
`;

const ScoreGrade = styled.span`
  font-size: 16px;
  font-weight: 500;
  color: ${props => props.$color || colors.accent};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: ${colors.textMuted};
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 14px;
`;

// ============================================
// COMPONENT
// ============================================
const StatsOverview = ({
  stats,
  loading = false
}) => {
  if (loading) {
    return (
      <StatsWrapper>
        <StatsHeader>
          <StatsIcon>
            <TrophyOutlined />
          </StatsIcon>
          <StatsTitle>训练数据</StatsTitle>
        </StatsHeader>
        <EmptyState>
          <EmptyIcon>⏳</EmptyIcon>
          <EmptyText>加载中...</EmptyText>
        </EmptyState>
      </StatsWrapper>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <StatsWrapper
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <StatsHeader>
          <StatsIcon>
            <TrophyOutlined />
          </StatsIcon>
          <StatsTitle>训练数据</StatsTitle>
        </StatsHeader>
        <EmptyState>
          <EmptyIcon>📊</EmptyIcon>
          <EmptyText>暂无训练数据，开始你的第一次模拟面试吧！</EmptyText>
        </EmptyState>
      </StatsWrapper>
    );
  }

  const avgScore = stats.averageScore || 0;
  const avgGrade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'E';

  return (
    <StatsWrapper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <StatsHeader>
        <StatsIcon>
          <TrophyOutlined />
        </StatsIcon>
        <StatsTitle>训练数据</StatsTitle>
      </StatsHeader>

      <StatsGrid>
        {/* 平均分 - 高亮卡片 */}
        <HighlightCard>
          <StatIcon $bg={colors.accentSub} $color={colors.accent}>
            <TrophyOutlined />
          </StatIcon>
          <HighlightContent>
            <StatInfo>
              <StatLabel>平均得分</StatLabel>
            </StatInfo>
            <ScoreDisplay>
              <ScoreValue $color={getGradeColor(avgGrade)}>
                {avgScore.toFixed(1)}
              </ScoreValue>
              <ScoreGrade $color={getGradeColor(avgGrade)}>
                {getGradeLabel(avgGrade)}
              </ScoreGrade>
            </ScoreDisplay>
          </HighlightContent>
        </HighlightCard>

        {/* 总面试次数 */}
        <StatCard>
          <StatIcon $bg="rgba(34, 197, 94, 0.1)" $color={colors.success}>
            <FireOutlined />
          </StatIcon>
          <StatInfo>
            <StatValue>{stats.totalSessions}</StatValue>
            <StatLabel>总面试次数</StatLabel>
          </StatInfo>
        </StatCard>

        {/* 完成次数 */}
        <StatCard>
          <StatIcon $bg="rgba(59, 130, 246, 0.1)" $color={colors.accent}>
            <TrophyOutlined />
          </StatIcon>
          <StatInfo>
            <StatValue>{stats.completedSessions}</StatValue>
            <StatLabel>完成次数</StatLabel>
          </StatInfo>
        </StatCard>

        {/* 最高分 */}
        <StatCard>
          <StatIcon $bg="rgba(245, 158, 11, 0.1)" $color={colors.warning}>
            <RiseOutlined />
          </StatIcon>
          <StatInfo>
            <StatValue>{stats.highestScore?.toFixed(1) || '-'}</StatValue>
            <StatLabel>最高得分</StatLabel>
          </StatInfo>
        </StatCard>

        {/* 总时长 */}
        <StatCard>
          <StatIcon $bg="rgba(139, 92, 246, 0.1)" $color="#8B5CF6">
            <ClockCircleOutlined />
          </StatIcon>
          <StatInfo>
            <StatValue>{formatDuration(stats.totalDuration)}</StatValue>
            <StatLabel>总训练时长</StatLabel>
          </StatInfo>
        </StatCard>
      </StatsGrid>
    </StatsWrapper>
  );
};

export default StatsOverview;