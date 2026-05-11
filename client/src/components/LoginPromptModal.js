import React from 'react';
import { Modal, Button } from 'antd';
import { LoginOutlined, UserOutlined } from '@ant-design/icons';
import styled, { keyframes } from 'styled-components';

import { colors } from '../theme/colors';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const floatAnimation = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
`;

const StyledModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 20px;
    overflow: hidden;
    padding: 0;
    border: none;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    animation: ${fadeIn} 0.3s ease;
  }
  .ant-modal-header {
    display: none;
  }
  .ant-modal-body {
    padding: 0;
  }
  .ant-modal-footer {
    display: none;
  }
`;

const ModalContent = styled.div`
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #F8FAFC 100%);
  padding: 40px 32px;
  text-align: center;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%);
    border-radius: 50%;
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -10%;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

const IconWrapper = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(37,99,235,0.3);
  animation: ${floatAnimation} 3s ease-in-out infinite;
  position: relative;
  z-index: 1;
  .anticon {
    font-size: 36px;
    color: white;
  }
`;

const Title = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: ${colors.title};
  margin: 0 0 12px 0;
  position: relative;
  z-index: 1;
`;

const Description = styled.p`
  font-size: 15px;
  color: ${colors.text};
  margin: 0 0 32px 0;
  line-height: 1.6;
  position: relative;
  z-index: 1;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  position: relative;
  z-index: 1;
`;

const PrimaryButton = styled(Button)`
  && {
    height: 48px;
    padding: 0 32px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 15px;
    background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
    border: none;
    box-shadow: 0 4px 16px rgba(37,99,235,0.3);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(37,99,235,0.4);
      background: linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%);
    }
    &:active {
      transform: translateY(0);
    }
    .anticon {
      margin-right: 8px;
    }
  }
`;

const SecondaryButton = styled(Button)`
  && {
    height: 48px;
    padding: 0 32px;
    border-radius: 12px;
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

const LoginPromptModal = ({ visible, onClose, onLogin }) => {
  return (
    <StyledModal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      maskClosable={true}
      destroyOnClose
    >
      <ModalContent>
        <IconWrapper>
          <UserOutlined />
        </IconWrapper>
        <Title>请先登录</Title>
        <Description>
          登录后即可使用全部功能<br />
          体验AI智能招聘的便捷服务
        </Description>
        <ButtonGroup>
          <SecondaryButton onClick={onClose}>
            稍后再说
          </SecondaryButton>
          <PrimaryButton type="primary" onClick={onLogin}>
            <LoginOutlined />
            快去登录
          </PrimaryButton>
        </ButtonGroup>
      </ModalContent>
    </StyledModal>
  );
};

export default LoginPromptModal;
