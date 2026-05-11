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
  color: ${colors.muted};
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
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(37,99,235,0.3);
  animation: float 4s ease-in-out infinite;
`;

const VHStage = styled.div`
  width: 100%;
  max-width: 260px;
  height: 320px;
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 24px;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid ${colors.border};
  box-shadow: 0 12px 32px rgba(37,99,235,0.12);

  > div {
    width: 100%;
    height: 100%;
  }
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
  virtualHumanStatus,
  virtualHumanNeedsInteraction,
  isVirtualPanelCollapsed,
  setIsVirtualPanelCollapsed,
  sdkEnabled,
  onRetryConnect,
  speechEnabled,
  audioMuted,
  onToggleSpeechEnabled,
  onToggleAudioMuted,
  diagnosticSummary,
  children
}) => {
  const statusMeta = (() => {
    if (!sdkEnabled) {
      return { label: '未启用', color: '#94A3B8', description: '当前环境未开启数字人能力' };
    }
    if (virtualHumanNeedsInteraction) {
      return { label: '等待交互', color: '#F59E0B', description: '请点击页面任意位置以恢复数字人音频' };
    }
    if (virtualHumanError || virtualHumanStatus === 'error') {
      return { label: '连接失败', color: '#EF4444', description: '数字人连接异常，可手动重试' };
    }
    if (virtualHumanStatus === 'connecting' || virtualHumanStatus === 'idle') {
      return { label: '连接中', color: '#2563EB', description: '正在初始化数字人服务' };
    }
    if (virtualHumanConnected) {
      return { label: '已连接', color: colors.success, description: '数字人已可播报面试问题与结束语' };
    }
    return { label: '未连接', color: '#94A3B8', description: '等待自动连接，仍可先使用文本模式' };
  })();

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
        {sdkEnabled ? (
          <VHStage>
            {children}
          </VHStage>
        ) : (
          <VHAvatar>
            {virtualHumanError ? (
              <IconWarning size={48} color="#EF4444" />
            ) : (
              <IconBot size={48} color="#FFFFFF" />
            )}
          </VHAvatar>
        )}
        <VHName>招聘灵犀</VHName>
        <VHDesc>
          {virtualHumanError
            ? '数字人服务连接失败，请检查网络配置或联系管理员'
            : sdkEnabled
              ? '数字人已接入面试主链路，可跟随面试问题与结束语进行播报'
              : '随时为您服务，支持语音对话与实时面试评估'}
        </VHDesc>
      </VHContent>

      <div style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>连接状态</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusMeta.color
          }} />
          <span style={{ fontSize: 13, color: colors.ink }}>
            {statusMeta.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 1.6 }}>
          {statusMeta.description}
        </div>
        {sdkEnabled && !virtualHumanConnected && onRetryConnect && (
          <button
            type="button"
            onClick={onRetryConnect}
            disabled={virtualHumanStatus === 'connecting'}
            style={{
              marginTop: 12,
              width: '100%',
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              background: virtualHumanStatus === 'connecting' ? '#cbd5e1' : colors.accent,
              color: '#fff',
              cursor: virtualHumanStatus === 'connecting' ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {virtualHumanStatus === 'connecting' ? '连接中...' : '重试连接数字人'}
          </button>
        )}
        {sdkEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={onToggleSpeechEnabled}
              style={{
                border: `1px solid ${speechEnabled ? '#bfdbfe' : '#fecaca'}`,
                borderRadius: 10,
                padding: '10px 12px',
                background: speechEnabled ? '#eff6ff' : '#fef2f2',
                color: speechEnabled ? '#1d4ed8' : '#b91c1c',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {speechEnabled ? '播报已开启' : '播报已关闭'}
            </button>
            <button
              type="button"
              onClick={onToggleAudioMuted}
              style={{
                border: `1px solid ${audioMuted ? '#fecaca' : '#bfdbfe'}`,
                borderRadius: 10,
                padding: '10px 12px',
                background: audioMuted ? '#fef2f2' : '#eff6ff',
                color: audioMuted ? '#b91c1c' : '#1d4ed8',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {audioMuted ? '当前静音' : '声音已开启'}
            </button>
          </div>
        )}
        {sdkEnabled && diagnosticSummary && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>诊断摘要</div>
            <div style={{ fontSize: 12, color: colors.ink }}>
              最近事件数：{diagnosticSummary.count}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 1.6 }}>
              最近事件：{diagnosticSummary.lastEvent ? `${diagnosticSummary.lastEvent.type} · ${diagnosticSummary.lastEvent.detail}` : '暂无'}
            </div>
          </div>
        )}
      </div>
    </VirtualHumanPanelStyled>
  );
};

export default VirtualHumanPanel;
