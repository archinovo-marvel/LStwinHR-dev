import React from 'react';
import styled from 'styled-components';
import { colors } from '../../theme/colors';

// Icons
const IconBot = ({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" />
    <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" />
  </svg>
);

const IconWarning = ({ size = 20, color = '#EF4444', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconPanelLeft = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

const IconPanelRight = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M15 3v18" />
  </svg>
);

// Styles
const VirtualHumanPanelStyled = styled.div`
  background: #FFFFFF;
  border: 1px solid ${colors.border};
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 280px);
  min-height: 500px;
  position: sticky;
  top: 24px;
`;

const VHPanelHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid ${colors.border};

  h3 {
    font-family: 'Noto Serif SC', Georgia, serif;
    font-size: 18px;
    font-weight: 400;
    color: ${colors.text};
    margin: 0 0 4px 0;
  }

  p {
    font-size: 13px;
    color: ${colors.textMuted};
    margin: 0;
  }
`;

const VHPanelToggle = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid ${colors.border};
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textMuted};
  transition: all 0.2s;

  &:hover {
    border-color: ${colors.accent};
    color: ${colors.accent};
  }
`;

const VHContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
  background: ${colors.bg};
  position: relative;
`;

const VHAvatar = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${colors.highlight} 0%, ${colors.accent} 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(139, 115, 85, 0.25);
  animation: float 4s ease-in-out infinite;
`;

const VHName = styled.div`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  color: ${colors.text};
  margin-bottom: 8px;
`;

const VHDesc = styled.p`
  font-size: 13px;
  color: ${colors.textMuted};
  line-height: 1.6;
  max-width: 240px;
`;

const VirtualHumanPanel = ({
  virtualHumanConnected,
  virtualHumanError,
  isVirtualPanelCollapsed,
  setIsVirtualPanelCollapsed
}) => {
  return (
    <VirtualHumanPanelStyled>
      <VHPanelHeader style={{ position: 'relative' }}>
        <VHPanelToggle onClick={() => setIsVirtualPanelCollapsed(!isVirtualPanelCollapsed)}>
          {isVirtualPanelCollapsed ? <IconPanelLeft size={14} /> : <IconPanelRight size={14} />}
        </VHPanelToggle>
        <h3>数字人形象</h3>
        <p>AI虚拟面试官实时互动</p>
      </VHPanelHeader>

      <VHContent>
        <VHAvatar>
          {virtualHumanError ? (
            <IconWarning size={48} color={colors.danger} />
          ) : (
            <IconBot size={48} color="#FFFFFF" />
          )}
        </VHAvatar>
        <VHName>招聘灵犀</VHName>
        <VHDesc>
          {virtualHumanError
            ? '数字人服务连接失败，请检查网络配置或联系管理员'
            : '随时为您服务，支持语音对话与实时面试评估'}
        </VHDesc>
      </VHContent>

      <div style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>连接状态</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: virtualHumanConnected ? colors.success : colors.danger
          }} />
          <span style={{ fontSize: 13, color: colors.text }}>
            {virtualHumanConnected ? '已连接' : '未连接'}
          </span>
        </div>
      </div>
    </VirtualHumanPanelStyled>
  );
};

export default VirtualHumanPanel;
