/**
 * 对话记录组件
 * 显示面试过程中的对话历史
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { DownOutlined, UpOutlined, RobotOutlined, UserOutlined, TrophyOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';

// ============================================
// STYLED COMPONENTS
// ============================================
const ConversationWrapper = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const ConversationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: ${colors.frost};
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: ${colors.accentSub};
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const HeaderIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 14px;
    color: ${colors.accent};
  }
`;

const HeaderTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
`;

const HeaderCount = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
`;

const ToggleIcon = styled.div`
  color: ${colors.textMuted};
  transition: transform 0.2s ease;
`;

const ConversationBody = styled(motion.div)`
  max-height: 400px;
  overflow-y: auto;
  padding: 16px 20px;
`;

const QAItem = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const QABlock = styled.div`
  margin-bottom: 12px;
`;

const MessageRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
`;

const MessageIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${props => props.$isQuestion ? colors.accentSub : colors.frost};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .anticon {
    font-size: 12px;
    color: ${props => props.$isQuestion ? colors.accent : colors.textMuted};
  }
`;

const MessageContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const MessageLabel = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
  margin-bottom: 4px;
`;

const MessageText = styled.div`
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
  padding: 12px 16px;
  background: ${props => props.$isQuestion ? colors.accentSub : colors.frost};
  border-radius: 10px;
  border-top-left-radius: ${props => props.$isQuestion ? '2px' : '10px'};
`;

const ScoreBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: ${props => props.$color || colors.accentSub};
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.$textColor || colors.accent};
  margin-top: 8px;
`;

// ============================================
// COMPONENT
// ============================================
const ConversationRecord = ({
  conversation = [],
  defaultExpanded = false
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!conversation || conversation.length === 0) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 8) return { bg: 'rgba(34, 197, 94, 0.1)', text: colors.success };
    if (score >= 6) return { bg: colors.accentSub, text: colors.accent };
    if (score >= 4) return { bg: 'rgba(245, 158, 11, 0.1)', text: colors.warning };
    return { bg: 'rgba(239, 68, 68, 0.1)', text: colors.error };
  };

  return (
    <ConversationWrapper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <ConversationHeader onClick={() => setExpanded(!expanded)}>
        <HeaderLeft>
          <HeaderIcon>
            <RobotOutlined />
          </HeaderIcon>
          <HeaderTitle>对话记录</HeaderTitle>
          <HeaderCount>{conversation.length} 个问题</HeaderCount>
        </HeaderLeft>
        <ToggleIcon>
          {expanded ? <UpOutlined /> : <DownOutlined />}
        </ToggleIcon>
      </ConversationHeader>

      <AnimatePresence>
        {expanded && (
          <ConversationBody
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {conversation.map((item, index) => (
              <QAItem key={item.id || index}>
                <QABlock>
                  <MessageRow>
                    <MessageIcon $isQuestion>
                      <RobotOutlined />
                    </MessageIcon>
                    <MessageContent>
                      <MessageLabel>Q{index + 1}</MessageLabel>
                      <MessageText $isQuestion>
                        {item.question}
                      </MessageText>
                    </MessageContent>
                  </MessageRow>
                </QABlock>

                {item.answer && (
                  <QABlock>
                    <MessageRow>
                      <MessageIcon $isQuestion={false}>
                        <UserOutlined />
                      </MessageIcon>
                      <MessageContent>
                        <MessageLabel>回答</MessageLabel>
                        <MessageText $isQuestion={false}>
                          {item.answer}
                        </MessageText>
                        {item.score !== null && item.score !== undefined && (
                          <ScoreBadge
                            $color={getScoreColor(item.score).bg}
                            $textColor={getScoreColor(item.score).text}
                          >
                            <TrophyOutlined />
                            {item.score.toFixed(1)} 分
                          </ScoreBadge>
                        )}
                      </MessageContent>
                    </MessageRow>
                  </QABlock>
                )}
              </QAItem>
            ))}
          </ConversationBody>
        )}
      </AnimatePresence>
    </ConversationWrapper>
  );
};

export default ConversationRecord;