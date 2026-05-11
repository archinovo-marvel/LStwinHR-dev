import React from 'react';
import { Select, Slider, Popover } from 'antd';
import styled from 'styled-components';
import { colors } from '../../theme/colors';

// Icons
const IconMic = ({ size = 20, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const IconStop = ({ size = 20, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const IconVolume = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const IconUpload = ({ size = 18, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconTrash = ({ size = 14, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconMemory = ({ size = 16, color = 'currentColor', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10" />
    <path d="M12 2a10 10 0 0 1 10 10" />
    <path d="M12 6v6l4 2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconCheck = ({ size = 10, color = '#FFFFFF', strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconSend = ({ size = 16, color = '#FFFFFF', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

// Styles
const InputRow = styled.div`
  background: #FFFFFF;
  padding: 16px 20px;
  border-top: 1px solid ${colors.border};
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const MemoryToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: ${props => props.$enabled ? colors.bgSecondary : 'rgba(148, 163, 184, 0.1)'};
  border: 1px solid ${props => props.$enabled ? colors.border : 'rgba(148, 163, 184, 0.2)'};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  color: ${props => props.$enabled ? colors.text : colors.textMuted};
  font-weight: 500;

  &:hover {
    background: ${props => props.$enabled ? colors.border : 'rgba(148, 163, 184, 0.15)'};
  }
`;

const CheckboxBox = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid ${props => props.$enabled ? colors.highlight : 'rgba(148, 163, 184, 0.4)'};
  background: ${props => props.$enabled ? colors.highlight : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
`;

const RoundCounter = styled.span`
  font-size: 13px;
  color: ${colors.textMuted};
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  strong {
    color: ${colors.accent};
    font-weight: 600;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 14px;
  padding: 8px 16px;
  transition: all 0.2s;

  &:focus-within {
    border-color: ${colors.highlight};
    box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
  }
`;

const TextInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: ${colors.text};
  height: 40px;

  &::placeholder { color: ${colors.textMuted}; }
`;

const IconBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${colors.textMuted};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: ${colors.bgSecondary};
    color: ${colors.accent};
  }

  &.recording {
    background: rgba(239, 68, 68, 0.1);
    color: ${colors.danger};
  }
`;

const SendBtn = styled.button`
  height: 44px;
  padding: 0 22px;
  border-radius: 10px;
  background: ${colors.accent};
  border: none;
  color: white;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(44, 44, 44, 0.15);

  &:hover {
    background: ${colors.highlight};
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(44, 44, 44, 0.2);
  }

  &:disabled {
    background: ${colors.textMuted};
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const UploadBtn = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: ${colors.bgSecondary};
  color: ${colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);

  &:hover {
    background: ${colors.highlight};
    color: white;
  }
`;

const AttachmentTray = styled.div`
  display: flex;
  gap: 10px;
  padding: 0 20px 14px;
  flex-wrap: wrap;
`;

const AttachmentCard = styled.div`
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.border};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const RemoveBtn = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EDGE_TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: '女', style: '温柔' },
  { id: 'zh-CN-YunxiNeural', name: '云希', gender: '男', style: '阳光' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: '女', style: '温暖' },
  { id: 'zh-CN-YunjianNeural', name: '云健', gender: '男', style: '播音' },
];

const InputBar = ({
  inputValue,
  setInputValue,
  isRecording,
  startRecording,
  stopRecording,
  voiceAnswerDraft,
  onConfirmVoiceAnswer,
  onKeepEditingVoiceAnswer,
  onDismissVoiceAnswer,
  memoryEnabled,
  handleMemoryToggleChange,
  currentRounds,
  enginePreference,
  localEngineSelected,
  localVisionEnabled,
  attachedImages,
  removeAttachedImage,
  imageInputRef,
  handleSelectVisionImage,
  sendMessage,
  isLoading,
  ttsConfig,
  setTtsConfig
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {voiceAnswerDraft?.text && voiceAnswerDraft.requiresConfirm && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 12px',
          marginBottom: 12,
          borderRadius: 14,
          border: '1px solid #bfdbfe',
          background: '#eff6ff',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginBottom: 4 }}>语音回答已转写</div>
            <div style={{ fontSize: 13, color: '#1e3a8a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{voiceAnswerDraft.text}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onKeepEditingVoiceAnswer}
              style={{
                border: '1px solid #93c5fd',
                background: '#ffffff',
                color: '#1d4ed8',
                borderRadius: 10,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              继续编辑
            </button>
            <button
              type="button"
              onClick={onConfirmVoiceAnswer}
              style={{
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                borderRadius: 10,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              提交回答
            </button>
            <button
              type="button"
              onClick={onDismissVoiceAnswer}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                borderRadius: 10,
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              稍后
            </button>
          </div>
        </div>
      )}

      {localEngineSelected && localVisionEnabled && attachedImages.length > 0 && (
        <AttachmentTray>
          {attachedImages.map(img => (
            <AttachmentCard key={img.id}>
              <img src={img.dataUrl} alt={img.name} />
              <RemoveBtn onClick={() => removeAttachedImage(img.id)}>
                <IconTrash size={12} />
              </RemoveBtn>
            </AttachmentCard>
          ))}
        </AttachmentTray>
      )}

      <InputRow>
        <MemoryToggle
          $enabled={memoryEnabled}
          onClick={() => handleMemoryToggleChange(!memoryEnabled)}
        >
          <IconMemory size={14} color={memoryEnabled ? colors.highlight : colors.textMuted} />
          <span>记忆</span>
          <CheckboxBox $enabled={memoryEnabled}>
            <IconCheck size={10} color="#FFFFFF" />
          </CheckboxBox>
        </MemoryToggle>

        <RoundCounter>
          轮数: <strong>{currentRounds}</strong>
        </RoundCounter>

        {enginePreference === 'local' && (
          <Popover
            trigger="click"
            placement="topLeft"
            content={
              <div style={{ width: 260, padding: '8px 0' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4, fontSize: 13, color: '#666', fontWeight: 500 }}>音色选择</div>
                  <Select
                    style={{ width: '100%' }}
                    value={ttsConfig.voice}
                    onChange={v => setTtsConfig(prev => ({ ...prev, voice: v }))}
                    options={EDGE_TTS_VOICES.map(v => ({ value: v.id, label: `${v.name} (${v.gender} · ${v.style})` }))}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>语速: {ttsConfig.rate}</div>
                  <Slider
                    min={-50} max={100} step={10}
                    value={parseInt(ttsConfig.rate) || 0}
                    onChange={v => setTtsConfig(prev => ({ ...prev, rate: `${v >= 0 ? '+' : ''}${v}%` }))}
                    marks={{ '-50': '慢', 0: '正常', 100: '快' }}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>音量: {ttsConfig.volume}</div>
                  <Slider
                    min={-50} max={50} step={10}
                    value={parseInt(ttsConfig.volume) || 0}
                    onChange={v => setTtsConfig(prev => ({ ...prev, volume: `${v >= 0 ? '+' : ''}${v}%` }))}
                    marks={{ '-50': '低', 0: '正常', 50: '高' }}
                  />
                </div>
              </div>
            }
          >
            <IconBtn title="语音设置（Edge-TTS）">
              <IconVolume size={14} />
            </IconBtn>
          </Popover>
        )}

        <InputWrapper>
          <TextInput
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题，招聘灵犀将为您提供专业解答..."
          />
          <IconBtn
            className={isRecording ? 'recording' : ''}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? '停止' : '语音输入'}
          >
            {isRecording ? <IconStop size={16} color={colors.danger} /> : <IconMic size={16} />}
          </IconBtn>
        </InputWrapper>

        {localEngineSelected && localVisionEnabled && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleSelectVisionImage}
            />
            <UploadBtn onClick={() => imageInputRef.current?.click()} title="上传图片">
              <IconUpload size={18} color={colors.text} />
            </UploadBtn>
          </>
        )}

        <SendBtn
          onClick={sendMessage}
          disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoading}
        >
          <IconSend size={15} />
          发送
        </SendBtn>
      </InputRow>
    </>
  );
};

export default InputBar;
