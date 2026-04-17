import React from 'react';
import styled, { keyframes } from 'styled-components';

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
  divider: '#EEF2F7',
};

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

// 主容器 - 左右分栏
const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  background: ${colors.background};
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// 左侧品牌区域
const BrandSection = styled.div`
  flex: 0 0 480px;
  background: linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px;
  position: relative;
  overflow: hidden;
  
  @media (max-width: 1024px) {
    flex: 0 0 400px;
    padding: 40px;
  }
  
  @media (max-width: 768px) {
    flex: 0 0 auto;
    padding: 40px 24px;
    min-height: 280px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: -20%;
    right: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
    border-radius: 50%;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -5%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

const BrandContent = styled.div`
  position: relative;
  z-index: 1;
  animation: ${slideIn} 0.6s ease;
`;

// Logo区域 - 垂直排列，居中对齐
const LogoArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  margin-bottom: 48px;
`;

// Logo图标放大 - 更大胆
const LogoImage = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.25);
  padding: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
`;

// 品牌名区域 - 居中对齐
const BrandNameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
`;

// 品牌名 - 更大更突出，居中
const LogoText = styled.div`
  font-size: 48px;
  font-weight: 700;
  color: white;
  letter-spacing: 2px;
  line-height: 1.2;
  text-align: center;
`;

// 品牌副标题 - 居中
const LogoSubtext = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 1px;
  text-align: center;
`;

// 描述文字 - 宽度限制，行距拉开
const BrandDesc = styled.p`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 40px 0;
  line-height: 1.8;
  max-width: 360px;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  
  .feature-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
`;

// 右侧表单区域
const FormSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: ${colors.background};
  
  @media (max-width: 768px) {
    padding: 24px;
  }
`;

// 表单容器 - 固定宽度
const FormContainer = styled.div`
  width: 100%;
  max-width: 380px;
  animation: ${fadeIn} 0.5s ease;
`;

const FormHeader = styled.div`
  margin-bottom: 32px;
`;

const FormTitle = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: ${colors.title};
  margin: 0 0 8px 0;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const FormSubtitle = styled.p`
  font-size: 15px;
  color: ${colors.muted};
  margin: 0;
`;

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <PageContainer>
      <BrandSection>
        <BrandContent>
          {/* Logo区域 - 垂直排列 */}
          <LogoArea>
            <LogoImage src="/logo.png" alt="logo" />
            <BrandNameArea>
              <LogoText>招聘灵犀</LogoText>
              <LogoSubtext>AI智能招聘平台</LogoSubtext>
            </BrandNameArea>
          </LogoArea>
          
          {/* 描述 */}
          <BrandDesc>让招聘更高效、更智能。基于LStwin-AI技术，为您提供一站式招聘解决方案。</BrandDesc>
          
          {/* 功能列表 */}
          <FeatureList>
            <FeatureItem>
              <div className="feature-icon">✓</div>
              <span>简历初筛，精准匹配人才</span>
            </FeatureItem>
            <FeatureItem>
              <div className="feature-icon">✓</div>
              <span>面试访谈，提升招聘效率</span>
            </FeatureItem>
            <FeatureItem>
              <div className="feature-icon">✓</div>
              <span>候选管理，全流程追踪</span>
            </FeatureItem>
          </FeatureList>
        </BrandContent>
      </BrandSection>
      
      <FormSection>
        <FormContainer>
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
