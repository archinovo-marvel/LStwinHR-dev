import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Typography } from 'antd';
import { 
  MessageOutlined, 
  RocketOutlined,
  RobotOutlined,
  FileTextOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPromptModal from '../components/LoginPromptModal';
import { getCandidateStats } from '../utils/candidateStats';

const { Title, Paragraph } = Typography;

// 主色调定义
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
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4'
};

// 页面容器
const PageContainer = styled.div`
  padding: 32px;
  background: ${colors.background};
  min-height: 100%;
`;

// Hero区域
const HeroSection = styled.div`
  background: linear-gradient(135deg, #F0F7FF 0%, #E8F4FD 50%, #F5F0FF 100%);
  border-radius: 20px;
  padding: 48px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(47, 128, 237, 0.08) 0%, transparent 70%);
    border-radius: 50%;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: 10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

const HeroContent = styled.div`
  flex: 1;
  max-width: 520px;
  z-index: 1;
`;

const HeroTitle = styled(Title)`
  && {
    font-size: 36px;
    font-weight: 700;
    color: ${colors.title};
    margin-bottom: 16px;
    line-height: 1.3;
    
    .highlight {
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.purple} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }
`;

const HeroDesc = styled(Paragraph)`
  && {
    font-size: 16px;
    color: ${colors.text};
    line-height: 1.8;
    margin-bottom: 28px;
  }
`;

const HeroButtons = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const PrimaryButton = styled(Button)`
  && {
    height: 44px;
    padding: 0 28px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 15px;
    background: ${colors.primary};
    border-color: ${colors.primary};
    box-shadow: 0 4px 12px rgba(47, 128, 237, 0.25);
    transition: all 0.2s ease;
    
    &:hover {
      background: ${colors.primaryHover};
      border-color: ${colors.primaryHover};
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(47, 128, 237, 0.35);
    }
  }
`;

const SecondaryButton = styled(Button)`
  && {
    height: 44px;
    padding: 0 28px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 15px;
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

// 统计卡片区域
const StatsSection = styled.div`
  margin-bottom: 32px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const SectionTitle = styled(Title)`
  && {
    font-size: 18px;
    font-weight: 600;
    color: ${colors.title};
    margin: 0;
  }
`;

const StatCard = styled(Card)`
  && {
    border-radius: 16px;
    border: 1px solid ${colors.border};
    box-shadow: none;
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
      border-color: ${colors.primary};
    }
    
    .ant-card-body {
      padding: 24px;
    }
  }
`;

const StatCardContent = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const StatLeft = styled.div`
  flex: 1;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: ${colors.muted};
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: ${colors.title};
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
`;

const StatIconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  
  &.blue {
    background: ${colors.primaryLight};
    color: ${colors.primary};
  }
  
  &.green {
    background: #D1FAE5;
    color: ${colors.success};
  }
  
  &.orange {
    background: #FEF3C7;
    color: ${colors.warning};
  }
  
  &.purple {
    background: #EDE9FE;
    color: ${colors.purple};
  }
`;

// 功能卡片区域
const FeaturesSection = styled.div`
  margin-bottom: 32px;
`;

const FeatureCard = styled(Card)`
  && {
    border-radius: 16px;
    border: 1px solid ${colors.border};
    box-shadow: none;
    transition: all 0.3s ease;
    cursor: pointer;
    height: 100%;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
      border-color: ${props => props.$hoverColor || colors.primary};
      
      .feature-icon {
        transform: scale(1.1);
      }
      
      .feature-arrow {
        transform: translateX(4px);
        opacity: 1;
      }
    }
    
    .ant-card-body {
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
`;

const FeatureIcon = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 16px;
  transition: transform 0.3s ease;
  
  &.blue {
    background: ${colors.primaryLight};
    color: ${colors.primary};
  }
  
  &.green {
    background: #D1FAE5;
    color: ${colors.success};
  }
  
  &.orange {
    background: #FEF3C7;
    color: ${colors.warning};
  }
  
  &.purple {
    background: #EDE9FE;
    color: ${colors.purple};
  }
`;

const FeatureTitle = styled(Title)`
  && {
    font-size: 16px;
    font-weight: 600;
    color: ${colors.title};
    margin: 0 0 8px 0;
  }
`;

const FeatureDesc = styled(Paragraph)`
  && {
    font-size: 14px;
    color: ${colors.muted};
    margin: 0 0 16px 0;
    flex: 1;
    line-height: 1.6;
  }
`;

const FeatureAction = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: ${colors.primary};
  
  .feature-arrow {
    transition: all 0.2s ease;
    opacity: 0.6;
  }
`;

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [stats, setStats] = useState({
    totalResumes: 0,
    totalInterviews: 0,
    totalCandidates: 0,
    weeklyPassRate: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setStats({
          totalResumes: 0,
          totalInterviews: 0,
          totalCandidates: 0,
          weeklyPassRate: 0
        });
        return;
      }
      const candidatesRes = await axios.get('/api/candidates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const candidates = Array.isArray(candidatesRes.data) ? candidatesRes.data : [];

      // 使用统一的统计计算函数
      const statsResult = getCandidateStats(candidates);

      setStats({
        totalResumes: statsResult.totalResumes,
        totalInterviews: statsResult.interviewCount,
        totalCandidates: statsResult.totalCandidates,
        weeklyPassRate: statsResult.weeklyPassRate
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const handleLoginRequired = (route) => {
    if (!user) {
      setPendingRoute(route);
      setLoginPromptVisible(true);
      return false;
    }
    return true;
  };

  const handleLoginPromptClose = () => {
    setLoginPromptVisible(false);
    setPendingRoute(null);
  };

  const handleLoginPromptConfirm = () => {
    setLoginPromptVisible(false);
    navigate('/login');
  };

  const handleFeatureClick = (route) => {
    if (handleLoginRequired(route)) {
      navigate(route);
    }
  };

  const features = [
    {
      icon: <MessageOutlined />,
      title: '智能对话',
      description: '支持语音和文字交互，提供专业的HR咨询服务，快速解答招聘相关问题',
      color: 'blue',
      route: '/chat'
    },
    {
      icon: <FileTextOutlined />,
      title: '简历初筛',
      description: '从愿不愿、能不能、合不合三个维度深度分析候选人，生成专业报告',
      color: 'green',
      route: '/resume'
    },
    {
      icon: <TeamOutlined />,
      title: '候选管理',
      description: '查看和管理所有候选人信息，跟踪面试进度，高效管理招聘流程',
      color: 'orange',
      route: '/resume-analysis'
    },
    {
      icon: <RobotOutlined />,
      title: '面试访谈',
      description: '模拟真实面试场景，AI智能提问与评估，提供专业面试报告',
      color: 'purple',
      route: '/chat'
    }
  ];

  const statCards = [
    {
      label: '已处理简历',
      value: stats.totalResumes,
      icon: <FileTextOutlined />,
      color: 'blue'
    },
    {
      label: 'AI面试次数',
      value: stats.totalInterviews,
      icon: <RobotOutlined />,
      color: 'purple'
    },
    {
      label: '候选人总数',
      value: stats.totalCandidates,
      icon: <TeamOutlined />,
      color: 'green'
    },
    {
      label: '本周通过率',
      value: `${stats.weeklyPassRate}%`,
      icon: <RiseOutlined />,
      color: 'orange'
    }
  ];

  return (
    <PageContainer>
      {/* Hero区域 */}
      <HeroSection>
        <HeroContent>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <HeroTitle level={1}>
              <span className="highlight">AI驱动</span>的智能招聘平台
            </HeroTitle>
            <HeroDesc>
              基于LStwin-AI技术，为您提供简历初筛、面试访谈、候选管理等一站式招聘解决方案，让招聘更高效、更智能。
            </HeroDesc>
            <HeroButtons>
              <PrimaryButton 
                type="primary" 
                icon={<RocketOutlined />}
                onClick={() => handleFeatureClick('/chat')}
              >
                开始体验
              </PrimaryButton>
              <SecondaryButton 
                icon={<ThunderboltOutlined />}
                onClick={() => handleFeatureClick('/resume')}
              >
                上传简历
              </SecondaryButton>
            </HeroButtons>
          </motion.div>
        </HeroContent>
      </HeroSection>

      {/* 统计卡片 */}
      <StatsSection>
        <SectionHeader>
          <SectionTitle level={4}>数据概览</SectionTitle>
        </SectionHeader>
        <Row gutter={[20, 20]}>
          {statCards.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <StatCard>
                  <StatCardContent>
                    <StatLeft>
                      <StatLabel>
                        {stat.label}
                      </StatLabel>
                      <StatValue>{stat.value}</StatValue>
                    </StatLeft>
                    <StatIconWrapper className={stat.color}>
                      {stat.icon}
                    </StatIconWrapper>
                  </StatCardContent>
                </StatCard>
              </motion.div>
            </Col>
          ))}
        </Row>
      </StatsSection>

      {/* 核心功能 */}
      <FeaturesSection>
        <SectionHeader>
          <SectionTitle level={4}>核心功能</SectionTitle>
          <Button type="link" style={{ padding: 0 }}>
            查看全部 <ArrowRightOutlined />
          </Button>
        </SectionHeader>
        <Row gutter={[20, 20]}>
          {features.map((feature, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <FeatureCard 
                  $hoverColor={feature.color === 'blue' ? colors.primary : feature.color === 'green' ? colors.success : feature.color === 'orange' ? colors.warning : colors.purple}
                  onClick={() => handleFeatureClick(feature.route)}
                >
                  <FeatureIcon className={feature.color}>
                    {feature.icon}
                  </FeatureIcon>
                  <FeatureTitle level={4}>{feature.title}</FeatureTitle>
                  <FeatureDesc>{feature.description}</FeatureDesc>
                  <FeatureAction>
                    立即使用 <ArrowRightOutlined className="feature-arrow" />
                  </FeatureAction>
                </FeatureCard>
              </motion.div>
            </Col>
          ))}
        </Row>
      </FeaturesSection>
      <LoginPromptModal
        visible={loginPromptVisible}
        onClose={handleLoginPromptClose}
        onLogin={handleLoginPromptConfirm}
      />
    </PageContainer>
  );
};

export default HomePage;
