/**
 * AI 模拟面试历史记录页面
 * 显示用户的面试历史列表
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Select, Spin, Tag } from 'antd';
import { App } from 'antd';
import {
  ClockCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme/colors';
import { StatsOverview } from '../components/PersonalInterview';
import {
  getSessions,
  cancelSession,
  formatDateTime,
  formatDuration,
  getGradeLabel,
  getGradeColor,
  getDifficultyLabel,
  getDifficultyColor,
  getStatusLabel,
  getStatusColor,
  getStats
} from '../utils/personalInterviewApi';

// ============================================
// STYLED COMPONENTS
// ============================================
const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 80px 40px 60px;

  @media (max-width: 768px) {
    padding: 60px 20px 40px;
  }
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const BackButton = styled(Button)`
  color: ${colors.textSecondary};
  border-color: ${colors.border};

  &:hover {
    color: ${colors.accent};
    border-color: ${colors.accent};
  }
`;

const PageTitle = styled.h1`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 28px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0;
`;

const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: ${colors.surface};
  border-radius: 12px;
  border: 1px solid ${colors.border};
`;

const FilterLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: ${colors.textMuted};

  .anticon {
    color: ${colors.accent};
  }
`;

const StatsSection = styled(motion.div)`
  margin-bottom: 32px;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const HistoryCard = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 24px;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    border-color: ${colors.accent};
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    transform: translateY(-2px);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const CardInfo = styled.div`
  flex: 1;
`;

const PositionName = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 8px;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CardScore = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
`;

const ScoreValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.$color || colors.accent};
`;

const ScoreGrade = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$color || colors.accent};
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid ${colors.border};
`;

const StatusTag = styled(Tag)`
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  border: none;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled(Button)`
  font-size: 13px;
`;

const EmptyWrapper = styled.div`
  padding: 60px 20px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 16px;
  color: ${colors.textMuted};
  margin-bottom: 24px;
`;

const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
`;

// ============================================
// COMPONENT
// ============================================
const PersonalInterviewHistoryPage = () => {
  const navigate = useNavigate();
  const { message: messageApi, modal } = App.useApp();

  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setStatsLoading(true);

    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
      const [sessionsData, statsData] = await Promise.all([
        getSessions(filters),
        getStats()
      ]);
      setSessions(sessionsData);
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      messageApi.error('加载数据失败');
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  const handleViewReport = (sessionId) => {
    navigate(`/personal/interview/report/${sessionId}`);
  };

  const handleDeleteSession = (sessionId) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这条面试记录吗？删除后无法恢复。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelSession(sessionId);
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          messageApi.success('删除成功');
        } catch (error) {
          messageApi.error('删除失败');
        }
      }
    });
  };

  const handleBackToHub = () => {
    navigate('/personal/interview');
  };

  const handleStartNew = () => {
    navigate('/personal/interview');
  };

  return (
    <PageWrapper>
      <Container>
        {/* 页面标题 */}
        <PageHeader>
          <HeaderLeft>
            <BackButton
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToHub}
            />
            <PageTitle>面试历史记录</PageTitle>
          </HeaderLeft>
        </PageHeader>

        {/* 统计数据 */}
        <StatsSection
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StatsOverview stats={stats} loading={statsLoading} />
        </StatsSection>

        {/* 筛选条件 */}
        <FilterSection>
          <FilterLabel>
            <FilterOutlined />
            状态筛选
          </FilterLabel>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'completed', label: '已完成' },
              { value: 'in_progress', label: '进行中' },
              { value: 'cancelled', label: '已取消' }
            ]}
          />
        </FilterSection>

        {/* 历史列表 */}
        {loading ? (
          <LoadingWrapper>
            <Spin size="large" />
          </LoadingWrapper>
        ) : sessions.length === 0 ? (
          <EmptyWrapper>
            <EmptyIcon>📋</EmptyIcon>
            <EmptyText>
              {statusFilter !== 'all' ? '没有符合条件的记录' : '暂无面试记录，开始你的第一次模拟面试吧！'}
            </EmptyText>
            <Button type="primary" onClick={handleStartNew}>
              开始面试
            </Button>
          </EmptyWrapper>
        ) : (
          <HistoryList>
            <AnimatePresence>
              {sessions.map((session, index) => (
                <HistoryCard
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => session.status === 'completed' && handleViewReport(session.id)}
                >
                  <CardHeader>
                    <CardInfo>
                      <PositionName>
                        {session.positionInfo?.positionName || '未知岗位'}
                      </PositionName>
                      <CardMeta>
                        <MetaItem>
                          <ClockCircleOutlined />
                          {formatDateTime(session.startTime)}
                        </MetaItem>
                        {session.duration && (
                          <MetaItem>
                            时长 {formatDuration(session.duration)}
                          </MetaItem>
                        )}
                        <MetaItem>
                          {session.totalQuestions} 题
                        </MetaItem>
                        <MetaItem>
                          <Tag
                            color={getDifficultyColor(session.difficulty)}
                            style={{ borderRadius: 4 }}
                          >
                            {getDifficultyLabel(session.difficulty)}
                          </Tag>
                        </MetaItem>
                      </CardMeta>
                    </CardInfo>

                    {session.status === 'completed' && session.finalScore !== null && (
                      <CardScore>
                        <ScoreValue $color={getGradeColor(session.grade)}>
                          {Number(session.finalScore).toFixed(0)}
                        </ScoreValue>
                        <ScoreGrade $color={getGradeColor(session.grade)}>
                          {getGradeLabel(session.grade)}
                        </ScoreGrade>
                      </CardScore>
                    )}
                  </CardHeader>

                  <CardFooter>
                    <StatusTag
                      style={{
                        background: `${getStatusColor(session.status)}15`,
                        color: getStatusColor(session.status)
                      }}
                    >
                      {getStatusLabel(session.status)}
                    </StatusTag>

                    <ActionButtons onClick={(e) => e.stopPropagation()}>
                      {session.status === 'completed' && (
                        <ActionButton
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewReport(session.id)}
                        >
                          查看报告
                        </ActionButton>
                      )}
                      {session.status === 'in_progress' && (
                        <ActionButton
                          type="link"
                          onClick={() => navigate('/personal/interview/start', {
                            state: { sessionId: session.id }
                          })}
                        >
                          继续面试
                        </ActionButton>
                      )}
                      <ActionButton
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        删除
                      </ActionButton>
                    </ActionButtons>
                  </CardFooter>
                </HistoryCard>
              ))}
            </AnimatePresence>
          </HistoryList>
        )}
      </Container>
    </PageWrapper>
  );
};

export default PersonalInterviewHistoryPage;
