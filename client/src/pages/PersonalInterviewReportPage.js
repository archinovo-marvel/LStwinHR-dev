/**
 * AI 模拟面试报告页面
 * 包含：面试者信息、岗位信息、总体评分、优缺点、建议、问题分析
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Button, Spin, Tag, Collapse } from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  SolutionOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  StarFilled,
  RightOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { colors } from '../theme/colors';
import {
  getSessionById,
  formatDuration,
  formatDateTime,
  getGradeLabel,
  getGradeColor
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
  max-width: 900px;
  margin: 0 auto;
  padding: 80px 40px 60px;

  @media (max-width: 768px) {
    padding: 60px 20px 40px;
  }
`;

const BackButton = styled(Button)`
  margin-bottom: 24px;
  color: ${colors.textSecondary};
  border-color: ${colors.border};

  &:hover {
    color: ${colors.accent};
    border-color: ${colors.accent};
  }
`;

const SectionCard = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${colors.border};
`;

const SectionIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 18px;
    color: ${colors.accent};
  }
`;

const SectionTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: ${colors.text};
`;

// 面试者信息样式
const UserInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const UserInfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const UserInfoLabel = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
`;

const UserInfoValue = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
`;

// 岗位信息样式
const PositionInfoGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PositionInfoRow = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 4px;
  }
`;

const PositionLabel = styled.div`
  min-width: 100px;
  font-size: 14px;
  color: ${colors.textMuted};
`;

const PositionValue = styled.div`
  flex: 1;
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
`;

const SkillsTagGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SkillTag = styled(Tag)`
  border-radius: 6px;
  margin: 0;
  padding: 4px 12px;
  background: ${colors.accentSub};
  border: none;
  color: ${colors.accent};
`;

// 总体评分样式
const ScoreSection = styled.div`
  display: flex;
  align-items: center;
  gap: 48px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 32px;
  }
`;

const ScoreCircle = styled.div`
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: ${props => props.$bgColor || colors.accentSub};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px ${props => props.$shadowColor || 'rgba(37, 99, 235, 0.2)'};
  flex-shrink: 0;
`;

const ScoreValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 56px;
  font-weight: 700;
  color: ${props => props.$color || colors.accent};
  line-height: 1;
`;

const ScoreMax = styled.div`
  font-size: 16px;
  color: ${colors.textMuted};
  margin-top: 4px;
`;

const ScoreGrade = styled.div`
  font-size: 22px;
  font-weight: 500;
  color: ${props => props.$color || colors.accent};
  margin-top: 8px;
`;

const DimensionScores = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const DimensionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const DimensionLabel = styled.div`
  min-width: 100px;
  font-size: 14px;
  color: ${colors.text};
`;

const DimensionBar = styled.div`
  flex: 1;
  height: 10px;
  background: ${colors.frost};
  border-radius: 5px;
  overflow: hidden;
`;

const DimensionFill = styled.div`
  height: 100%;
  background: ${props => props.$color || colors.accent};
  border-radius: 5px;
  transition: width 0.5s ease;
`;

const DimensionScore = styled.div`
  min-width: 40px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$color || colors.accent};
  text-align: right;
`;

// 优缺点样式
const AnalysisGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AnalysisBox = styled.div`
  padding: 20px;
  border-radius: 12px;
  background: ${props => props.$bgColor || colors.frost};
`;

const AnalysisTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${props => props.$color || colors.text};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AnalysisList = styled.ul`
  margin: 0;
  padding: 0 0 0 20px;

  li {
    font-size: 14px;
    color: ${colors.text};
    line-height: 1.8;

    &::marker {
      color: ${props => props.$markerColor || colors.textMuted};
    }
  }
`;

// 建议样式
const SuggestionItem = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid ${colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const SuggestionNumber = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${colors.accentSub};
  color: ${colors.accent};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
`;

const SuggestionContent = styled.div`
  flex: 1;
`;

const SuggestionTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 6px;
`;

const SuggestionDesc = styled.div`
  font-size: 14px;
  color: ${colors.textSecondary};
  line-height: 1.6;
`;

// 问题分析样式
const QuestionItem = styled.div`
  padding: 24px;
  margin-bottom: 16px;
  background: ${colors.frost};
  border-radius: 12px;
  border-left: 3px solid ${colors.accent};

  &:last-child {
    margin-bottom: 0;
  }
`;

const QuestionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
`;

const QuestionNumber = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${colors.accent};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
`;

const QuestionContent = styled.div`
  flex: 1;
`;

const QuestionText = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 12px;
  line-height: 1.6;
`;

const QuestionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const AnswerPreview = styled.div`
  padding: 16px;
  background: ${colors.surface};
  border-radius: 8px;
  margin-bottom: 16px;
`;

const AnswerLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  margin-bottom: 8px;
`;

const AnswerText = styled.div`
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.7;
`;

const EvaluationSection = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 16px;

  @media (max-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const EvaluationItem = styled.div`
  text-align: center;
  padding: 12px 8px;
  background: ${colors.surface};
  border-radius: 8px;
`;

const EvaluationScore = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.$color || colors.text};
`;

const EvaluationLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  margin-top: 4px;
`;

const FeedbackBox = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: ${colors.surface};
  border-radius: 8px;
  border: 1px solid ${colors.border};
`;

const FeedbackLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 8px;
`;

const FeedbackText = styled.div`
  font-size: 14px;
  color: ${colors.textSecondary};
  line-height: 1.7;
`;

// 加载状态
const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  color: ${colors.textMuted};
`;

const LoadingText = styled.div`
  margin-top: 16px;
  font-size: 14px;
`;

const ErrorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  text-align: center;
`;

const ErrorText = styled.div`
  font-size: 16px;
  color: ${colors.text};
  margin-bottom: 16px;
`;

// 操作按钮
const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 32px;
`;

const PrimaryButton = styled(Button)`
  background: ${colors.accent} !important;
  border-color: ${colors.accent} !important;
  color: white !important;
  font-weight: 500;

  &:hover {
    background: ${colors.accentDark} !important;
    border-color: ${colors.accentDark} !important;
  }
`;

// 维度标签映射
const dimensionLabels = {
  relevance: '相关性',
  clarity: '清晰度',
  depth: '深度',
  professionalism: '专业性',
  authenticity: '真实性',
  professionalKnowledge: '专业知识',
  communication: '沟通能力',
  logicalThinking: '逻辑思维',
  projectDepth: '项目深度',
  professionalism_dim: '职业素养'
};

// 个人端面试模拟评分维度（五维度）
const PERSONAL_DIMENSIONS = [
  { key: 'relevance', label: '相关性', color: '#2F80ED' },
  { key: 'clarity', label: '清晰度', color: '#10B981' },
  { key: 'depth', label: '深度', color: '#F59E0B' },
  { key: 'professionalism', label: '专业性', color: '#8B5CF6' },
  { key: 'authenticity', label: '真实性', color: '#EC4899' }
];

// 获取评分颜色
const getScoreColor = (score) => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.accent;
  if (score >= 40) return colors.warning;
  return colors.error;
};

// ============================================
// COMPONENT
// ============================================
const PersonalInterviewReportPage = () => {
  const navigate = useNavigate();
  const { id: sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const loadReport = async () => {
    if (!sessionId) {
      setError('缺少会话ID');
      setLoading(false);
      return;
    }

    try {
      const sessionData = await getSessionById(sessionId);
      setSession(sessionData);
    } catch (err) {
      console.error('加载报告失败:', err);
      setError('加载报告失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHub = () => {
    navigate('/personal/interview');
  };

  const handleStartNew = () => {
    navigate('/personal/interview');
  };

  // 加载中
  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingWrapper>
            <Spin size="large" />
            <LoadingText>正在加载面试报告...</LoadingText>
          </LoadingWrapper>
        </Container>
      </PageWrapper>
    );
  }

  // 错误状态
  if (error || !session) {
    return (
      <PageWrapper>
        <Container>
          <ErrorWrapper>
            <ErrorText>{error || '报告不存在'}</ErrorText>
            <Button type="primary" onClick={handleBackToHub}>
              返回面试大厅
            </Button>
          </ErrorWrapper>
        </Container>
      </PageWrapper>
    );
  }

  const scoring = session.scoring || {};
  const grade = scoring.grade || 'E';
  const totalScore = scoring.totalScore || 0;
  const dimensionAverages = scoring.dimensionAverages || {};
  const conversation = session.conversation || [];
  const positionInfo = session.positionInfo || {};

  return (
    <PageWrapper>
      <Container>
        {/* 返回按钮 */}
        <BackButton
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToHub}
        >
          返回面试大厅
        </BackButton>

        {/* 第一部分：面试者相关信息 */}
        <SectionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SectionHeader>
            <SectionIcon>
              <UserOutlined />
            </SectionIcon>
            <SectionTitle>面试者信息</SectionTitle>
          </SectionHeader>

          <UserInfoGrid>
            <UserInfoItem>
              <UserInfoLabel>面试时间</UserInfoLabel>
              <UserInfoValue>{formatDateTime(session.startTime)}</UserInfoValue>
            </UserInfoItem>
            <UserInfoItem>
              <UserInfoLabel>面试时长</UserInfoLabel>
              <UserInfoValue>{session.duration ? formatDuration(session.duration) : '--'}</UserInfoValue>
            </UserInfoItem>
            <UserInfoItem>
              <UserInfoLabel>问题数量</UserInfoLabel>
              <UserInfoValue>{conversation.length} 题</UserInfoValue>
            </UserInfoItem>
            <UserInfoItem>
              <UserInfoLabel>面试难度</UserInfoLabel>
              <UserInfoValue>
                {session.difficulty === 'easy' ? '简单' :
                 session.difficulty === 'medium' ? '中等' : '困难'}
              </UserInfoValue>
            </UserInfoItem>
          </UserInfoGrid>
        </SectionCard>

        {/* 第二部分：面试岗位信息摘要 */}
        <SectionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <SectionHeader>
            <SectionIcon>
              <SolutionOutlined />
            </SectionIcon>
            <SectionTitle>面试岗位信息</SectionTitle>
          </SectionHeader>

          <PositionInfoGrid>
            <PositionInfoRow>
              <PositionLabel>岗位名称</PositionLabel>
              <PositionValue>{positionInfo.positionName || '未知岗位'}</PositionValue>
            </PositionInfoRow>

            {positionInfo.companyName && (
              <PositionInfoRow>
                <PositionLabel>目标公司</PositionLabel>
                <PositionValue>{positionInfo.companyName}</PositionValue>
              </PositionInfoRow>
            )}

            <PositionInfoRow>
              <PositionLabel>岗位描述</PositionLabel>
              <PositionValue>{positionInfo.description || '暂无描述'}</PositionValue>
            </PositionInfoRow>

            {positionInfo.skills && positionInfo.skills.length > 0 && (
              <PositionInfoRow>
                <PositionLabel>技能要求</PositionLabel>
                <SkillsTagGroup>
                  {positionInfo.skills.map((skill, index) => (
                    <SkillTag key={index}>{skill}</SkillTag>
                  ))}
                </SkillsTagGroup>
              </PositionInfoRow>
            )}

            {(positionInfo.workYears || positionInfo.salaryRange) && (
              <PositionInfoRow>
                {positionInfo.workYears && (
                  <>
                    <PositionLabel>工作年限</PositionLabel>
                    <PositionValue>{positionInfo.workYears}</PositionValue>
                  </>
                )}
                {positionInfo.salaryRange && (
                  <>
                    <PositionLabel>薪资范围</PositionLabel>
                    <PositionValue>{positionInfo.salaryRange}</PositionValue>
                  </>
                )}
              </PositionInfoRow>
            )}
          </PositionInfoGrid>
        </SectionCard>

        {/* 第三部分：面试总体评分 */}
        <SectionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <SectionHeader>
            <SectionIcon>
              <TrophyOutlined />
            </SectionIcon>
            <SectionTitle>总体评分</SectionTitle>
          </SectionHeader>

          <ScoreSection>
            <ScoreCircle
              $bgColor={`${getGradeColor(grade)}15`}
              $shadowColor={`${getGradeColor(grade)}30`}
            >
              <ScoreValue $color={getGradeColor(grade)}>
                {totalScore.toFixed(0)}
              </ScoreValue>
              <ScoreMax>/ 100</ScoreMax>
              <ScoreGrade $color={getGradeColor(grade)}>
                {getGradeLabel(grade)}
              </ScoreGrade>
            </ScoreCircle>

            <DimensionScores>
              {PERSONAL_DIMENSIONS.map(dim => {
                const dimScore = dimensionAverages[dim.key] || 0;
                const dimPercent = dimScore * 10; // 0-10分转换为百分比
                return (
                  <DimensionItem key={dim.key}>
                    <DimensionLabel>{dim.label}</DimensionLabel>
                    <DimensionBar>
                      <DimensionFill
                        $color={dim.color}
                        style={{ width: `${dimPercent}%` }}
                      />
                    </DimensionBar>
                    <DimensionScore $color={getScoreColor(dimPercent)}>
                      {dimScore.toFixed(1)}
                    </DimensionScore>
                  </DimensionItem>
                );
              })}
            </DimensionScores>
          </ScoreSection>

          {scoring.summary && (
            <FeedbackBox style={{ marginTop: 24 }}>
              <FeedbackLabel>综合评价</FeedbackLabel>
              <FeedbackText>{scoring.summary}</FeedbackText>
            </FeedbackBox>
          )}
        </SectionCard>

        {/* 第四部分：每一个面试问题的评价和具体分析 */}
        <SectionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <SectionHeader>
            <SectionIcon>
              <MessageOutlined />
            </SectionIcon>
            <SectionTitle>问题详细分析</SectionTitle>
          </SectionHeader>

          {conversation.map((qa, index) => {
            // 使用问题类型作为标签，个人端面试模拟不分IQ/EQ/AQ/MQ维度
            const questionTypeLabel = {
              'technical': '技术考察',
              'behavioral': '行为面试',
              'experience': '经验深挖',
              'situational': '情景假设',
              'project': '项目实战',
              'career': '职业发展',
              'follow-up': '追问'
            }[qa.questionType] || '综合考察';
            const questionColor = {
              'technical': '#2F80ED',
              'behavioral': '#10B981',
              'experience': '#F59E0B',
              'situational': '#8B5CF6',
              'project': '#EC4899',
              'career': '#06B6D4',
              'follow-up': '#F97316'
            }[qa.questionType] || '#6B7280';
            return (
            <QuestionItem key={qa.id || index} style={{ borderLeftColor: questionColor }}>
              <QuestionHeader>
                <QuestionNumber style={{ background: questionColor }}>{index + 1}</QuestionNumber>
                <QuestionContent>
                  <QuestionText>{qa.question}</QuestionText>
                  <QuestionMeta>
                    <span>
                      <Tag color={questionColor === '#2F80ED' ? 'blue' :
                                 questionColor === '#10B981' ? 'green' :
                                 questionColor === '#F59E0B' ? 'orange' :
                                 questionColor === '#8B5CF6' ? 'purple' :
                                 questionColor === '#EC4899' ? 'magenta' :
                                 questionColor === '#06B6D4' ? 'cyan' : 'gold'}>
                        {questionTypeLabel}
                      </Tag>
                    </span>
                    {qa.intent && <span>考察：{qa.intent}</span>}
                  </QuestionMeta>
                </QuestionContent>
              </QuestionHeader>

              <AnswerPreview>
                <AnswerLabel>候选人回答</AnswerLabel>
                <AnswerText>{qa.answer || '（未作答）'}</AnswerText>
              </AnswerPreview>

              {qa.scores && (
                <EvaluationSection>
                  {Object.entries(qa.scores).map(([key, value]) => (
                    <EvaluationItem key={key}>
                      <EvaluationScore $color={getScoreColor(value * 10)}>
                        {value}
                      </EvaluationScore>
                      <EvaluationLabel>{dimensionLabels[key] || key}</EvaluationLabel>
                    </EvaluationItem>
                  ))}
                </EvaluationSection>
              )}

              {qa.feedback && (
                <FeedbackBox style={{ marginTop: 16 }}>
                  <FeedbackLabel>AI 评价</FeedbackLabel>
                  <FeedbackText>{qa.feedback}</FeedbackText>
                </FeedbackBox>
              )}

              {qa.strengths && qa.strengths.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <FeedbackLabel style={{ fontSize: 13, marginBottom: 8 }}>回答亮点</FeedbackLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {qa.strengths.map((s, i) => (
                      <Tag key={i} color="success">{s}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {qa.improvements && qa.improvements.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <FeedbackLabel style={{ fontSize: 13, marginBottom: 8 }}>可改进处</FeedbackLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {qa.improvements.map((im, i) => (
                      <Tag key={i} color="warning">{im}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </QuestionItem>
          );
          })}

          {conversation.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
              暂无面试记录
            </div>
          )}
        </SectionCard>

        {/* 操作按钮 */}
        <ActionButtons>
          <Button onClick={handleBackToHub}>
            返回面试大厅
          </Button>
          <PrimaryButton type="primary" onClick={handleStartNew}>
            再次面试
          </PrimaryButton>
        </ActionButtons>
      </Container>
    </PageWrapper>
  );
};

export default PersonalInterviewReportPage;
