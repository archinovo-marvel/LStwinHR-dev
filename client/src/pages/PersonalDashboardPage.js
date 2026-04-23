import React from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const PersonalDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const services = [
    {
      number: '01',
      title: '简历优化',
      description: '上传您的简历，AI将分析内容并提供优化建议',
      route: '/personal/resume'
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
          <SectionLabel>个人中心</SectionLabel>
          <StatementText
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            欢迎回来，{user?.name}
          </StatementText>
          <StatementSubtext
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            上传您的简历，获取专业的AI优化建议
          </StatementSubtext>
        </StatementInner>
      </StatementSection>

      <ServicesSection id="services">
        <ServicesInner>
          <SectionLabel>我的服务</SectionLabel>
          <ServicesGrid>
            {services.map((service, index) => (
              <ServiceCard
                key={service.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.1 }}
                onClick={() => navigate(service.route)}
              >
                <ServiceNumber>{service.number}</ServiceNumber>
                <ServiceTitle>{service.title}</ServiceTitle>
                <ServiceDesc>{service.description}</ServiceDesc>
              </ServiceCard>
            ))}
          </ServicesGrid>
        </ServicesInner>
      </ServicesSection>

      <Footer id="footer">
        <FooterInner>
          <FooterLogo>LStwin · 智能招聘</FooterLogo>
          <FooterText>© 2024 LStwin. All rights reserved.</FooterText>
        </FooterInner>
      </Footer>
    </PageWrapper>
  );
};

export default PersonalDashboardPage;