/**
 * AI 模拟面试大厅页面
 * 逐步引导式流程 + 侧边栏显示历史和统计
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Steps, Modal, Spin, Tag, Progress } from 'antd';
import { App } from 'antd';
import {
  RocketOutlined,
  SettingOutlined,
  HistoryOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SolutionOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme/colors';
import {
  ResumeUploader,
  PositionHistory,
  StatsOverview
} from '../components/PersonalInterview';
import PositionForm from '../components/PersonalInterview/PositionForm';
import {
  createSession,
  getPositions,
  deletePosition,
  getStats,
  getSessions,
  cancelSession
} from '../utils/personalInterviewApi';

// ============================================
// STYLED COMPONENTS
// ============================================
const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  display: flex;
`;

const MainContent = styled.div`
  flex: 1;
  padding: 80px 60px;
  max-width: calc(100% - 360px);
  display: flex;
  flex-direction: column;

  @media (max-width: 1024px) {
    max-width: 100%;
    padding: 60px 24px;
  }
`;

const Sidebar = styled.aside`
  width: 360px;
  background: ${colors.bgSecondary};
  border-left: 1px solid ${colors.border};
  padding: 80px 24px 24px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const Header = styled.div`
  margin-bottom: 48px;
`;

const PageTitle = styled(motion.h1)`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 12px 0;
`;

const PageDesc = styled.p`
  font-size: 15px;
  color: ${colors.textMuted};
  margin: 0;
  line-height: 1.6;
`;

const StepsWrapper = styled.div`
  margin-bottom: 40px;
  padding: 24px 32px;
  background: ${colors.surface};
  border-radius: 12px;
  border: 1px solid ${colors.border};

  .ant-steps-item-process .ant-steps-item-icon {
    background: ${colors.accent};
    border-color: ${colors.accent};
  }

  .ant-steps-item-finish .ant-steps-item-icon {
    background: ${colors.accentSub};
    border-color: ${colors.accent};
  }

  .ant-steps-item-title {
    font-size: 14px;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    padding: 16px;

    .ant-steps-item-title {
      display: none;
    }
  }
`;

const StepContent = styled.div`
  flex: 1;
  margin-bottom: 32px;
`;

const StepCard = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 48px;
  min-height: 400px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);

  @media (max-width: 768px) {
    padding: 32px 24px;
  }
`;

const StepHeader = styled.div`
  margin-bottom: 32px;
`;

const StepNumber = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: ${colors.accent};
  letter-spacing: 0.1em;
  display: block;
  margin-bottom: 12px;
`;

const StepTitle = styled.h2`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 24px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 8px 0;
`;

const StepDesc = styled.p`
  font-size: 14px;
  color: ${colors.textMuted};
  margin: 0;
`;

const NavigationBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24px;
  border-top: 1px solid ${colors.border};
`;

const NavButton = styled(Button)`
  height: 48px;
  padding: 0 32px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PrevButton = styled(NavButton)`
  border-color: ${colors.border};
  color: ${colors.textSecondary};

  &:hover {
    border-color: ${colors.accent};
    color: ${colors.accent};
  }
`;

const NextButton = styled(NavButton)`
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

const StartButton = styled(Button)`
  height: 56px;
  padding: 0 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
  background: ${colors.accent} !important;
  border-color: ${colors.accent} !important;
  color: white !important;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.25);

  &:hover {
    background: ${colors.accentDark} !important;
    border-color: ${colors.accentDark} !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
  }

  &:disabled {
    background: ${colors.frost} !important;
    border-color: ${colors.border} !important;
    color: ${colors.textMuted} !important;
    box-shadow: none;
  }
`;

// Sidebar Components
const SidebarSection = styled.div`
  margin-bottom: 32px;
`;

const SidebarTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.border};
`;

const SidebarIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 14px;
    color: ${colors.accent};
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const StatCard = styled.div`
  background: ${colors.surface};
  border-radius: 10px;
  padding: 16px;
  text-align: center;
`;

const StatValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const HistoryItem = styled.div`
  background: ${colors.surface};
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    border-color: ${colors.accent};
    background: ${colors.frost};
  }
`;

const HistoryItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const HistoryItemTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
`;

const HistoryItemScore = styled(Tag)`
  margin: 0;
  font-size: 11px;
`;

const HistoryItemMeta = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: ${colors.textMuted};
  font-size: 13px;
`;

const LoadingWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
`;

// 确认步骤样式
const ConfirmGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 32px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const ConfirmItem = styled.div`
  background: ${colors.frost};
  border-radius: 10px;
  padding: 16px 20px;
`;

const ConfirmLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  margin-bottom: 6px;
`;

const ConfirmValue = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
`;

const ConfirmFullItem = styled(ConfirmItem)`
  grid-column: 1 / -1;
`;

// 配置步骤样式
const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  max-width: 500px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const ConfigItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ConfigLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
`;

// ============================================
// COMPONENT
// ============================================
const PersonalInterviewHubPage = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0);

  // 表单状态
  const [resumeFile, setResumeFile] = useState(null);
  const [positionInfo, setPositionInfo] = useState({
    positionName: '',
    companyName: '',
    description: '',
    skills: [],
    workYears: '',
    salaryRange: ''
  });
  const [difficulty, setDifficulty] = useState('medium');
  const [totalQuestions, setTotalQuestions] = useState(10);

  // 数据状态
  const [positions, setPositions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // 步骤配置
  const steps = [
    { key: 'resume', title: '上传简历', icon: <FileTextOutlined /> },
    { key: 'position', title: '岗位信息', icon: <SolutionOutlined /> },
    { key: 'config', title: '面试配置', icon: <SettingOutlined /> },
    { key: 'start', title: '开始面试', icon: <RocketOutlined /> }
  ];

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [positionsData, sessionsData, statsData] = await Promise.all([
        getPositions(),
        getSessions(),
        getStats()
      ]);
      setPositions(positionsData);
      setSessions(sessionsData);
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setDataLoading(false);
    }
  };

  // 检查步骤是否可完成
  const isStepValid = (step) => {
    switch (step) {
      case 0: // 简历上传
        return !!resumeFile;
      case 1: // 岗位信息
        return !!(positionInfo.positionName && positionInfo.description);
      case 2: // 面试配置
        return true;
      case 3: // 开始面试
        return true;
      default:
        return false;
    }
  };

  // 导航
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 开始面试
  const handleStartInterview = async () => {
    if (!resumeFile) {
      messageApi.warning('请先上传简历');
      return;
    }

    if (!positionInfo.positionName || !positionInfo.description) {
      messageApi.warning('请填写岗位名称和描述');
      return;
    }

    setLoading(true);

    try {
      const result = await createSession(resumeFile, positionInfo, {
        difficulty,
        totalQuestions
      });

      messageApi.success('面试创建成功，正在生成第一个问题...');

      navigate('/personal/interview/start', {
        state: {
          sessionId: result.session.id,
          firstQuestion: result.firstQuestion,
          positionInfo: result.session.positionInfo,
          resumeId: result.resume.id,
          totalQuestions: result.session.totalQuestions
        }
      });
    } catch (error) {
      console.error('创建面试失败:', error);
      messageApi.error(error.response?.data?.message || '创建面试失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 选择历史岗位
  const handleSelectPosition = (position) => {
    setPositionInfo({
      positionName: position.positionName,
      companyName: position.companyName || '',
      description: position.description,
      skills: position.skills || [],
      workYears: position.workYears || '',
      salaryRange: position.salaryRange || ''
    });
    messageApi.success('已加载岗位信息');
    setCurrentStep(1); // 跳转到岗位信息步骤
  };

  // 删除岗位
  const handleDeletePosition = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个岗位吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deletePosition(id);
          setPositions(prev => prev.filter(p => p.id !== id));
          messageApi.success('删除成功');
        } catch (error) {
          messageApi.error('删除失败');
        }
      }
    });
  };

  // 删除面试记录
  const handleDeleteSession = (sessionId) => {
    Modal.confirm({
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
          // 重新加载统计数据
          const statsData = await getStats();
          setStats(statsData);
        } catch (error) {
          messageApi.error('删除失败');
        }
      }
    });
  };

  // 获取难度标签
  const getDifficultyLabel = (value) => {
    const labels = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    };
    return labels[value] || value;
  };

  // 获取评分颜色
  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'processing';
    if (score >= 40) return 'warning';
    return 'error';
  };

  // 计算总回答问题数
  const calculateTotalQuestions = (sessionList) => {
    if (!sessionList || sessionList.length === 0) return 0;
    return sessionList.reduce((total, session) => {
      return total + (session.totalQuestions || 0);
    }, 0);
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    const variants = {
      enter: { opacity: 0, x: 20 },
      center: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 }
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {currentStep === 0 && (
            <StepCard>
              <StepHeader>
                <StepNumber>STEP 01</StepNumber>
                <StepTitle>上传您的简历</StepTitle>
                <StepDesc>支持 PDF、Word、图片等格式，系统将自动解析简历内容</StepDesc>
              </StepHeader>
              <ResumeUploader
                value={resumeFile}
                onChange={setResumeFile}
              />
            </StepCard>
          )}

          {currentStep === 1 && (
            <StepCard>
              <StepHeader>
                <StepNumber>STEP 02</StepNumber>
                <StepTitle>填写目标岗位信息</StepTitle>
                <StepDesc>AI 将根据岗位要求生成针对性的面试问题</StepDesc>
              </StepHeader>
              <PositionForm
                value={positionInfo}
                onChange={setPositionInfo}
              />
            </StepCard>
          )}

          {currentStep === 2 && (
            <StepCard>
              <StepHeader>
                <StepNumber>STEP 03</StepNumber>
                <StepTitle>配置面试参数</StepTitle>
                <StepDesc>根据您的准备程度选择合适的难度和题量</StepDesc>
              </StepHeader>
              <ConfigGrid>
                <ConfigItem>
                  <ConfigLabel>难度等级</ConfigLabel>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        fontSize: '14px',
                        color: colors.text,
                        background: colors.surface,
                        cursor: 'pointer',
                        appearance: 'none'
                      }}
                    >
                      <option value="easy">简单 - 基础问题，适合新手</option>
                      <option value="medium">中等 - 进阶问题，有一定挑战</option>
                      <option value="hard">困难 - 挑战问题，考察深度</option>
                    </select>
                  </div>
                </ConfigItem>
                <ConfigItem>
                  <ConfigLabel>题目数量</ConfigLabel>
                  <input
                    type="number"
                    min={5}
                    max={20}
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Math.min(20, Math.max(5, parseInt(e.target.value) || 5)))}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '14px',
                      color: colors.text,
                      background: colors.surface
                    }}
                  />
                </ConfigItem>
              </ConfigGrid>
            </StepCard>
          )}

          {currentStep === 3 && (
            <StepCard>
              <StepHeader>
                <StepNumber>STEP 04</StepNumber>
                <StepTitle>确认并开始面试</StepTitle>
                <StepDesc>请检查以下信息，确认无误后开始面试</StepDesc>
              </StepHeader>

              <ConfirmGrid>
                <ConfirmItem>
                  <ConfirmLabel>简历文件</ConfirmLabel>
                  <ConfirmValue>
                    <CheckCircleOutlined style={{ color: colors.success, marginRight: 8 }} />
                    {resumeFile?.name || '未上传'}
                  </ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>岗位名称</ConfirmLabel>
                  <ConfirmValue>{positionInfo.positionName || '未填写'}</ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>目标公司</ConfirmLabel>
                  <ConfirmValue>{positionInfo.companyName || '未填写'}</ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>难度等级</ConfirmLabel>
                  <ConfirmValue>{getDifficultyLabel(difficulty)}</ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>题目数量</ConfirmLabel>
                  <ConfirmValue>{totalQuestions} 题</ConfirmValue>
                </ConfirmItem>
                <ConfirmItem>
                  <ConfirmLabel>技能要求</ConfirmLabel>
                  <ConfirmValue>
                    {(positionInfo.skills || []).slice(0, 3).join('、') || '未填写'}
                    {(positionInfo.skills || []).length > 3 && '...'}
                  </ConfirmValue>
                </ConfirmItem>
                {positionInfo.description && (
                  <ConfirmFullItem>
                    <ConfirmLabel>岗位描述</ConfirmLabel>
                    <ConfirmValue style={{
                      fontSize: '14px',
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {positionInfo.description}
                    </ConfirmValue>
                  </ConfirmFullItem>
                )}
              </ConfirmGrid>

              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <StartButton
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartInterview}
                  loading={loading}
                >
                  {loading ? '正在创建面试...' : '开始面试'}
                </StartButton>
              </div>
            </StepCard>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <PageWrapper>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap');

          ::selection {
            background: ${colors.highlight};
            color: #FFFFFF;
          }

          ::-webkit-scrollbar {
            width: 6px;
          }

          ::-webkit-scrollbar-track {
            background: ${colors.bg};
          }

          ::-webkit-scrollbar-thumb {
            background: ${colors.border};
          }

          select:focus, input:focus {
            outline: none;
            border-color: ${colors.accent} !important;
            box-shadow: 0 0 0 2px ${colors.accentSub};
          }
        `}
      </style>

      {/* 主内容区 */}
      <MainContent>
        <Header>
          <PageTitle
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            AI 模拟面试训练
          </PageTitle>
          <PageDesc>
            上传简历并填写目标岗位，AI 将为您进行一对一模拟面试训练
          </PageDesc>
        </Header>

        {/* 步骤指示器 */}
        <StepsWrapper>
          <Steps current={currentStep} labelPlacement="horizontal">
            {steps.map((step, index) => (
              <Steps.Step
                key={step.key}
                title={step.title}
                icon={step.icon}
              />
            ))}
          </Steps>
        </StepsWrapper>

        {/* 步骤内容 */}
        <StepContent>
          {renderStepContent()}
        </StepContent>

        {/* 导航栏 */}
        <NavigationBar>
          <PrevButton
            onClick={handlePrev}
            disabled={currentStep === 0}
            icon={<LeftOutlined />}
          >
            上一步
          </PrevButton>

          {currentStep < steps.length - 1 && (
            <NextButton
              type="primary"
              onClick={handleNext}
              disabled={!isStepValid(currentStep)}
              icon={<RightOutlined />}
              iconPosition="end"
            >
              下一步
            </NextButton>
          )}
        </NavigationBar>
      </MainContent>

      {/* 侧边栏 */}
      <Sidebar>
        {/* 训练数据统计 */}
        <SidebarSection>
          <SidebarTitle>
            <SidebarIcon>
              <BarChartOutlined />
            </SidebarIcon>
            训练数据
          </SidebarTitle>

          {dataLoading ? (
            <LoadingWrapper>
              <Spin size="small" />
            </LoadingWrapper>
          ) : (
            <StatsGrid>
              <StatCard>
                <StatValue>{stats?.totalSessions || 0}</StatValue>
                <StatLabel>总面试次数</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{stats?.averageScore?.toFixed(0) || '-'}</StatValue>
                <StatLabel>平均分数</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{stats?.highestScore?.toFixed(0) || '-'}</StatValue>
                <StatLabel>最高分数</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{calculateTotalQuestions(sessions)}</StatValue>
                <StatLabel>回答问题数</StatLabel>
              </StatCard>
            </StatsGrid>
          )}
        </SidebarSection>

        {/* 面试历史 */}
        <SidebarSection>
          <SidebarTitle>
            <SidebarIcon>
              <HistoryOutlined />
            </SidebarIcon>
            面试历史
          </SidebarTitle>

          {dataLoading ? (
            <LoadingWrapper>
              <Spin size="small" />
            </LoadingWrapper>
          ) : sessions.length === 0 ? (
            <EmptyState>暂无面试记录</EmptyState>
          ) : (
            <HistoryList>
              {sessions.slice(0, 5).map((session) => (
                <HistoryItem
                  key={session.id}
                  onClick={() => navigate(`/personal/interview/report/${session.id}`)}
                >
                  <HistoryItemHeader>
                    <HistoryItemTitle>
                      {session.positionInfo?.positionName || '未知岗位'}
                    </HistoryItemTitle>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {session.finalScore !== undefined && session.finalScore !== null && (
                        <HistoryItemScore color={getScoreColor(Number(session.finalScore))}>
                          {Number(session.finalScore).toFixed(0)}分
                        </HistoryItemScore>
                      )}
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ color: colors.textMuted, padding: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      />
                    </div>
                  </HistoryItemHeader>
                  <HistoryItemMeta>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {session.startTime
                      ? new Date(session.startTime).toLocaleDateString()
                      : '未知时间'}
                    {session.status === 'completed' && (
                      <Tag color="success" style={{ marginLeft: 8, fontSize: 11 }}>已完成</Tag>
                    )}
                    {session.status === 'in_progress' && (
                      <Tag color="processing" style={{ marginLeft: 8, fontSize: 11 }}>进行中</Tag>
                    )}
                  </HistoryItemMeta>
                </HistoryItem>
              ))}
            </HistoryList>
          )}

          {sessions.length > 5 && (
            <Button
              type="link"
              style={{ padding: '12px 0 0', width: '100%', textAlign: 'center' }}
              onClick={() => navigate('/personal/interview/history')}
            >
              查看全部
            </Button>
          )}
        </SidebarSection>

        {/* 快速选择历史岗位 */}
        {positions.length > 0 && (
          <SidebarSection>
            <SidebarTitle>
              <SidebarIcon>
                <SolutionOutlined />
              </SidebarIcon>
              历史岗位
            </SidebarTitle>

            <HistoryList>
              {positions.slice(0, 3).map((position) => (
                <HistoryItem
                  key={position.id}
                  onClick={() => handleSelectPosition(position)}
                >
                  <HistoryItemHeader>
                    <HistoryItemTitle>{position.positionName}</HistoryItemTitle>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{ color: colors.textMuted }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePosition(position.id);
                      }}
                    />
                  </HistoryItemHeader>
                  <HistoryItemMeta>
                    {position.companyName || '未指定公司'}
                  </HistoryItemMeta>
                </HistoryItem>
              ))}
            </HistoryList>
          </SidebarSection>
        )}
      </Sidebar>
    </PageWrapper>
  );
};

export default PersonalInterviewHubPage;
