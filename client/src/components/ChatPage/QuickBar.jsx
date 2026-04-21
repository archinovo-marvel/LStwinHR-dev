import React from 'react';
import styled from 'styled-components';
import { colors } from '../../theme/colors';
import { quickQuestions } from './constants';

const QuickBarStyled = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 24px;

  .quick-label {
    color: ${colors.textMuted};
    font-size: 13px;
    font-weight: 500;
    margin-right: 4px;
  }

  .quick-btn {
    background: ${colors.bgSecondary};
    color: ${colors.text};
    border: none;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;

    &:hover {
      background: ${colors.accent};
      color: white;
      transform: translateY(-1px);
    }
  }
`;

const QuickBar = ({ setInputValue }) => {
  return (
    <QuickBarStyled>
      <span className="quick-label">快捷问题</span>
      {quickQuestions.map((q, i) => (
        <button key={i} className="quick-btn" onClick={() => setInputValue(q)}>{q}</button>
      ))}
    </QuickBarStyled>
  );
};

export default QuickBar;
