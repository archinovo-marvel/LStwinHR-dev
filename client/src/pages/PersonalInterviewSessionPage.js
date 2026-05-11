/**
 * AI 模拟面试进行页面
 * 显示面试问题、接收回答、实时评分
 */
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Spin, Tag, Divider } from 'antd';
import { App } from 'antd';
import {
  ClockCircleOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  RightOutlined,
  TrophyOutlined,
  BulbOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { colors } from '../theme/colors';
import {
  QuestionDisplay,
  ConversationRecord
} from '../components/PersonalInterview';
import {
  getSessionById,
  submitAnswer,
  cancelSession,
  formatDuration,
  getGradeLabel,
  getGradeColor,
  getDifficultyLabel
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

const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  padding: 16px 24px;
  background: ${colors.surface};
  border-radius: 12px;
  border: 1px solid ${colors.border};
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const PositionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PositionName = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${colors.text};
`;

const PositionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const MetaTag = styled.span`
  padding: 2px 8px;
  background: ${colors.frost};
  border-radius: 4px;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
`;

const TimerDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 500;
  color: ${colors.text};

  .anticon {
    color: ${colors.accent};
  }
`;

const ProgressDisplay = styled.div`
  font-size: 14px;
  color: ${colors.textMuted};
`;

const ProgressHighlight = styled.span`
  color: ${colors.accent};
  font-weight: 500;
`;

const ExitButton = styled(Button)`
  color: ${colors.textMuted};
  border-color: ${colors.border};

  &:hover {
    color: ${colors.error};
    border-color: ${colors.error};
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

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

// 评分展示卡片
const EvaluationCard = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 32px;
  margin-top: 24px;
`;

const EvaluationHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
`;

const EvaluationIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.$bgColor || colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 24px;
    color: ${props => props.$color || colors.accent};
  }
`;

const EvaluationTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: ${colors.text};
`;

const EvaluationScore = styled.div`
  margin-left: auto;
  text-align: right;
`;

const ScoreNumber = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.$color || colors.accent};
`;

const ScoreLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const ScoresGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;

  @media (max-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const ScoreItem = styled.div`
  text-align: center;
  padding: 12px 8px;
  background: ${colors.frost};
  border-radius: 8px;
`;

const ScoreItemValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.$color || colors.text};
`;

const ScoreItemLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  margin-top: 4px;
`;

const FeedbackSection = styled.div`
  margin-bottom: 20px;
`;

const FeedbackLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FeedbackText = styled.div`
  font-size: 14px;
  color: ${colors.textSecondary};
  line-height: 1.7;
  padding: 16px;
  background: ${colors.frost};
  border-radius: 8px;
`;

const TagsSection = styled.div`
  margin-bottom: 20px;
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const NextButton = styled(Button)`
  height: 52px;
  padding: 0 40px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
  background: ${colors.accent} !important;
  border-color: ${colors.accent} !important;
  color: white !important;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;

  &:hover {
    background: ${colors.accentDark} !important;
    border-color: ${colors.accentDark} !important;
  }
`;

const AnswerSection = styled.div`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 24px;
`;

const AnswerTextarea = styled.textarea`
  width: 100%;
  min-height: 150px;
  padding: 16px;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  color: ${colors.text};
  background: ${colors.bg};

  &:focus {
    outline: none;
    border-color: ${colors.accent};
    box-shadow: 0 0 0 2px ${colors.accentSub};
  }

  &::placeholder {
    color: ${colors.textMuted};
  }
`;

const AnswerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
`;

const SubmitButton = styled(Button)`
  height: 44px;
  padding: 0 32px;
  font-size: 15px;
  font-weight: 500;
  background: ${colors.accent} !important;
  border-color: ${colors.accent} !important;
  color: white !important;

  &:hover {
    background: ${colors.accentDark} !important;
    border-color: ${colors.accentDark} !important;
  }

  &:disabled {
    background: ${colors.frost} !important;
    border-color: ${colors.border} !important;
    color: ${colors.textMuted} !important;
  }
`;

const SkipButton = styled(Button)`
  height: 44px;
  color: ${colors.textMuted};
  border-color: ${colors.border};

  &:hover {
    color: ${colors.warning};
    border-color: ${colors.warning};
  }
`;

// 维度标签映射
const dimensionLabels = {
  relevance: '相关性',
  clarity: '清晰度',
  depth: '深度',
  professionalism: '专业性',
  authenticity: '真实性'
};

// 获取评分颜色
const getScoreItemColor = (score) => {
  if (score >= 8) return colors.success;
  if (score >= 6) return colors.accent;
  if (score >= 4) return colors.warning;
  return colors.error;
};

// ============================================
// COMPONENT
// ============================================
const PersonalInterviewSessionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message: messageApi, modal } = App.useApp();
  const params = useParams();

  // 从路由 state 或 URL 参数获取会话信息
  const initialState = location.state;
  const sessionId = initialState?.sessionId || params.sessionId;

  // 状态
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [nextQuestionData, setNextQuestionData] = useState(null);

  const timerRef = useRef(null);

  // 加载会话数据
  useEffect(() => {
    if (!sessionId) {
      messageApi.error('缺少会话信息');
      navigate('/personal/interview');
      return;
    }

    loadSession();
  }, [sessionId]);

  // 计时器 - 只在未暂停时运行
  useEffect(() => {
    if (session && session.status === 'in_progress' && !isTimerPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [session, isTimerPaused]);

  // 初始化第一个问题
  useEffect(() => {
    if (initialState?.firstQuestion) {
      setCurrentQuestion(initialState.firstQuestion);
      setCurrentQuestionIndex(0);
      setLoading(false);
    }
  }, [initialState]);

  const loadSession = async () => {
    try {
      const sessionData = await getSessionById(sessionId);
      setSession(sessionData);

      // 如果有对话记录，获取当前问题
      if (sessionData.conversation && sessionData.conversation.length > 0) {
        const lastQA = sessionData.conversation[sessionData.conversation.length - 1];
        if (!lastQA.answer) {
          // 当前问题未回答
          setCurrentQuestion(lastQA);
          setCurrentQuestionIndex(sessionData.conversation.length - 1);
        } else {
          // 所有问题已回答
          setCurrentQuestionIndex(sessionData.conversation.length);
        }
      }

      // 计算已用时间
      if (sessionData.startTime) {
        const start = new Date(sessionData.startTime);
        const now = new Date();
        setElapsedTime(Math.floor((now - start) / 1000));
      }

      setLoading(false);
    } catch (error) {
      console.error('加载会话失败:', error);
      messageApi.error('加载面试会话失败');
      navigate('/personal/interview');
    }
  };

  // 提交回答 - 立即暂停计时，然后等待 AI 分析
  const handleSubmitAnswer = async () => {
    if (!answer.trim() || answer.trim().length < 10) {
      messageApi.warning('回答内容至少需要10个字符');
      return;
    }

    if (!currentQuestion?.id) {
      messageApi.error('问题信息缺失');
      return;
    }

    // 立即暂停计时
    setIsTimerPaused(true);
    setSubmitting(true);
    setEvaluation(null);

    try {
      // 等待 AI 分析
      const result = await submitAnswer(sessionId, currentQuestion.id, answer.trim());

      // 显示评分
      setEvaluation(result.evaluation);

      // 保存结果数据
      setNextQuestionData(result);
    } catch (error) {
      console.error('提交回答失败:', error);
      messageApi.error(error.response?.data?.message || '提交失败，请重试');
      // 如果失败，恢复计时
      setIsTimerPaused(false);
    } finally {
      setSubmitting(false);
    }
  };

  // 点击下一题按钮 - 继续计时并显示下一题
  const handleNextQuestion = () => {
    if (!nextQuestionData) return;

    if (nextQuestionData.isComplete) {
      // 面试完成，跳转到报告页面
      navigate(`/personal/interview/report/${sessionId}`);
      return;
    }

    // 显示下一题
    setCurrentQuestion(nextQuestionData.nextQuestion);
    setCurrentQuestionIndex(nextQuestionData.progress.current);
    setAnswer('');
    setEvaluation(null);
    setNextQuestionData(null);
    setIsTimerPaused(false); // 继续计时
  };

  // 跳过问题
  const handleSkipQuestion = () => {
    modal.confirm({
      title: '确认跳过',
      content: '确定要跳过这道问题吗？跳过将不会得分。',
      okText: '跳过',
      cancelText: '继续回答',
      onOk: async () => {
        // 立即暂停计时
        setIsTimerPaused(true);
        setSubmitting(true);
        try {
          const result = await submitAnswer(sessionId, currentQuestion.id, '（跳过此问题）');

          setEvaluation(result.evaluation);
          setNextQuestionData(result);
        } catch (error) {
          messageApi.error('操作失败');
          // 如果失败，恢复计时
          setIsTimerPaused(false);
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  // 退出面试
  const handleExitInterview = () => {
    modal.confirm({
      title: '确认退出',
      content: '确定要退出面试吗？当前进度将不会保存。',
      okText: '退出',
      cancelText: '继续面试',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelSession(sessionId);
          navigate('/personal/interview');
        } catch (error) {
          navigate('/personal/interview');
        }
      }
    });
  };

  // 查看报告
  const handleViewReport = () => {
    navigate(`/personal/interview/report/${sessionId}`);
  };

  // 返回大厅
  const handleBackToHub = () => {
    navigate('/personal/interview');
  };

  // 加载中
  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingWrapper>
            <Spin size="large" />
            <LoadingText>正在加载面试会话...</LoadingText>
          </LoadingWrapper>
        </Container>
      </PageWrapper>
    );
  }

  const totalQuestions = session?.totalQuestions || initialState?.totalQuestions || 10;

  return (
    <PageWrapper>
      <Container>
        {/* 顶部信息栏 */}
        <HeaderBar>
          <HeaderLeft>
            <PositionInfo>
              <PositionName>
                {session?.positionInfo?.positionName || initialState?.positionInfo?.positionName || '面试进行中'}
              </PositionName>
              <PositionMeta>
                <MetaTag>{getDifficultyLabel(session?.difficulty || 'medium')}</MetaTag>
                {session?.positionInfo?.companyName && (
                  <span>{session.positionInfo.companyName}</span>
                )}
              </PositionMeta>
            </PositionInfo>
          </HeaderLeft>

          <HeaderRight>
            <TimerDisplay style={{ opacity: isTimerPaused ? 0.6 : 1 }}>
              <ClockCircleOutlined style={{ color: isTimerPaused ? colors.textMuted : colors.accent }} />
              {formatDuration(elapsedTime)}
              {isTimerPaused && <span style={{ fontSize: 12, marginLeft: 8, color: colors.textMuted }}>(已暂停)</span>}
            </TimerDisplay>

            <ProgressDisplay>
              第 <ProgressHighlight>{currentQuestionIndex + 1}</ProgressHighlight> / {totalQuestions} 题
            </ProgressDisplay>

            <ExitButton
              icon={<LogoutOutlined />}
              onClick={handleExitInterview}
            >
              退出
            </ExitButton>
          </HeaderRight>
        </HeaderBar>

        {/* 主要内容 */}
        <MainContent>
          {/* 对话记录 */}
          {session?.conversation && session.conversation.length > 0 && (
            <ConversationRecord
              conversation={session.conversation.filter(qa => qa.answer)}
            />
          )}

          {/* 当前问题 */}
          <QuestionDisplay
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={totalQuestions}
            loading={submitting && !currentQuestion}
          />

          {/* 回答输入 - 只在未显示评分时显示 */}
          {!currentQuestion && !evaluation ? null : (
            evaluation ? null : (
              <AnswerSection>
                <AnswerTextarea
                  placeholder="请输入您的回答..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={submitting}
                />
                <AnswerActions>
                  <SkipButton onClick={handleSkipQuestion} disabled={submitting}>
                    跳过此题
                  </SkipButton>
                  <SubmitButton
                    type="primary"
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim() || answer.trim().length < 10 || submitting}
                    loading={submitting}
                  >
                    提交回答
                  </SubmitButton>
                </AnswerActions>
              </AnswerSection>
            )
          )}

          {/* 评分结果卡片 - 显示评分和下一题按钮 */}
          <AnimatePresence>
            {evaluation && (
              <EvaluationCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EvaluationHeader>
                  <EvaluationIcon $bgColor={colors.accentSub} $color={colors.accent}>
                    <TrophyOutlined />
                  </EvaluationIcon>
                  <EvaluationTitle>本题评分</EvaluationTitle>
                  <EvaluationScore>
                    <ScoreNumber $color={getScoreItemColor(evaluation.totalScore)}>
                      {evaluation.totalScore?.toFixed(1) || '--'}
                    </ScoreNumber>
                    <ScoreLabel>/ 10 分</ScoreLabel>
                  </EvaluationScore>
                </EvaluationHeader>

                {/* 各维度评分 */}
                {evaluation.scores && (
                  <ScoresGrid>
                    {Object.entries(evaluation.scores).map(([key, value]) => (
                      <ScoreItem key={key}>
                        <ScoreItemValue $color={getScoreItemColor(value)}>
                          {value}
                        </ScoreItemValue>
                        <ScoreItemLabel>{dimensionLabels[key] || key}</ScoreItemLabel>
                      </ScoreItem>
                    ))}
                  </ScoresGrid>
                )}

                {/* AI 评价 */}
                {evaluation.feedback && (
                  <FeedbackSection>
                    <FeedbackLabel>
                      <BulbOutlined style={{ color: colors.accent }} />
                      AI 评价
                    </FeedbackLabel>
                    <FeedbackText>{evaluation.feedback}</FeedbackText>
                  </FeedbackSection>
                )}

                {/* 回答亮点 */}
                {evaluation.strengths && evaluation.strengths.length > 0 && (
                  <TagsSection>
                    <FeedbackLabel>
                      <CheckCircleOutlined style={{ color: colors.success }} />
                      回答亮点
                    </FeedbackLabel>
                    <TagsRow>
                      {evaluation.strengths.map((s, i) => (
                        <Tag key={i} color="success">{s}</Tag>
                      ))}
                    </TagsRow>
                  </TagsSection>
                )}

                {/* 可改进处 */}
                {evaluation.improvements && evaluation.improvements.length > 0 && (
                  <TagsSection>
                    <FeedbackLabel>
                      <WarningOutlined style={{ color: colors.warning }} />
                      可改进处
                    </FeedbackLabel>
                    <TagsRow>
                      {evaluation.improvements.map((im, i) => (
                        <Tag key={i} color="warning">{im}</Tag>
                      ))}
                    </TagsRow>
                  </TagsSection>
                )}

                <Divider style={{ margin: '24px 0' }} />

                {/* 下一题按钮 */}
                <div style={{ textAlign: 'center' }}>
                  <NextButton
                    type="primary"
                    onClick={handleNextQuestion}
                    icon={nextQuestionData?.isComplete ? <CheckCircleOutlined /> : <RightOutlined />}
                    iconPosition="end"
                  >
                    {nextQuestionData?.isComplete ? '查看面试报告' : '下一题'}
                  </NextButton>
                </div>
              </EvaluationCard>
            )}
          </AnimatePresence>
        </MainContent>
      </Container>
    </PageWrapper>
  );
};

export default PersonalInterviewSessionPage;
