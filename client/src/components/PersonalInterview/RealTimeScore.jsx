/**
 * 实时评分组件
 * 显示当前题目的评分和反馈
 */
import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { TrophyOutlined, CheckCircleOutlined, BulbOutlined } from '@ant-design/icons';
import { colors } from '../../theme/colors';
import { getDimensionLabel } from '../../utils/personalInterviewApi';

// ============================================
// STYLED COMPONENTS
// ============================================
const ScoreWrapper = styled(motion.div)`
  background: ${colors.surface};
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
`;

const ScoreHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${colors.border};
`;

const ScoreIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${colors.accentSub};
  display: flex;
  align-items: center;
  justify-content: center;

  .anticon {
    font-size: 18px;
    color: ${colors.accent};
  }
`;

const ScoreTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${colors.text};
`;

const TotalScore = styled.div`
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const ScoreValue = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.$color || colors.accent};
`;

const ScoreMax = styled.span`
  font-size: 14px;
  color: ${colors.textMuted};
`;

const DimensionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
`;

const DimensionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const DimensionLabel = styled.div`
  width: 80px;
  font-size: 13px;
  color: ${colors.textSecondary};
`;

const DimensionBar = styled.div`
  flex: 1;
  height: 8px;
  background: ${colors.frost};
  border-radius: 4px;
  overflow: hidden;
`;

const DimensionFill = styled(motion.div)`
  height: 100%;
  background: ${props => props.$color || colors.accent};
  border-radius: 4px;
`;

const DimensionScore = styled.div`
  width: 32px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: ${colors.text};
  text-align: right;
`;

const FeedbackSection = styled.div`
  padding: 16px;
  background: ${colors.frost};
  border-radius: 10px;
`;

const FeedbackText = styled.div`
  font-size: 14px;
  color: ${colors.text};
  line-height: 1.6;
  margin-bottom: 12px;
`;

const StrengthsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const StrengthTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.1);
  color: ${colors.success};
  border-radius: 6px;
  font-size: 12px;
`;

const ImprovementTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(245, 158, 11, 0.1);
  color: ${colors.warning};
  border-radius: 6px;
  font-size: 12px;
`;

// ============================================
// COMPONENT
// ============================================
const RealTimeScore = ({
  evaluation,
  loading = false
}) => {
  if (!evaluation && !loading) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 8) return colors.success;
    if (score >= 6) return colors.accent;
    if (score >= 4) return colors.warning;
    return colors.error;
  };

  const dimensions = evaluation?.scores
    ? [
        { key: 'relevance', score: evaluation.scores.relevance },
        { key: 'clarity', score: evaluation.scores.clarity },
        { key: 'depth', score: evaluation.scores.depth },
        { key: 'professionalism', score: evaluation.scores.professionalism },
        { key: 'authenticity', score: evaluation.scores.authenticity }
      ]
    : [];

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ScoreWrapper>
            <ScoreHeader>
              <ScoreIcon>
                <TrophyOutlined />
              </ScoreIcon>
              <ScoreTitle>评分中...</ScoreTitle>
            </ScoreHeader>
          </ScoreWrapper>
        </motion.div>
      ) : (
        <motion.div
          key="score"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <ScoreWrapper>
            <ScoreHeader>
              <ScoreIcon>
                <TrophyOutlined />
              </ScoreIcon>
              <ScoreTitle>本题评分</ScoreTitle>
              <TotalScore>
                <ScoreValue $color={getScoreColor(evaluation?.totalScore || 0)}>
                  {evaluation?.totalScore?.toFixed(1) || '0.0'}
                </ScoreValue>
                <ScoreMax>/ 10</ScoreMax>
              </TotalScore>
            </ScoreHeader>

            {/* 维度评分 */}
            <DimensionList>
              {dimensions.map((dim, index) => (
                <DimensionItem key={dim.key}>
                  <DimensionLabel>{getDimensionLabel(dim.key)}</DimensionLabel>
                  <DimensionBar>
                    <DimensionFill
                      $color={getScoreColor(dim.score)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(dim.score / 10) * 100}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  </DimensionBar>
                  <DimensionScore>{dim.score.toFixed(1)}</DimensionScore>
                </DimensionItem>
              ))}
            </DimensionList>

            {/* 反馈 */}
            {evaluation?.feedback && (
              <FeedbackSection>
                <FeedbackText>{evaluation.feedback}</FeedbackText>

                {evaluation?.strengths?.length > 0 && (
                  <StrengthsList>
                    {evaluation.strengths.map((strength, i) => (
                      <StrengthTag key={i}>
                        <CheckCircleOutlined />
                        {strength}
                      </StrengthTag>
                    ))}
                  </StrengthsList>
                )}

                {evaluation?.improvements?.length > 0 && (
                  <StrengthsList style={{ marginTop: 8 }}>
                    {evaluation.improvements.map((improvement, i) => (
                      <ImprovementTag key={i}>
                        <BulbOutlined />
                        {improvement}
                      </ImprovementTag>
                    ))}
                  </StrengthsList>
                )}
              </FeedbackSection>
            )}
          </ScoreWrapper>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RealTimeScore;