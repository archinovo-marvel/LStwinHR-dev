import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCandidateStats } from '../utils/candidateStats';

import { colors } from '../theme/colors';

const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const StatementSection = styled.section`
  padding: 160px 60px;
  background: ${colors.bg};
`;

const StatementInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const SectionLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 24px;
`;

const StatementText = styled(motion.blockquote)`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(32px, 5vw, 64px);
  font-weight: 400;
  color: ${colors.text};
  line-height: 1.3;
  margin: 0;
  padding-left: 40px;
  border-left: 2px solid ${colors.highlight};
`;

const StatementSubtext = styled(motion.p)`
  font-size: 16px;
  color: ${colors.textMuted};
  margin: 48px 0 0 40px;
  max-width: 600px;
  line-height: 1.8;
`;

const ServicesSection = styled.section`
  padding: 0 60px 160px;
  background: ${colors.bg};
`;

const ServicesInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const ServicesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: ${colors.border};
`;

const ServiceCard = styled(motion.div)`
  background: ${colors.bg};
  padding: 60px 48px;
  position: relative;
  cursor: pointer;
  transition: background 0.4s ease;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 60px;
    bottom: 60px;
    width: 2px;
    background: ${colors.accent};
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  &:hover {
    background: ${colors.bgSecondary};

    &::before {
      transform: scaleY(1);
    }
  }
`;

const ServiceNumber = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: ${colors.textMuted};
  display: block;
  margin-bottom: 32px;
`;

const ServiceTitle = styled.h3`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 28px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 16px 0;
`;

const ServiceDesc = styled.p`
  font-size: 14px;
  color: ${colors.textMuted};
  line-height: 1.7;
  margin: 0;
`;

const StatsSection = styled.section`
  padding: 160px 60px;
  background: ${colors.bgSecondary};
`;

const StatsInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 120px;
  align-items: center;
`;

const StatsLeft = styled.div``;

const StatsRight = styled.div``;

const StatItem = styled(motion.div)`
  margin-bottom: 64px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const StatNumber = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(48px, 6vw, 80px);
  font-weight: 400;
  color: ${colors.text};
  line-height: 1;
  margin-bottom: 12px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: ${colors.textMuted};
  letter-spacing: 0.1em;
`;

const StatsText = styled(motion.p)`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(24px, 3vw, 36px);
  color: ${colors.text};
  line-height: 1.5;
  margin: 0;
`;

const CTASection = styled.section`
  padding: 200px 60px;
  background: ${colors.bg};
  text-align: left;
`;

const CTAInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const CTATitle = styled(motion.h2)`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(36px, 5vw, 72px);
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 48px 0;
`;

const CTALink = styled(motion.a)`
  display: inline-block;
  font-size: 14px;
  color: ${colors.accent};
  text-decoration: none;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  position: relative;
  padding-bottom: 8px;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: ${colors.accent};
    transform-origin: right;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  &:hover::after {
    transform-origin: left;
    transform: scaleX(0);
  }
`;

const Footer = styled.footer`
  padding: 48px 60px;
  background: ${colors.bgSecondary};
  border-top: 1px solid ${colors.border};
`;

const FooterInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FooterLogo = styled.div`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 16px;
  color: ${colors.text};
`;

const FooterText = styled.p`
  font-size: 12px;
  color: ${colors.textMuted};
  margin: 0;
`;

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalResumes: 0,
    totalInterviews: 0,
    totalCandidates: 0,
    weeklyPassRate: 0
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const candidatesRes = await axios.get('/api/candidates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const candidates = Array.isArray(candidatesRes.data) ? candidatesRes.data : [];
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

  const handleFeatureClick = (route) => {
    navigate(route);
  };

  const services = [
    {
      number: '01',
      title: '简历初筛',
      description: '从愿不愿、能不能、合不合三个维度深度分析候选人，生成专业评估报告',
      route: '/resume'
    },
    {
      number: '02',
      title: '候选管理',
      description: '高效管理人才库，跟踪面试进度，优化招聘流程，提升团队协作效率',
      route: '/resume-analysis'
    },
    {
      number: '03',
      title: '面试访谈',
      description: 'AI驱动的模拟面试，精准评估人才能力，提供专业的面试报告',
      route: '/chat'
    }
  ];

  return (
    <PageWrapper>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&family=Cabinet+Grotesk:wght@400;500;700&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html {
            scroll-behavior: smooth;
          }

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

          @media (max-width: 768px) {
            ${StatementSection} {
              padding: 80px 24px;
            }
            ${ServicesSection} {
              padding: 0 24px 80px;
            }
            ${ServicesGrid} {
              grid-template-columns: 1fr;
            }
            ${StatsSection} {
              padding: 80px 24px;
            }
            ${StatsInner} {
              grid-template-columns: 1fr;
              gap: 60px;
            }
            ${CTASection} {
              padding: 100px 24px;
            }
            ${Footer} {
              padding: 32px 24px;
            }
            ${FooterInner} {
              flex-direction: column;
              gap: 16px;
              text-align: center;
            }
          }
        `}
      </style>

      <StatementSection id="statement">
        <StatementInner>
          <SectionLabel>品牌宣言</SectionLabel>
          <StatementText
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            每一次面试，都是一次精准的人才对话
          </StatementText>
          <StatementSubtext
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            LStwin-AI融合自然语言处理与人力资源专业经验，为企业提供从简历初筛到面试评估的全链路智能解决方案。我们相信，技术的价值在于释放人的潜能，让招聘者专注于最重要的事——发现人才。
          </StatementSubtext>
        </StatementInner>
      </StatementSection>

      <ServicesSection id="services">
        <ServicesInner>
          <SectionLabel>核心服务</SectionLabel>
          <ServicesGrid>
            {services.map((service, index) => (
              <ServiceCard
                key={service.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.1 }}
                onClick={() => handleFeatureClick(service.route)}
              >
                <ServiceNumber>{service.number}</ServiceNumber>
                <ServiceTitle>{service.title}</ServiceTitle>
                <ServiceDesc>{service.description}</ServiceDesc>
              </ServiceCard>
            ))}
          </ServicesGrid>
        </ServicesInner>
      </ServicesSection>

      <StatsSection>
        <StatsInner>
          <StatsLeft>
            <SectionLabel>数据见证</SectionLabel>
            <StatItem
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <StatNumber>{stats.totalInterviews.toLocaleString()}</StatNumber>
              <StatLabel>面试记录</StatLabel>
            </StatItem>
            <StatItem
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <StatNumber>{stats.totalCandidates.toLocaleString()}</StatNumber>
              <StatLabel>候选人</StatLabel>
            </StatItem>
            <StatItem
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >
              <StatNumber>{stats.weeklyPassRate}%</StatNumber>
              <StatLabel>通过率</StatLabel>
            </StatItem>
          </StatsLeft>
          <StatsRight>
            <StatsText
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              用数据驱动决策，让招聘流程更加科学、高效。我们相信，每一个数字背后，都是一次成功的人才匹配。
            </StatsText>
          </StatsRight>
        </StatsInner>
      </StatsSection>

      <CTASection>
        <CTAInner>
          <CTATitle
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            准备好重新定义<br />你的招聘流程了吗
          </CTATitle>
          <CTALink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleFeatureClick('/chat');
            }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            开始体验 →
          </CTALink>
        </CTAInner>
      </CTASection>

      <Footer id="footer">
        <FooterInner>
          <FooterLogo>LStwin · 智能招聘</FooterLogo>
          <FooterText>© 2024 LStwin. All rights reserved.</FooterText>
        </FooterInner>
      </Footer>
    </PageWrapper>
  );
};

export default DashboardPage;
