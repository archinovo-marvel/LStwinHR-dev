import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const IconUser = ({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// Styles
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 48px 24px;

  .wave-icon {
    font-size: 64px;
    margin-bottom: 24px;
    animation: float 3s ease-in-out infinite;
  }

  .empty-title {
    font-family: 'Noto Serif SC', Georgia, serif;
    font-size: 24px;
    font-weight: 400;
    color: ${colors.text};
    margin-bottom: 12px;
  }

  .empty-desc {
    font-size: 15px;
    color: ${colors.textMuted};
    max-width: 400px;
    line-height: 1.6;
  }
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

const MessageRow = styled(motion.div)`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 24px;
  flex-direction: ${props => props.$isUser ? 'row-reverse' : 'row'};
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.$isUser ? colors.accent : `linear-gradient(135deg, ${colors.highlight} 0%, ${colors.accent} 100%)`};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px ${props => props.$isUser ? 'rgba(44, 44, 44, 0.2)' : 'rgba(139, 115, 85, 0.2)'};
`;

const Bubble = styled.div`
  max-width: 72%;
  padding: 14px 18px;
  border-radius: ${props => props.$isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
  background: ${props => props.$isUser ? colors.accent : '#FFFFFF'};
  color: ${props => props.$isUser ? '#FFFFFF' : colors.text};
  font-size: 15px;
  line-height: 1.65;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  border: ${props => props.$isUser ? 'none' : `1px solid ${colors.border}`};
  white-space: pre-wrap;
  word-break: break-word;
`;

const BotMetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: ${colors.textMuted};
  font-size: 12px;
  font-weight: 500;
`;

const BotMetaLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const BotMetaRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 12px;
  background: ${props => props.$active ? colors.bgSecondary : 'rgba(16, 185, 129, 0.1)'};
  color: ${props => props.$active ? colors.text : colors.success};
  font-size: 11px;
`;

const ThinkingSpinner = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${colors.border};
  border-top-color: ${colors.highlight};
  animation: spin 0.8s linear infinite;
`;

const ImageGrid = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
`;

const InlineImage = styled.img`
  width: 88px;
  height: 88px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.35);
`;

const ChatMessages = ({
  messages,
  streamingMessage,
  showActiveReplyBubble,
  chatContainerRef
}) => {
  const renderBotBubble = (content, options = {}) => {
    const { active = false, timestamp = null } = options;
    return (
      <>
        <BotMetaRow>
          <BotMetaLeft>
            <span>虚拟面试官</span>
          </BotMetaLeft>
          <BotMetaRight>
            {active ? (
              <StatusPill $active>
                <ThinkingSpinner />
                <span>正在回复</span>
              </StatusPill>
            ) : (
              <>
                <StatusPill>已完成</StatusPill>
                {timestamp && <span style={{ fontSize: '12px', color: colors.textMuted }}>{timestamp.toLocaleTimeString()}</span>}
              </>
            )}
          </BotMetaRight>
        </BotMetaRow>
        <div style={{ lineHeight: '1.75', minHeight: '28px', whiteSpace: 'pre-wrap' }}>
          {content}
          {active && <span style={{ animation: 'blink 1s infinite', marginLeft: 2 }}>|</span>}
        </div>
      </>
    );
  };

  return (
    <>
      {messages.length === 0 && !showActiveReplyBubble ? (
        <EmptyState>
          <VHAvatar style={{ width: 80, height: 80, marginBottom: 20 }}>
            <IconBot size={36} color="#FFFFFF" />
          </VHAvatar>
          <div className="empty-title">你好，我是招聘灵犀 AI面试官</div>
          <div className="empty-desc">你可以问我关于岗位、公司、面试的问题，我会为你提供专业的解答</div>
        </EmptyState>
      ) : (
        <>
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                $isUser={msg.type === 'user'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Avatar $isUser={msg.type === 'user'}>
                  {msg.type === 'user' ? <IconUser size={18} /> : <IconBot size={18} />}
                </Avatar>
                <Bubble $isUser={msg.type === 'user'}>
                  {msg.type === 'user' ? (
                    <>
                      {Array.isArray(msg.images) && msg.images.length > 0 && (
                        <ImageGrid>
                          {msg.images.map(img => (
                            <InlineImage key={img.id} src={img.dataUrl} alt={img.name} />
                          ))}
                        </ImageGrid>
                      )}
                      {msg.content}
                    </>
                  ) : (
                    renderBotBubble(msg.content, { timestamp: msg.timestamp })
                  )}
                </Bubble>
              </MessageRow>
            ))}
          </AnimatePresence>

          {showActiveReplyBubble && (
            <MessageRow $isUser={false}>
              <Avatar $isUser={false}>
                <IconBot size={18} />
              </Avatar>
              <Bubble $isUser={false}>
                {renderBotBubble(streamingMessage || '虚拟人正在思考...', { active: true })}
              </Bubble>
            </MessageRow>
          )}
        </>
      )}
    </>
  );
};

export default ChatMessages;
