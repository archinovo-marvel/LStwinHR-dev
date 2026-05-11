import React from 'react';
import styled from 'styled-components';
import { colors } from '../../theme/colors';

// Styles
const ResultsCardWrapper = styled.div`
  border-radius: 16px;
  border: 1px solid ${colors.border};
  margin-top: 16px;
  background: ${colors.bg};
  overflow: hidden;
`;

const ResultsCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid ${colors.border};
`;

const ResultsCardTitle = styled.div`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 15px;
  color: ${colors.text};
`;

const TextBtn = styled.button`
  background: none;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  color: ${colors.text};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${colors.bgSecondary};
    border-color: ${colors.textMuted};
  }
`;

const ResultGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
`;

const ScoreBig = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 400;
  color: ${colors.highlight};
`;

const ScoreBar = styled.div`
  height: 8px;
  border-radius: 4px;
  background: ${colors.bgSecondary};
  margin-top: 8px;
  overflow: hidden;

  .fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, ${colors.highlight}, ${colors.accent});
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

const StrengthItem = styled.li`
  padding: 8px 0;
  border-bottom: 1px solid ${colors.border};
  font-size: 14px;
  color: ${colors.text};

  &:last-child { border-bottom: none; }
`;

// P0改进：8维度配置
const DIMENSION_CONFIG = {
  // IQ/EQ/AQ/MQ 维度（用于分类展示）
  category: {
    iq: { label: '智商 IQ', maxScore: 50, color: '#1890ff' },
    eq: { label: '情商 EQ', maxScore: 20, color: '#52c41a' },
    aq: { label: '逆商 AQ', maxScore: 15, color: '#faad14' },
    mq: { label: '德商 MQ', maxScore: 15, color: '#722ed1' }
  },
  // 8维度评分展示配置
  evaluation: [
    { key: 'relevance', label: '相关性', color: '#1890ff' },
    { key: 'depth', label: '深度', color: '#52c41a' },
    { key: 'clarity', label: '清晰度', color: '#faad14' },
    { key: 'professionalism', label: '专业性', color: '#722ed1' },
    { key: 'evidence', label: '证据性', color: '#eb2f96' },
    { key: 'actionability', label: '可执行性', color: '#13c2c2' },
    { key: 'selfAwareness', label: '自我认知', color: '#fa8c16' },
    { key: 'growthMindset', label: '成长思维', color: '#2f54eb' }
  ]
};

// 维度评分条组件
const DimensionScoreBar = ({ label, score, maxScore = 10, color }) => {
  const percentage = (score / maxScore) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: colors.text }}>{label}</span>
        <span style={{ fontSize: 13, color: colors.textMuted }}>{score}/{maxScore}</span>
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: colors.bgSecondary,
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${percentage}%`,
          borderRadius: 3,
          background: color || colors.highlight,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      </div>
    </div>
  );
};

const InterviewResults = ({
  interviewScoring,
  completedInterviewCandidate,
  showInterviewResults,
  setShowInterviewResults
}) => {
  if (!showInterviewResults || !interviewScoring || !completedInterviewCandidate) {
    return null;
  }

  // 获取8维度评分数据（如果有）
  const evaluationScores = interviewScoring.evaluationScores || {};
  const hasEvaluationScores = Object.keys(evaluationScores).length > 0;

  return (
    <ResultsCardWrapper>
      <ResultsCardHeader>
        <ResultsCardTitle>面试评分结果 - {completedInterviewCandidate.name} ({completedInterviewCandidate.position})</ResultsCardTitle>
        <TextBtn onClick={() => setShowInterviewResults(false)}>关闭</TextBtn>
      </ResultsCardHeader>

      {/* 总体评分 */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
        <ResultGrid>
          <div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>总体评分</div>
            <ScoreBig>{interviewScoring.totalScore}/100</ScoreBig>
            <ScoreBar><div className="fill" style={{ width: `${interviewScoring.totalScore}%` }} /></ScoreBar>
          </div>
          <div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>四维度评分</div>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <div>智商 IQ: {interviewScoring.categoryScores?.iq?.score || 0}/50</div>
              <div>情商 EQ: {interviewScoring.categoryScores?.eq?.score || 0}/20</div>
              <div>逆商 AQ: {interviewScoring.categoryScores?.aq?.score || 0}/15</div>
              <div>德商 MQ: {interviewScoring.categoryScores?.mq?.score || 0}/15</div>
            </div>
          </div>
        </ResultGrid>
      </div>

      {/* P0改进：8维度详细评分展示 */}
      {hasEvaluationScores && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>8维度详细评分</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {DIMENSION_CONFIG.evaluation.map(dim => (
              <DimensionScoreBar
                key={dim.key}
                label={dim.label}
                score={evaluationScores[dim.key] || 5}
                maxScore={10}
                color={dim.color}
              />
            ))}
          </div>
        </div>
      )}

      {/* 优势 */}
      {interviewScoring.strengths?.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>优势</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {interviewScoring.strengths.map((s, i) => (
              <StrengthItem key={i}>{s.description}</StrengthItem>
            ))}
          </ul>
        </div>
      )}

      {/* 待改进 */}
      {interviewScoring.weaknesses?.length > 0 && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>待改进</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {interviewScoring.weaknesses.map((w, i) => (
              <StrengthItem key={i}>{w.description}</StrengthItem>
            ))}
          </ul>
        </div>
      )}
    </ResultsCardWrapper>
  );
};

export default InterviewResults;
