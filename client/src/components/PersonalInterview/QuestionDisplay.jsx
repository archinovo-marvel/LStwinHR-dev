/**
 * 问题展示组件
 * 显示 AI 面试官的问题
 */
import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { RobotOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';

// ============================================
// STYLED COMPONENTS
// ============================================
const QuestionWrapper = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const QuestionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const AvatarIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 20px;
    color: ${colors.accent};
  }
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const HeaderLabel = styled.div`
  font-size: 13px;
  color: ${colors.textMuted};
  margin-bottom: 2px;
`;

const QuestionType = styled.div`
  font-size: 12px;
  color: ${colors.accent};
  font-weight: 500;
`;

const QuestionContent = styled.div`
  font-size: 16px;
  color: ${colors.text};
  line-height: 1.7;
  padding: 16px 20px;
  background: ${colors.frost};
  border-radius: 12px;
  border-left: 3px solid ${colors.accent};
`;

const QuestionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid ${colors.border};
`;

const IntentTag = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${colors.accentSub};
  border-radius: 6px;
  font-size: 13px;
  color: ${colors.accent};

  .anticon {
    font-size: 12px;
  }
`;

const QuestionNumber = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.textMuted};
`;

// ============================================
// COMPONENT
// ============================================
const QuestionDisplay = ({
  question,
  questionNumber,
  totalQuestions,
  loading = false
}) => {
  if (!question && !loading) {
    return null;
  }

  const questionTypeLabels = {
    technical: '技术问题',
    behavioral: '行为面试',
    experience: '经验深挖',
    situational: '情景问题',
    project: '项目实战',
    career: '职业发展',
    'follow-up': '追问'
  };

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <QuestionWrapper>
            <QuestionHeader>
              <AvatarIcon>
                <RobotOutlined />
              </AvatarIcon>
              <HeaderInfo>
                <HeaderLabel>AI 面试官正在思考...</HeaderLabel>
              </HeaderInfo>
            </QuestionHeader>
            <QuestionContent style={{ opacity: 0.6 }}>
              正在为您生成下一个问题，请稍候...
            </QuestionContent>
          </QuestionWrapper>
        </motion.div>
      ) : (
        <motion.div
          key={question?.id || 'question'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <QuestionWrapper>
            <QuestionHeader>
              <AvatarIcon>
                <RobotOutlined />
              </AvatarIcon>
              <HeaderInfo>
                <HeaderLabel>AI 面试官</HeaderLabel>
                <QuestionType>
                  {questionTypeLabels[question?.questionType] || '面试问题'}
                </QuestionType>
              </HeaderInfo>
              <QuestionNumber>
                第 {questionNumber} / {totalQuestions} 题
              </QuestionNumber>
            </QuestionHeader>

            <QuestionContent>
              {question?.question}
            </QuestionContent>

            {question?.intent && (
              <QuestionMeta>
                <IntentTag>
                  <QuestionCircleOutlined />
                  考察：{question.intent}
                </IntentTag>
              </QuestionMeta>
            )}
          </QuestionWrapper>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuestionDisplay;