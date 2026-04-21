import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import logFilter from '../../utils/logFilter.js';
import { useSDKConnection, isAutoplayError, wrapAutoplaySafe, ensurePlayerAudible, setupAutoplayRecovery } from './useSDKConnection.js';
import { useInterviewState } from './useInterviewState.js';
import { useNetworkDiagnostics, checkNetworkConnection } from './useNetworkDiagnostics.js';

const VirtualHumanSDK = forwardRef(({
  config = {},
  onStatusChange,
  onAvatarClick,
  onVirtualHumanReply,
  onVirtualHumanStreamingEnd,
  externalInterviewQuestions,
}, ref) => {
  // Core refs
  const avatarPlatformRef = useRef(null);
  const wrapperRef = useRef(null);

  // Core state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('idle');
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [networkDiagnosis, setNetworkDiagnosis] = useState(null);
  const [connectionAdvice, setConnectionAdvice] = useState([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Refs
  const pingIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // SDK Connection hook
  const sdkConnection = useSDKConnection({
    config,
    avatarPlatformRef,
    wrapAutoplaySafe,
    isAutoplayError,
    ensurePlayerAudible,
    setupAutoplayRecovery,
    onStatusChange,
    onVirtualHumanReply,
    onVirtualHumanStreamingEnd,
  });

  // Interview state hook
  const interviewHook = useInterviewState({
    externalInterviewQuestions,
    avatarPlatformRef,
    onVirtualHumanReply,
    onVirtualHumanReplyRef: useRef(onVirtualHumanReply),
  });

  const {
    interviewState,
    interviewStateRef,
    setInterviewState,
    interviewQuestions,
    askQuestion,
    handleNextQuestion,
    reAskCurrentQuestion,
    startInterview,
    stopInterview,
    handleCandidateAnswerComplete,
  } = interviewHook;

  // Network diagnostics
  const { performNetworkDiagnosis } = useNetworkDiagnostics();

  // Refs for callbacks
  const onStatusChangeRef = useRef(onStatusChange);
  const onVirtualHumanReplyRef = useRef(onVirtualHumanReply);
  const onVirtualHumanStreamingEndRef = useRef(onVirtualHumanStreamingEnd);

  // --- Cleanup effect ---
  useEffect(() => {
    logFilter.enable();
    return () => {
      if (sdkConnection.nlpFinalizeTimeoutRef.current) {
        clearTimeout(sdkConnection.nlpFinalizeTimeoutRef.current);
      }
      if (sdkConnection.frameStopFinalizeTimeoutRef.current) {
        clearTimeout(sdkConnection.frameStopFinalizeTimeoutRef.current);
      }
      logFilter.disable();
    };
  }, []);

  // --- Update callback refs ---
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { onVirtualHumanReplyRef.current = onVirtualHumanReply; }, [onVirtualHumanReply]);
  useEffect(() => { onVirtualHumanStreamingEndRef.current = onVirtualHumanStreamingEnd; }, [onVirtualHumanStreamingEnd]);

  // --- Resume playback ---
  const resumePlayback = useCallback(async () => {
    if (!avatarPlatformRef.current) return;
    try {
      const player = wrapAutoplaySafe(avatarPlatformRef.current.player);
      if (player) {
        if (typeof player.resume === 'function') await player.resume();
        else if (typeof player.play === 'function') await player.play();
        ensurePlayerAudible(player);
      }
      setNeedsUserInteraction(false);
      setUserInteracted(true);
    } catch (e) {
      if (isAutoplayError(e)) return;
      console.error('恢复播放失败:', e);
    }
  }, []);

  // --- Global user interaction listener ---
  useEffect(() => {
    const handleGlobalInteraction = async () => {
      if (!userInteracted) {
        setUserInteracted(true);
        setNeedsUserInteraction(false);
        if (avatarPlatformRef.current && isConnected) {
          try { await resumePlayback(); } catch (error) { console.warn('恢复播放失败:', error); }
        }
      }
    };
    ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
      document.addEventListener(event, handleGlobalInteraction, { once: true });
    });
    return () => { ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
      document.removeEventListener(event, handleGlobalInteraction);
    });};
  }, [userInteracted, isConnected, resumePlayback]);

  // --- Remove green background ---
  const removeGreenBackground = useCallback((silent = false) => {
    if (!wrapperRef.current) return;
    try {
      let hasChanges = false;
      wrapperRef.current.querySelectorAll('canvas, video').forEach(element => {
        if (element.style) {
          const currentBg = element.style.background || element.style.backgroundColor;
          if (currentBg && currentBg !== 'transparent') {
            element.style.background = 'transparent';
            element.style.backgroundColor = 'transparent';
            hasChanges = true;
          }
        }
      });
      if (!document.getElementById('virtual-human-transparent-style')) {
        const style = document.createElement('style');
        style.id = 'virtual-human-transparent-style';
        style.textContent = `.avatar-platform canvas,.avatar-platform video,.avatar-player canvas,.avatar-player video,.avatar-canvas canvas,.avatar-canvas video{background:transparent!important;background-color:transparent!important}`;
        document.head.appendChild(style);
        hasChanges = true;
      }
      if (hasChanges && !silent) console.log('已移除虚拟人绿色背景');
    } catch (error) { if (!silent) console.warn('移除绿色背景失败:', error); }
  }, []);

  // --- Ping functions ---
  const sendPing = useCallback(() => { console.log('发送ping心跳'); }, []);
  const startPing = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(sendPing, 5000);
  }, [sendPing]);
  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
  }, []);

  // --- Connect avatar ---
  const connectAvatar = useCallback(async () => {
    console.log('开始连接虚拟人...');
    if (isLoading || isConnected) { console.log('虚拟人已在连接中或已连接，跳过重复连接'); return; }

    const diagnosisPromise = performNetworkDiagnosis({ isDiagnosing, networkDiagnosis, setIsDiagnosing, setNetworkDiagnosis, setConnectionAdvice });
    const isNetworkOk = await checkNetworkConnection();
    if (!isNetworkOk) { setError(new Error('网络连接异常，请检查网络设置后重试')); setIsLoading(false); setCurrentStatus('error'); return; }

    console.log('⏭️ 跳过WebSocket连接测试，直接尝试连接虚拟人...');
    const diagnosis = await diagnosisPromise;
    if (diagnosis?.tests?.xfyun?.status === 'blocked') console.warn('⚠️ 检测到讯飞云服务可能被阻止，但继续尝试连接...');
    if (diagnosis?.tests?.baidu?.status === 'blocked') console.warn('⚠️ 检测到网络连接问题，但继续尝试连接...');

    if (!avatarPlatformRef.current) {
      console.log('SDK未初始化，先初始化SDK...');
      await sdkConnection.initializeSDK({ setIsConnected, setIsLoading, setError, setCurrentStatus, removeGreenBackground, startPing, stopPing, interviewStateRef, setInterviewState });
    }

    try {
      setIsLoading(true);
      setError(null);

      let signedUrl = '';
      try {
        const signResponse = await fetch('/api/xunfei/avatar-sign');
        if (!signResponse.ok) throw new Error(`HTTP ${signResponse.status}`);
        const signResult = await signResponse.json();
        if (signResult?.success && signResult?.signedUrl) signedUrl = signResult.signedUrl;
      } catch (signError) { console.warn('⚠️ 获取后端签名地址失败:', signError); }

      const apiInfo = { appId: config.appId, apiKey: config.apiKey, apiSecret: config.apiSecret, sceneId: config.sceneId, serverUrl: config.serverUrl, signedUrl };
      if (!apiInfo.appId || !apiInfo.apiKey || !apiInfo.apiSecret || !apiInfo.sceneId) throw new Error('API信息不完整，请检查配置');
      if (!config.avatar_id || !config.vcn) throw new Error('虚拟人配置不完整，请检查avatar_id和vcn');

      const globalParams = {
        stream: { protocol: 'xrtc', alpha: config.alpha || 1, bitrate: config.bitrate || 1000000, fps: config.fps || 25 },
        avatar: { avatar_id: config.avatar_id, width: config.width || 1080, height: config.height || 1920, scale: config.scale || 1, move_h: config.move_h || 0, move_v: config.move_v || 0, audio_format: 1 },
        tts: { vcn: config.vcn, speed: config.speed || 50, pitch: config.pitch || 50, volume: config.volume || 100 }
      };

      if (config.interactive_mode !== undefined || config.content_analysis !== undefined) {
        globalParams.avatar_dispatch = { interactive_mode: config.interactive_mode || 1, content_analysis: config.content_analysis || 0 };
      }
      if (config.subtitle !== undefined) {
        globalParams.subtitle = { subtitle: config.subtitle || 1, font_color: config.font_color || '#FF0000', font_name: config.font_name || 'Sanji.Suxian.Simple', position_x: config.position_x || 100, position_y: config.position_y || 0, font_size: config.font_size || 10, width: config.subtitle_width || 100, height: config.subtitle_height || 100 };
      }
      if (config.air !== undefined || config.add_nonsemantic !== undefined) {
        globalParams.air = { air: config.air || 1, add_nonsemantic: config.add_nonsemantic || 1 };
      }
      if (config.nlp?.enabled) {
        globalParams.nlp = { domain: config.nlp.domain || "xdeepseekr1", promptTemplate: config.nlp.promptTemplate, embeddingTop: config.nlp.embeddingTop || 10, thresholdScore: config.nlp.thresholdScore || 0.45, qaThresholdScore: config.nlp.qaThresholdScore || 0.9, dialogueTop: config.nlp.dialogueTop || 5, dbList: config.nlp.dbList || [], esTop: config.nlp.esTop || 4, topK: config.nlp.topK || 1, temperature: config.nlp.temperature || 0.5, dialoguePromptTemplate: config.nlp.dialoguePromptTemplate, qqEmbThresholdScore: config.nlp.qqEmbThresholdScore || 0.8, model_type: config.nlp.model_type || 'deepseek-r1', parameters: config.nlp.parameters || { temperature: 0.5, max_tokens: 1000 } };
      }

      avatarPlatformRef.current.setApiInfo(apiInfo);
      avatarPlatformRef.current.setGlobalParams(globalParams);
      await new Promise(resolve => setTimeout(resolve, 100));

      const startParams = { wrapper: wrapperRef.current };

      if (config.protocol === 'xrtc' && config.alpha === 1) {
        try {
          if (typeof avatarPlatformRef.current.startAlphaChannel === 'function') {
            await avatarPlatformRef.current.startAlphaChannel();
            console.log('alpha通道启动成功');
          }
        } catch (err) { console.warn('alpha通道启动失败:', err); }
      }

      await avatarPlatformRef.current.start(startParams);
      console.log('虚拟人启动命令已发送');
      setTimeout(() => removeGreenBackground(), 1000);

      setTimeout(() => {
        if (isLoading && !isConnected) {
          console.warn('虚拟人连接超时');
          setError(new Error('连接超时'));
          setIsLoading(false);
          setCurrentStatus('error');
        }
      }, 30000);

    } catch (e) {
      console.error('虚拟人连接失败:', e);
      const normalizedError = new Error(e?.message || '虚拟人连接失败');
      normalizedError.code = e.code;
      setError(normalizedError);
      setIsLoading(false);
      setCurrentStatus('error');

      if ((e.message.includes('WebSocket') || e.message.includes('connection')) && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`WebSocket连接失败，2秒后重试 (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => connectAvatar(), 2000);
      }
    }
  }, [sdkConnection.initializeSDK, performNetworkDiagnosis, removeGreenBackground, startPing, stopPing, interviewStateRef, setInterviewState, isLoading, isConnected]);

  // --- Disconnect avatar ---
  const disconnectAvatar = useCallback(async () => {
    if (avatarPlatformRef.current) {
      try {
        await avatarPlatformRef.current.destroy();
        setIsConnected(false);
        setError(null);
        setIsLoading(false);
        setCurrentStatus('disconnected');
        stopPing();
      } catch (e) { console.error('断开连接失败:', e); }
    }
  }, [stopPing]);

  // --- Check connection status ---
  const checkConnectionStatus = useCallback(() => {
    if (avatarPlatformRef.current) {
      const hasStreamUrl = avatarPlatformRef.current.streamUrl;
      const hasPlayer = avatarPlatformRef.current.player;
      if (hasStreamUrl || hasPlayer) {
        if (!isConnected) { setIsConnected(true); setCurrentStatus('connected'); setError(null); }
        return true;
      }
    }
    return false;
  }, [isConnected]);

  // --- Send text ---
  const sendText = useCallback(async (text) => {
    const isReallyConnected = checkConnectionStatus();
    if (!avatarPlatformRef.current || (!isConnected && !isReallyConnected)) { console.warn('虚拟人未连接，无法发送文本'); return; }
    try {
      await avatarPlatformRef.current.writeText(text, { ctrl: 'text_interact', nlp: true, avatar_dispatch: { interactive_mode: 1, content_analysis: 0 }, air: { air: 1, add_nonsemantic: 1 } });
    } catch (e) {
      console.error('文本发送失败:', e);
      if (e?.code === 10107 || e?.message?.includes('tdp.botId can not be blank')) {
        const normalizedError = new Error('讯飞大模型对话未启用，请前往启用！');
        normalizedError.code = e.code; setError(normalizedError);
      } else { setError(e); }
    }
  }, [isConnected, checkConnectionStatus]);

  // --- Recording ---
  const startRecording = useCallback(async () => {
    if (!avatarPlatformRef.current) return;
    try {
      const recorder = avatarPlatformRef.current.recorder || avatarPlatformRef.current.createRecorder();
      await recorder.startRecord(0, () => { console.log('录音自动停止'); setCurrentStatus('idle'); });
      setCurrentStatus('recording');
    } catch (e) { console.error('录音开始失败:', e); setCurrentStatus('idle'); }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!avatarPlatformRef.current) return;
    try {
      const recorder = avatarPlatformRef.current.recorder;
      if (recorder) { await recorder.stopRecord(); setCurrentStatus('idle'); }
    } catch (e) { console.error('录音停止失败:', e); setCurrentStatus('idle'); }
  }, []);

  // --- Set audio enabled ---
  const setAudioEnabledState = useCallback((enabled) => {
    setAudioEnabled(enabled);
    if (avatarPlatformRef.current?.player && typeof avatarPlatformRef.current.player.setVolume === 'function') {
      avatarPlatformRef.current.player.setVolume(enabled ? 1 : 0);
    }
  }, []);

  // --- Expose methods to parent ---
  useImperativeHandle(ref, () => ({
    sendText, connectAvatar, disconnectAvatar, startRecording, stopRecording, resumePlayback,
    sendPing, checkConnectionStatus, startPing, stopPing, setAudioEnabled: setAudioEnabledState,
    performNetworkDiagnosis: (force) => performNetworkDiagnosis({ isDiagnosing, networkDiagnosis, setIsDiagnosing, setNetworkDiagnosis, setConnectionAdvice, force }),
    getNetworkDiagnosis: () => networkDiagnosis, getConnectionAdvice: () => connectionAdvice,
    isConnected, currentStatus, error, needsUserInteraction,
    startInterview, stopInterview, askQuestion, reAskCurrentQuestion, handleCandidateAnswerComplete, handleNextQuestion,
    setInterviewState, getInterviewState: () => interviewState, getInterviewQuestions: () => interviewQuestions
  }), [sendText, connectAvatar, disconnectAvatar, startRecording, stopRecording, resumePlayback, sendPing, startPing, stopPing, setAudioEnabledState, performNetworkDiagnosis, networkDiagnosis, connectionAdvice, isConnected, currentStatus, error, needsUserInteraction, startInterview, stopInterview, askQuestion, interviewState, interviewQuestions]);

  // --- Auto connect on mount ---
  useEffect(() => {
    if (config.autoConnect && !isConnected && !isLoading) {
      const timer = setTimeout(() => { console.log('🚀 自动连接虚拟人...'); connectAvatar(); }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      console.log('🧹 虚拟人组件卸载，清理资源...');
      stopPing();
      if (avatarPlatformRef.current) avatarPlatformRef.current.destroy();
    };
  }, []);

  // --- Notify status change ---
  useEffect(() => {
    if (onStatusChangeRef.current) onStatusChangeRef.current({ isConnected, currentStatus, error, needsUserInteraction });
  }, [isConnected, currentStatus, error, needsUserInteraction]);

  // --- Handle user interaction ---
  const handleUserInteraction = useCallback(async (e) => {
    if (!userInteracted) {
      setUserInteracted(true);
      setNeedsUserInteraction(false);
      if (avatarPlatformRef.current && isConnected) { try { await resumePlayback(); } catch (error) { console.warn('恢复播放失败:', error); } }
    }
    if (onAvatarClick) onAvatarClick(e);
  }, [userInteracted, isConnected, resumePlayback, onAvatarClick]);

  // --- DOM mutation observer for green background removal ---
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new MutationObserver(() => { removeGreenBackground(true); });
    observer.observe(wrapperRef.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    const interval = setInterval(() => { removeGreenBackground(true); }, 1000);
    return () => { observer.disconnect(); clearInterval(interval); };
  }, [removeGreenBackground]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent', zIndex: 1, ...config.style }} onClick={handleUserInteraction}>
    </div>
  );
});

VirtualHumanSDK.displayName = 'VirtualHumanSDK';
export default VirtualHumanSDK;
