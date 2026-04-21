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

const InterviewResults = ({
  interviewScoring,
  completedInterviewCandidate,
  showInterviewResults,
  setShowInterviewResults
}) => {
  if (!showInterviewResults || !interviewScoring || !completedInterviewCandidate) {
    return null;
  }

  return (
    <ResultsCardWrapper>
      <ResultsCardHeader>
        <ResultsCardTitle>面试评分结果 - {completedInterviewCandidate.name} ({completedInterviewCandidate.position})</ResultsCardTitle>
        <TextBtn onClick={() => setShowInterviewResults(false)}>关闭</TextBtn>
      </ResultsCardHeader>
      <ResultGrid>
        <div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>总体评分</div>
          <ScoreBig>{interviewScoring.totalScore}分</ScoreBig>
          <ScoreBar><div className="fill" style={{ width: `${interviewScoring.totalScore}%` }} /></ScoreBar>
        </div>
        <div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>分项评分</div>
          <div style={{ fontSize: 14, lineHeight: 2 }}>
            <div>回答质量: {interviewScoring.categoryScores?.answerQuality?.score || 0}/40</div>
            <div>沟通能力: {interviewScoring.categoryScores?.communication?.score || 0}/25</div>
            <div>专业能力: {interviewScoring.categoryScores?.professionalism?.score || 0}/20</div>
            <div>态度动机: {interviewScoring.categoryScores?.attitude?.score || 0}/15</div>
          </div>
        </div>
      </ResultGrid>
      {interviewScoring.strengths?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>优势</div>
          <ul style={{ paddingLeft: 20 }}>
            {interviewScoring.strengths.map((s, i) => <StrengthItem key={i}>{s.description}</StrengthItem>)}
          </ul>
        </div>
      )}
      {interviewScoring.weaknesses?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>待改进</div>
          <ul style={{ paddingLeft: 20 }}>
            {interviewScoring.weaknesses.map((w, i) => <StrengthItem key={i}>{w.description}</StrengthItem>)}
          </ul>
        </div>
      )}
    </ResultsCardWrapper>
  );
};

export default InterviewResults;
