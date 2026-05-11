import { useState, useRef, useCallback, useEffect } from 'react';

export function useVirtualHumanBridge({
  enabled,
  setMessages,
  setStreamingMessage,
  setShowActiveReplyBubble,
  onVoiceTranscript,
  setInputValue,
  getRequiresVoiceConfirm,
}) {
  const [virtualHumanConnected, setVirtualHumanConnected] = useState(false);
  const [virtualHumanError, setVirtualHumanError] = useState(false);
  const [virtualHumanStatus, setVirtualHumanStatus] = useState(enabled ? 'connecting' : 'disabled');
  const [virtualHumanNeedsInteraction, setVirtualHumanNeedsInteraction] = useState(false);
  const [isVirtualPanelCollapsed, setIsVirtualPanelCollapsed] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [diagnosticEvents, setDiagnosticEvents] = useState([]);
  const [voiceAnswerDraft, setVoiceAnswerDraft] = useState(null);

  const virtualHumanErrorTimeoutRef = useRef(null);
  const virtualHumanRef = useRef(null);
  const lastCompletedSpeechMessageIdRef = useRef(null);
  const lastBotMessageRef = useRef({ content: '', timestamp: 0 });

  const speakWithVirtualHuman = useCallback(async (text) => {
    if (!speechEnabled || audioMuted || !virtualHumanConnected || !text || !virtualHumanRef.current?.speakText) return;
    try {
      await virtualHumanRef.current.speakText(text);
      setDiagnosticEvents(prev => [...prev.slice(-19), { type: 'speak-success', timestamp: new Date().toISOString(), detail: String(text).slice(0, 80) }]);
    } catch (error) {
      setDiagnosticEvents(prev => [...prev.slice(-19), { type: 'speak-failed', timestamp: new Date().toISOString(), detail: String(error?.message || error || 'unknown') }]);
      console.warn('数字人播报失败:', error);
    }
  }, [audioMuted, speechEnabled, virtualHumanConnected]);

  const appendBotMessage = useCallback((text, options = {}) => {
    const content = String(text || '').trim();
    if (!content) return;

    const now = Date.now();
    const shouldDedupe = options.dedupe !== false;
    if (shouldDedupe) {
      const lastBotMessage = lastBotMessageRef.current;
      if (lastBotMessage.content === content && now - lastBotMessage.timestamp < 1500) {
        return;
      }
    }

    lastBotMessageRef.current = { content, timestamp: now };
    setMessages(prev => [...prev, { id: now + Math.random(), type: 'bot', content, timestamp: new Date() }]);

    if (options.speak !== false) {
      speakWithVirtualHuman(content);
    }
  }, [setMessages, speakWithVirtualHuman]);

  const handleVirtualHumanStatusChange = useCallback((status) => {
    const normalizedStatus = typeof status === 'string'
      ? { currentStatus: status, isConnected: status === 'connected', error: status === 'error' ? new Error('数字人连接失败') : null }
      : (status || {});

    setVirtualHumanStatus(normalizedStatus.currentStatus || (normalizedStatus.isConnected ? 'connected' : 'disconnected'));
    setVirtualHumanConnected(Boolean(normalizedStatus.isConnected));
    setVirtualHumanNeedsInteraction(Boolean(normalizedStatus.needsUserInteraction));
    setDiagnosticEvents(prev => [...prev.slice(-19), {
      type: 'status-change',
      timestamp: new Date().toISOString(),
      detail: normalizedStatus.currentStatus || (normalizedStatus.isConnected ? 'connected' : 'disconnected')
    }]);

    if (normalizedStatus.currentStatus === 'error' || normalizedStatus.error) {
      if (virtualHumanErrorTimeoutRef.current) {
        clearTimeout(virtualHumanErrorTimeoutRef.current);
        virtualHumanErrorTimeoutRef.current = null;
      }
      setVirtualHumanError(true);
      return;
    }

    if (virtualHumanErrorTimeoutRef.current) {
      clearTimeout(virtualHumanErrorTimeoutRef.current);
    }
    virtualHumanErrorTimeoutRef.current = setTimeout(() => {
      setVirtualHumanError(false);
      virtualHumanErrorTimeoutRef.current = null;
    }, 500);
  }, []);

  const handleVirtualHumanReply = useCallback((text) => {
    appendBotMessage(text, { speak: false, dedupe: true });
  }, [appendBotMessage]);

  const applyVoiceTranscript = useCallback((transcript, options = {}) => {
    const text = String(transcript || '').trim();
    if (!text) return;

    const requiresConfirm = options.requiresConfirm !== undefined
      ? options.requiresConfirm
      : (typeof getRequiresVoiceConfirm === 'function' ? getRequiresVoiceConfirm() : false);

    if (typeof setInputValue === 'function') {
      setInputValue(text);
    }

    setVoiceAnswerDraft({
      text,
      requiresConfirm,
      source: options.source || 'browser-asr',
      timestamp: Date.now(),
    });
  }, [getRequiresVoiceConfirm, setInputValue]);

  const handleVirtualHumanAsrMessage = useCallback((text, payload) => {
    const transcript = String(text || '').trim();
    if (!transcript) return;

    setDiagnosticEvents(prev => [...prev.slice(-19), {
      type: 'asr-transcript',
      timestamp: new Date().toISOString(),
      detail: transcript.slice(0, 80),
    }]);

    applyVoiceTranscript(transcript, {
      source: 'sdk-asr',
    });

    if (typeof onVoiceTranscript === 'function') {
      onVoiceTranscript(transcript, {
        source: 'sdk-asr',
        payload,
      });
    }
  }, [applyVoiceTranscript, onVoiceTranscript]);

  const handleKeepEditingVoiceAnswer = useCallback(() => {
    setVoiceAnswerDraft(prev => (prev ? { ...prev, requiresConfirm: false } : null));
  }, []);

  const handleDismissVoiceAnswer = useCallback(() => {
    setVoiceAnswerDraft(null);
  }, []);

  const clearVoiceAnswerDraft = useCallback(() => {
    setVoiceAnswerDraft(null);
  }, []);

  const finishVirtualHumanStreaming = useCallback(() => {
    setStreamingMessage('');
    setShowActiveReplyBubble(false);
  }, [setShowActiveReplyBubble, setStreamingMessage]);

  const handleRetryVirtualHuman = useCallback(async () => {
    if (!virtualHumanRef.current?.connectAvatar) return;
    setVirtualHumanStatus('connecting');
    setDiagnosticEvents(prev => [...prev.slice(-19), { type: 'retry-connect', timestamp: new Date().toISOString(), detail: 'manual retry' }]);
    try {
      await virtualHumanRef.current.connectAvatar();
    } catch (error) {
      setDiagnosticEvents(prev => [...prev.slice(-19), { type: 'retry-failed', timestamp: new Date().toISOString(), detail: String(error?.message || error || 'unknown') }]);
      console.warn('手动重试数字人连接失败:', error);
      setVirtualHumanStatus('error');
      setVirtualHumanError(true);
    }
  }, []);

  const toggleSpeechEnabled = useCallback(() => {
    setSpeechEnabled(prev => {
      const next = !prev;
      setDiagnosticEvents(events => [...events.slice(-19), { type: 'speech-toggle', timestamp: new Date().toISOString(), detail: next ? 'enabled' : 'disabled' }]);
      return next;
    });
  }, []);

  const toggleAudioMuted = useCallback(() => {
    setAudioMuted(prev => {
      const nextMuted = !prev;
      if (virtualHumanRef.current?.setAudioEnabled) {
        virtualHumanRef.current.setAudioEnabled(!nextMuted);
      }
      setDiagnosticEvents(events => [...events.slice(-19), { type: 'audio-toggle', timestamp: new Date().toISOString(), detail: nextMuted ? 'muted' : 'unmuted' }]);
      return nextMuted;
    });
  }, []);

  const diagnosticSummary = diagnosticEvents.length > 0
    ? {
        count: diagnosticEvents.length,
        lastEvent: diagnosticEvents[diagnosticEvents.length - 1],
      }
    : {
        count: 0,
        lastEvent: null,
      };

  const handleCompletedSpeech = useCallback((message) => {
    if (!virtualHumanConnected || !message?.content) return;
    if (lastCompletedSpeechMessageIdRef.current === message.id) return;
    lastCompletedSpeechMessageIdRef.current = message.id;
    speakWithVirtualHuman(message.content);
  }, [speakWithVirtualHuman, virtualHumanConnected]);

  useEffect(() => {
    return () => {
      if (virtualHumanErrorTimeoutRef.current) {
        clearTimeout(virtualHumanErrorTimeoutRef.current);
      }
    };
  }, []);

  return {
    virtualHumanConnected,
    virtualHumanError,
    virtualHumanStatus,
    virtualHumanNeedsInteraction,
    isVirtualPanelCollapsed,
    setIsVirtualPanelCollapsed,
    speechEnabled,
    audioMuted,
    voiceAnswerDraft,
    diagnosticSummary,
    virtualHumanRef,
    appendBotMessage,
    speakWithVirtualHuman,
    applyVoiceTranscript,
    handleVirtualHumanStatusChange,
    handleVirtualHumanReply,
    handleVirtualHumanAsrMessage,
    handleKeepEditingVoiceAnswer,
    handleDismissVoiceAnswer,
    clearVoiceAnswerDraft,
    finishVirtualHumanStreaming,
    handleRetryVirtualHuman,
    handleCompletedSpeech,
    toggleSpeechEnabled,
    toggleAudioMuted,
  };
}

export default useVirtualHumanBridge;