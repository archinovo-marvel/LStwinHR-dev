/**
 * 回答输入组件
 * 候选人输入回答的区域
 */
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Button, message } from 'antd';
import { SendOutlined, ForwardOutlined, LoadingOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';

// ============================================
// STYLED COMPONENTS
// ============================================
const InputWrapper = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const InputHeader = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;

  .anticon {
    color: ${colors.accent};
  }
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 14px 16px;
  border: 1px solid ${colors.border};
  border-radius: 12px;
  font-size: 15px;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 1.6;
  color: ${colors.text};
  background: ${colors.frost};
  resize: vertical;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &::placeholder {
    color: ${colors.textMuted};
  }

  &:hover {
    border-color: ${colors.accent};
    background: ${colors.surface};
  }

  &:focus {
    outline: none;
    border-color: ${colors.accent};
    box-shadow: 0 0 0 3px ${colors.accentSub};
    background: ${colors.surface};
  }

  &:disabled {
    background: ${colors.frost};
    cursor: not-allowed;
  }
`;

const InputFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
`;

const CharCount = styled.div`
  font-size: 13px;
  color: ${props => props.$warning ? colors.warning : colors.textMuted};
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const SkipButton = styled(Button)`
  border-color: ${colors.border};
  color: ${colors.textSecondary};

  &:hover {
    border-color: ${colors.accent} !important;
    color: ${colors.accent} !important;
  }
`;

const SubmitButton = styled(Button)`
  background: ${colors.accent} !important;
  border-color: ${colors.accent} !important;
  color: white !important;
  font-weight: 500;

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

// ============================================
// COMPONENT
// ============================================
const AnswerInput = ({
  value,
  onChange,
  onSubmit,
  onSkip,
  disabled = false,
  loading = false,
  minLength = 10
}) => {
  const charCount = value?.length || 0;
  const isTooShort = charCount > 0 && charCount < minLength;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!value || value.trim().length < minLength) {
      message.warning(`回答内容至少需要 ${minLength} 个字符`);
      return;
    }
    onSubmit?.();
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <InputWrapper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <InputHeader>
        💬 你的回答
      </InputHeader>

      <StyledTextArea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="请输入你的回答..."
        disabled={disabled || loading}
      />

      <InputFooter>
        <CharCount $warning={isTooShort}>
          {charCount} / {minLength} 字符（最少）
        </CharCount>

        <ButtonGroup>
          <SkipButton
            onClick={handleSkip}
            disabled={disabled || loading}
            icon={<ForwardOutlined />}
          >
            跳过此题
          </SkipButton>
          <SubmitButton
            onClick={handleSubmit}
            disabled={disabled || loading || isTooShort}
            icon={loading ? <LoadingOutlined /> : <SendOutlined />}
          >
            {loading ? '提交中...' : '提交回答'}
          </SubmitButton>
        </ButtonGroup>
      </InputFooter>
    </InputWrapper>
  );
};

export default AnswerInput;