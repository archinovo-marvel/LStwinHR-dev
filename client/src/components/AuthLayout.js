import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';

import { colors } from '../../theme/colors';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  background: ${colors.bg};
`;

const BrandSection = styled.div`
  flex: 0 0 45%;
  background: ${colors.bgSecondary};
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 80px;
  position: relative;
  border-right: 1px solid ${colors.border};

  @media (max-width: 1024px) {
    flex: 0 0 40%;
    padding: 60px;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const BrandContent = styled.div`
  animation: ${fadeIn} 0.8s cubic-bezier(0.16, 1, 0.3, 1);
`;

const BrandLabel = styled.span`
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${colors.highlight};
  display: block;
  margin-bottom: 24px;
`;

const BrandTitle = styled.h1`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(36px, 4vw, 56px);
  font-weight: 400;
  color: ${colors.text};
  line-height: 1.2;
  margin: 0 0 32px 0;
  letter-spacing: -0.02em;
`;

const BrandDesc = styled.p`
  font-size: 15px;
  color: ${colors.textMuted};
  line-height: 1.8;
  margin: 0 0 48px 0;
  max-width: 400px;
`;

const BrandQuote = styled.blockquote`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 18px;
  font-weight: 400;
  color: ${colors.text};
  line-height: 1.6;
  margin: 0;
  padding-left: 24px;
  border-left: 2px solid ${colors.highlight};
`;

const LogoArea = styled.div`
  margin-bottom: 48px;
`;

const LogoText = styled.div`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  color: ${colors.text};
  letter-spacing: 0.05em;
  cursor: pointer;
`;

const FormSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 60px;

  @media (max-width: 768px) {
    padding: 60px 24px;
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 400px;
  animation: ${fadeIn} 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  animation-delay: 0.1s;
  animation-fill-mode: both;
`;

const FormHeader = styled.div`
  margin-bottom: 40px;
`;

const FormTitle = styled.h2`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 32px;
  font-weight: 400;
  color: ${colors.text};
  margin: 0 0 12px 0;
  letter-spacing: -0.01em;
`;

const FormSubtitle = styled.p`
  font-size: 14px;
  color: ${colors.textMuted};
  margin: 0;
  line-height: 1.6;
`;

const BackLink = styled.button`
  background: none;
  border: none;
  font-size: 13px;
  color: ${colors.textMuted};
  cursor: pointer;
  padding: 0;
  margin-bottom: 32px;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.2s ease;

  &:hover {
    color: ${colors.text};
  }
`;

const AuthLayout = ({ children, title, subtitle }) => {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <BrandSection>
        <BrandContent>
          <LogoArea>
            <LogoText onClick={() => navigate('/')}>
              LStwin招聘灵犀
            </LogoText>
          </LogoArea>

          <BrandLabel>关于平台</BrandLabel>

          <BrandTitle>
            每一次面试<br />都是精准的人才对话
          </BrandTitle>

          <BrandDesc>
            LStwin-AI融合自然语言处理与人力资源专业经验，为企业提供从简历初筛到面试评估的全链路智能解决方案。
          </BrandDesc>

          <BrandQuote>
            技术的价值在于释放人的潜能，让招聘者专注于最重要的事——发现人才。
          </BrandQuote>
        </BrandContent>
      </BrandSection>

      <FormSection>
        <FormContainer>
          <BackLink onClick={() => navigate('/')}>
            ← 返回首页
          </BackLink>
          <FormHeader>
            <FormTitle>{title}</FormTitle>
            {subtitle && <FormSubtitle>{subtitle}</FormSubtitle>}
          </FormHeader>
          {children}
        </FormContainer>
      </FormSection>
    </PageContainer>
  );
};

export default AuthLayout;
