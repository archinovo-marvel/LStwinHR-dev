import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import AvatarPlatform, {
  PlayerEvents,
  SDKEvents,
} from '../sdk/3.2.1.1016/avatar-sdk-web_3.2.1.1016/esm/index.js';
import NetworkDiagnostics from '../utils/networkDiagnostics.js';
import logFilter from '../utils/logFilter.js';

const VirtualHumanSDK = forwardRef(({ 
  config = {},
  onStatusChange,
  onAvatarClick,
  onVirtualHumanReply, // 虚拟人回复回调
  onVirtualHumanStreamingEnd // 虚拟人流式回复结束回调
}, ref) => {
  const avatarPlatformRef = useRef(null);
  const wrapperRef = useRef(null);
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
  const pingIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const onStatusChangeRef = useRef(onStatusChange);
  const onVirtualHumanReplyRef = useRef(onVirtualHumanReply);
  const onVirtualHumanStreamingEndRef = useRef(onVirtualHumanStreamingEnd);
  const nlpFinalizeTimeoutRef = useRef(null);
  const frameStopFinalizeTimeoutRef = useRef(null);
  const latestNlpContentRef = useRef('');
  const networkDiagnosticsRef = useRef(new NetworkDiagnostics());
  const lastDiagnosisTimeRef = useRef(0);

  // 面试相关状态
  const [interviewState, setInterviewState] = useState({
    currentQuestionIndex: 0,
    isWaitingForAnswer: false,
    isAIResponding: false,
    isInterviewComplete: false,
    isAutoQuestionEnabled: false,
    isAIEvaluating: false // 新增：AI是否在给出评价
  });
  const interviewStateRef = useRef(interviewState);

  useEffect(() => {
    interviewStateRef.current = interviewState;
  }, [interviewState]);
  
  // 预设面试问题列表 - 适合应届毕业生
  const interviewQuestions = [
    "请做一个简单的自我介绍。",
    "谈谈您求学经历中令您感到成功的事例及成功的因素。",
    "你如何看待加班？",
    "你未来3-5年的职业规划是什么？",
    "你有什么问题想问我们吗？",
    "请描述一个你过去处理过的棘手项目以及你是如何解决的。"
  ];
  
  // 更新 ref 当 onStatusChange 变化时
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onVirtualHumanReplyRef.current = onVirtualHumanReply;
  }, [onVirtualHumanReply]);

  useEffect(() => {
    onVirtualHumanStreamingEndRef.current = onVirtualHumanStreamingEnd;
  }, [onVirtualHumanStreamingEnd]);

  // 组件挂载时立即启用日志过滤器
  useEffect(() => {
    logFilter.enable();
    console.log('🔇 虚拟人组件已启用日志过滤器');
    
    return () => {
      if (nlpFinalizeTimeoutRef.current) {
        clearTimeout(nlpFinalizeTimeoutRef.current);
        nlpFinalizeTimeoutRef.current = null;
      }
      if (frameStopFinalizeTimeoutRef.current) {
        clearTimeout(frameStopFinalizeTimeoutRef.current);
        frameStopFinalizeTimeoutRef.current = null;
      }
      logFilter.disable();
    };
  }, []);

  // 判定是否为浏览器自动播放限制错误
  const isAutoplayError = useCallback((err) => {
    if (!err) return false;
    const msg = err.message || '';
    return (
      err.name === 'NotAllowedError' ||
      msg.includes('NotAllowedError') ||
      msg.includes("play() failed because the user didn't interact")
    );
  }, []);

  // 为播放器包装自动播放限制保护
  const wrapAutoplaySafe = useCallback((playerInstance) => {
    if (!playerInstance || playerInstance.__autoplayWrapped) return playerInstance;

    const wrapMethod = (methodName) => {
      const original = typeof playerInstance[methodName] === 'function'
        ? playerInstance[methodName].bind(playerInstance)
        : null;
      if (!original) return;

      playerInstance[methodName] = (...args) => {
        try {
          const result = original(...args);
          return Promise.resolve(result).catch((err) => {
            if (isAutoplayError(err)) {
              console.debug('[PLAYER_AUTOPLAY_SWALLOW] 已吞掉浏览器自动播放限制错误:', err?.message || err);
              return; // 吞掉自动播放限制，避免未处理拒绝
            }
            throw err;
          });
        } catch (err) {
          if (isAutoplayError(err)) {
            console.debug('[PLAYER_AUTOPLAY_SWALLOW_SYNC] 已吞掉同步自动播放限制错误:', err?.message || err);
            return;
          }
          throw err;
        }
      };
    };

    wrapMethod('play');
    wrapMethod('resume');
    wrapMethod('start');
    playerInstance.__autoplayWrapped = true;
    return playerInstance;
  }, [isAutoplayError]);

  const ensurePlayerAudible = useCallback((player) => {
    if (!player) return;
    try {
      player.muted = false;
      if (typeof player.volume === 'number') player.volume = 1;
      if (typeof player.setVolume === 'function') player.setVolume(1);
    } catch (e) {
      console.warn('[PLAYER_AUDIO_RECOVER_WARN] 恢复音量失败:', e);
    }
  }, []);

  // 恢复播放函数（提前定义）
  const resumePlayback = useCallback(async () => {
    if (!avatarPlatformRef.current) return;

    try {
      const player = wrapAutoplaySafe(avatarPlatformRef.current.player);
      if (player) {
        if (typeof player.resume === 'function') {
          await player.resume();
        } else if (typeof player.play === 'function') {
          await player.play();
        }
        ensurePlayerAudible(player);
      }
      
      setNeedsUserInteraction(false);
      setUserInteracted(true);
    } catch (e) {
      if (isAutoplayError(e)) {
        console.debug('[RESUME_AUTOPLAY_SWALLOW] 恢复播放时忽略自动播放限制错误');
        return;
      }
      console.error('恢复播放失败:', e);
    }
  }, [wrapAutoplaySafe, isAutoplayError, ensurePlayerAudible]);

  // 记录是否有用户交互（Chrome 自动播放策略需要）
  useEffect(() => {
    const markInteraction = () => {
      window.__userInteracted = true;
    };
    ['click', 'keydown', 'touchstart'].forEach((evt) =>
      document.addEventListener(evt, markInteraction, { once: true })
    );
    return () => {
      ['click', 'keydown', 'touchstart'].forEach((evt) =>
        document.removeEventListener(evt, markInteraction)
      );
    };
  }, []);

  // 在用户首次交互后恢复音量并重试播放，解决 Chrome 自动播放限制
  const setupAutoplayRecovery = useCallback((player) => {
    const resumeAudio = async () => {
      try {
        if (!player) return;
        player.muted = false;
        if (typeof player.volume === 'number') player.volume = 1;
        if (typeof player.resume === 'function') {
          await player.resume();
        } else if (typeof player.play === 'function') {
          await player.play();
        }
        ensurePlayerAudible(player);
        console.log('[AUTOPLAY_RECOVERY] 用户交互后已恢复声音并重试播放');
      } catch (err) {
        console.error('[AUTOPLAY_RECOVERY_ERROR] 恢复播放失败:', err);
      } finally {
        ['click', 'keydown', 'touchstart'].forEach((evt) =>
          document.removeEventListener(evt, resumeAudio)
        );
      }
    };

    ['click', 'keydown', 'touchstart'].forEach((evt) =>
      document.addEventListener(evt, resumeAudio, { once: true })
    );
  }, [ensurePlayerAudible]);

  // 面试相关功能函数
  const askQuestion = useCallback(async (questionIndex, options = {}) => {
    const force = options.force === true;

    if (!avatarPlatformRef.current) {
      console.warn('❌ 虚拟人未连接，无法提问');
      return false;
    }

    if (questionIndex >= interviewQuestions.length) {
      console.log('面试问题已全部问完');
      setInterviewState(prev => ({ 
        ...prev, 
        isWaitingForAnswer: false, 
        isInterviewComplete: true 
      }));
      return false;
    }
    
    const question = interviewQuestions[questionIndex];
    console.log(`🎯 发送面试问题 ${questionIndex + 1}: ${question}`, { force });
    
    setInterviewState(prev => ({ 
      ...prev, 
      currentQuestionIndex: questionIndex,
      isWaitingForAnswer: true,
      isAIEvaluating: false
    }));
    
    try {
      // 构建面试问题文本，明确告诉AI这是要问面试者的问题
      const interviewQuestionText = `作为面试官，我想问您一个问题：${question} 请回答。`;
      
      // 先等待一下，确保上一个消息完全处理完成
      if (!force) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 先在页面上显示问题消息
        if (onVirtualHumanReplyRef.current) {
          onVirtualHumanReplyRef.current(interviewQuestionText);
        }
      
      await avatarPlatformRef.current.writeText(interviewQuestionText, {
        nlp: false, // 关闭语义理解，只进行文本播报
        avatar_dispatch: {
          interactive_mode: 1 // 打断模式
        }
      });
      console.log('✅ 面试问题发送成功');
      
      // 问题发送完成后，重置AI回答状态
      setInterviewState(prev => ({ 
        ...prev, 
        isAIResponding: false,
        isWaitingForAnswer: true
      }));
      return true;
    } catch (error) {
      console.error('❌ 发送面试问题失败:', error);
      setInterviewState(prev => ({ 
        ...prev, 
        isWaitingForAnswer: false 
      }));
      return false;
    }
  }, [interviewQuestions]);

  const handleNextQuestion = useCallback((options = {}) => {
    const force = options.force === true;
    console.log('🎯 handleNextQuestion 被调用');
    const currentState = interviewStateRef.current;

    // 防止重复调用
    if (currentState.isAIResponding && !force) {
      console.log('🎯 AI正在回答中，跳过handleNextQuestion调用');
      return false;
    }
    
    const nextIndex = (currentState.currentQuestionIndex || 0) + 1;
    console.log(`🎯 当前问题索引: ${currentState.currentQuestionIndex}, 下一个索引: ${nextIndex}, 总问题数: ${interviewQuestions.length}`);
    
    if (nextIndex < interviewQuestions.length) {
      console.log(`⏭️ 准备发送下一个问题 (${nextIndex + 1}/${interviewQuestions.length})`);
      
      // 设置AI回答状态，防止重复调用
      setInterviewState(prev => ({ 
        ...prev, 
        isAIEvaluating: false,
        isAIResponding: true
      }));
      
      // 延迟发送下一个问题，给用户时间阅读
      setTimeout(() => {
        console.log(`🎯 开始发送下一个问题: ${interviewQuestions[nextIndex]}`);
        askQuestion(nextIndex, { force: true });
      }, force ? 0 : 1000); // 手动点击时立即推进，自动流程保留缓冲
      return true;
    } else {
      // 面试结束
      console.log('🎉 面试问题已全部完成');
      setInterviewState(prev => ({ 
        ...prev, 
        isWaitingForAnswer: false, 
        isInterviewComplete: true,
        isAIEvaluating: false,
        isAIResponding: false
      }));
      return false;
    }
  }, [askQuestion, interviewQuestions.length]);

  const reAskCurrentQuestion = useCallback(() => {
    const currentIndex = interviewStateRef.current.currentQuestionIndex || 0;
    return askQuestion(currentIndex, { force: true });
  }, [askQuestion]);

  // 开始面试
  const startInterview = useCallback(() => {
    console.log('🚀 开始面试');
    setInterviewState(prev => ({ 
      ...prev, 
      currentQuestionIndex: 0,
      isWaitingForAnswer: false,
      isAIResponding: false,
      isInterviewComplete: false,
      isAutoQuestionEnabled: true
    }));
    askQuestion(0, { force: true });
  }, [askQuestion]);

  // 停止面试
  const stopInterview = useCallback(() => {
    console.log('⏹️ 停止面试');
    setInterviewState(prev => ({ 
      ...prev, 
      isWaitingForAnswer: false,
      isAutoQuestionEnabled: false
    }));
  }, []);

  // 处理面试者回答完成
  const handleCandidateAnswerComplete = useCallback(() => {
    console.log('👤 面试者回答完成，设置AI评价状态');
    if (interviewState.isAutoQuestionEnabled && !interviewState.isInterviewComplete) {
      // 设置AI评价状态，等待AI完成评价
      setInterviewState(prev => ({ 
        ...prev, 
        isAIEvaluating: true,
        isWaitingForAnswer: false 
      }));
      
      // 不在这里设置自动进入下一个问题，而是等待AI真正完成评价
      console.log('⏳ 等待AI完成评价，不自动进入下一个问题');
    }
  }, [interviewState.isAutoQuestionEnabled, interviewState.isInterviewComplete]);

  // 添加全局用户交互监听器
  useEffect(() => {
    const handleGlobalInteraction = async () => {
      if (!userInteracted) {
        console.log('👆 检测到全局用户交互');
        setUserInteracted(true);
        setNeedsUserInteraction(false);
        
        // 尝试恢复播放
        if (avatarPlatformRef.current && isConnected) {
          try {
            console.log('🔄 尝试恢复虚拟人播放...');
            await resumePlayback();
          } catch (error) {
            console.warn('恢复播放失败:', error);
          }
        }
      }
    };

    // 监听多种用户交互事件
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleGlobalInteraction, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleGlobalInteraction);
      });
    };
  }, [userInteracted, isConnected, resumePlayback]);

  // 全局兜底：包装 HTMLMediaElement.play，吞掉自动播放限制错误
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.HTMLMediaElement || window.__globalPlayPatched) return;

    const originalPlay = window.HTMLMediaElement.prototype.play;
    if (typeof originalPlay !== 'function') return;

    window.HTMLMediaElement.prototype.play = function (...args) {
      try {
        const result = originalPlay.apply(this, args);
        if (result && typeof result.catch === 'function') {
          return result.catch((err) => {
            if (isAutoplayError(err)) {
              console.debug('[GLOBAL_MEDIA_PLAY_SWALLOW] 已吞掉全局自动播放限制错误:', err?.message || err);
              return; // 防止未处理拒绝导致红色弹窗
            }
            return Promise.reject(err);
          });
        }
        return result;
      } catch (err) {
        if (isAutoplayError(err)) {
          console.debug('[GLOBAL_MEDIA_PLAY_SWALLOW_SYNC] 已吞掉同步自动播放限制错误');
          return; // 吞掉同步抛出的限制错误
        }
        throw err;
      }
    };

    window.__globalPlayPatched = true;
    return () => {
      try {
        window.HTMLMediaElement.prototype.play = originalPlay;
        window.__globalPlayPatched = false;
      } catch (e) {
        // 忽略还原失败
      }
    };
  }, [isAutoplayError]);

  // 初始化SDK
  const initializeSDK = useCallback(async () => {
    try {
      console.log('[SDK_INIT_START] 开始初始化虚拟人SDK...');
      setIsLoading(true);
      setError(null);

      // 日志过滤器已在组件挂载时启用

      const avatarPlatform = new AvatarPlatform({
        useInlinePlayer: true,
        logLevel: 'error' // 只显示错误日志，减少网络质量等调试信息
      });

      // 包装 createPlayer，确保每次创建的 player 都具备自动播放保护
      if (avatarPlatform.createPlayer && !avatarPlatform.__createPlayerWrapped) {
        const originalCreatePlayer = avatarPlatform.createPlayer.bind(avatarPlatform);
        avatarPlatform.createPlayer = (...args) => {
          const p = originalCreatePlayer(...args);
          return wrapAutoplaySafe(p);
        };
        avatarPlatform.__createPlayerWrapped = true;
      }
      avatarPlatformRef.current = avatarPlatform;
      console.log('[SDK_INIT_INSTANCE] 虚拟人SDK实例创建成功');

      // 设置事件监听
      avatarPlatform
        .on(SDKEvents.connected, (initResp) => {
          console.log('[SDK_CONNECTED] 虚拟人连接成功!', {
            response: initResp,
            hasStreamUrl: !!initResp?.stream_url
          });
          setIsConnected(true);
          setIsLoading(false);
          setError(null);
          setCurrentStatus('connected');
          
          // 连接成功后尝试移除绿色背景
          setTimeout(() => {
            removeGreenBackground();
          }, 500);
          retryCountRef.current = 0; // 重置重试计数
          
          // 保存流地址
          if (initResp && initResp.stream_url) {
            console.log('[STREAM_URL] 获取到流地址:', initResp.stream_url);
            if (avatarPlatformRef.current) {
              avatarPlatformRef.current.streamUrl = initResp.stream_url;
            }
          }
          
          // 启动ping心跳
          startPing();
        })
        .on(SDKEvents.stream_start, () => {
          console.log('[STREAM_START] 虚拟人流开始推送!');
          setCurrentStatus('streaming');
          setIsConnected(true); // 流开始推送说明连接成功
          setIsLoading(false);
          setError(null);
          
          // 流开始后尝试移除绿色背景
          setTimeout(() => {
            removeGreenBackground();
          }, 1000);
          
          // 检查播放器状态
          console.log('[PLAYER_CHECK] 开始检查播放器...');
          const player = wrapAutoplaySafe(avatarPlatform.player || avatarPlatform.createPlayer());
          console.log('[PLAYER_CHECK] player 对象:', {
            exists: !!player,
            hasStart: typeof player?.start === 'function',
            hasPlay: typeof player?.play === 'function',
            hasResume: typeof player?.resume === 'function'
          });
          
          if (player) {
            // 先静音以满足 Chrome 自动播放策略
            try {
              player.muted = true;
              if (typeof player.volume === 'number') player.volume = 0;
              console.log('[PLAYER_AUTOPLAY] 初始化为静音，准备播放');
            } catch (e) {
              console.warn('[PLAYER_AUTOPLAY] 设置静音失败:', e);
            }

            const hasGesture = typeof window !== 'undefined' && window.__userInteracted;

            // 优先使用 start，其次 resume，最后 play
            if (typeof player.start === 'function') {
              console.log('[PLAYER_START] 调用 player.start()...');
              if (!hasGesture) {
                console.warn('[PLAYER_START_DEFER] 无用户交互，延迟 start，等待点击/按键');
                setupAutoplayRecovery(player);
              } else {
                player.start()
                  .then(() => {
                    ensurePlayerAudible(player);
                    console.log('[PLAYER_START_SUCCESS] 播放器启动成功');
                  })
                  .catch((err) => {
                    console.error('[PLAYER_START_ERROR] 播放器启动出错:', {
                      name: err?.name,
                      message: err?.message,
                      code: err?.code,
                      stack: err?.stack,
                      toString: err?.toString?.()
                    });
                    if (err?.message?.includes('play() failed because the user didn\'t interact')) {
                      console.debug('ℹ️ Chrome自动播放限制已捕获（正常现象）');
                      setupAutoplayRecovery(player);
                      return;
                    }
                    console.error('[PLAYER_START_FATAL] 播放器启动失败:', err);
                  });
              }
            } else if (typeof player.resume === 'function') {
              console.warn('[PLAYER_START_NO_METHOD] 无 start 方法，改用 resume()');
              if (!hasGesture) {
                console.warn('[PLAYER_RESUME_DEFER] 无用户交互，延迟 resume，等待点击/按键');
                setupAutoplayRecovery(player);
              } else {
                player.resume()
                  .then(() => ensurePlayerAudible(player))
                  .catch((err) => {
                    console.error('[PLAYER_RESUME_ERROR] resume 出错:', err);
                    if (err?.message?.includes('play() failed because the user didn\'t interact')) {
                      setupAutoplayRecovery(player);
                    }
                  });
              }
            } else if (typeof player.play === 'function') {
              console.warn('[PLAYER_START_NO_METHOD] 无 start/resume 方法，改用 play()');
              if (!hasGesture) {
                console.warn('[PLAYER_PLAY_DEFER] 无用户交互，延迟 play，等待点击/按键');
                setupAutoplayRecovery(player);
              } else {
                player.play()
                  .then(() => ensurePlayerAudible(player))
                  .catch((err) => {
                    console.error('[PLAYER_PLAY_ERROR] play 出错:', err);
                    if (err?.message?.includes('play() failed because the user didn\'t interact')) {
                      setupAutoplayRecovery(player);
                    }
                  });
              }
            } else {
              console.error('[PLAYER_START_NO_METHOD] player 无可用的 start/resume/play 方法');
            }
          } else {
            console.error('[PLAYER_START_NO_PLAYER] 无法获取或创建播放器');
          }
        })
        .on(SDKEvents.disconnected, (err) => {
          console.log('虚拟人连接断开:', err);
          setIsConnected(false);
          setIsLoading(false);
          setCurrentStatus('disconnected');
          stopPing();
          if (err) {
            setError(err);
          }
        })
        .on(SDKEvents.error, (error) => {
          console.error('虚拟人SDK错误:', error);
          console.error('错误详情:', {
            message: error.message,
            code: error.code,
            type: error.type,
            stack: error.stack
          });
          setError(error);
          setCurrentStatus('error');
        })
        // 监听虚拟人回复事件
        .on(SDKEvents.nlp, () => {
          // NLP 内容统一走 emit 包装后的最终结果回调，避免分片重复渲染
        })
        .on(SDKEvents.asr, () => {
          // ASR 是候选人语音识别结果，不直接作为 AI 回复写入聊天区
        })
        .on('recorder_start', () => {
          console.log('🎤 语音识别已启动');
          setCurrentStatus('recording');
        })
        .on('recorder_stop', () => {
          console.log('🎤 语音识别已停止');
          setCurrentStatus('idle');
        })
        .on(SDKEvents.frame_start, (frameData) => {
          console.log('🎬 AI开始回答');
          latestNlpContentRef.current = '';
          setInterviewState(prev => ({ ...prev, isAIResponding: true }));
        })
        .on(SDKEvents.frame_stop, (frameData) => {
          console.log('🎬 AI播报完成');
          console.log('[SDK_FRAME_STOP]', {
            frameData,
            interviewState: interviewStateRef.current
          });

          if (latestNlpContentRef.current && onVirtualHumanReplyRef.current) {
            // 确保内容是字符串
            const content = typeof latestNlpContentRef.current === 'string' ? latestNlpContentRef.current : String(latestNlpContentRef.current);
            console.log('[SDK_FRAME_STOP_FINAL_NLP]', {
              length: content.length,
              preview: content.slice(0, 80),
              tail: content.slice(-80)
            });
            onVirtualHumanReplyRef.current(content);
          }

          setInterviewState(prev => {
            const newState = { ...prev, isAIResponding: false };
            
            // 如果AI刚播报完面试问题，不立即反问，而是等待面试者回答
            if (prev.isWaitingForAnswer && prev.isAutoQuestionEnabled && !prev.isInterviewComplete) {
              console.log('🎤 AI已播报完面试问题，等待面试者回答...');
              // 不在这里自动反问，而是等待面试者通过语音或文本回答
            }
            
            // 如果AI刚完成评价，标记状态但不在这里自动进入下一个问题
            // 真正的下一个问题将在onVirtualHumanStreamingEnd回调中触发
            if (prev.isAIEvaluating && prev.isAutoQuestionEnabled && !prev.isInterviewComplete) {
              console.log('✅ AI评价完成，等待流式回复结束回调触发下一个问题');
            }
            
            // 如果AI刚播报完，且不在等待回答状态，说明AI在给出评价
            // 设置isAIEvaluating为true，等待流式回复结束回调
            if (!prev.isWaitingForAnswer && prev.isAutoQuestionEnabled && !prev.isInterviewComplete && !prev.isAIEvaluating) {
              console.log('🎯 AI开始评价，设置isAIEvaluating为true');
              newState.isAIEvaluating = true;
            }
            
            return newState;
          });
          
          // AI回复完成后，自动重新启动语音识别
          setTimeout(() => {
            if (avatarPlatformRef.current && currentStatus === 'idle') {
              console.log('🔄 AI回复完成，自动重新启动语音识别');
              startRecording();
            }
          }, 1000); // 延迟1秒后重新启动

          if (frameStopFinalizeTimeoutRef.current) {
            clearTimeout(frameStopFinalizeTimeoutRef.current);
          }

          frameStopFinalizeTimeoutRef.current = setTimeout(() => {
            if (onVirtualHumanStreamingEndRef.current) {
              onVirtualHumanStreamingEndRef.current();
            }
            frameStopFinalizeTimeoutRef.current = null;
          }, 150);
        });

      // 添加调试事件监听器来查看nlp事件的具体数据结构
      const originalEmit = avatarPlatform.emit;
      avatarPlatform.emit = function(event, ...args) {
        if (event === 'nlp') {
          // 尝试解析nlp事件内容
          if (args && args.length > 0) {
            args.forEach((arg, index) => {
              if (arg && typeof arg === 'object') {
                // 直接在这里处理NLP回复
                if (index === 0 && arg.content && onVirtualHumanReplyRef.current) {
                  // 确保content是字符串
                  const rawContent = arg.content;
                  let content;
                  if (typeof rawContent === 'string') {
                    content = rawContent;
                  } else if (rawContent && typeof rawContent === 'object') {
                    // 如果是对象，尝试提取text字段或使用JSON.stringify
                    if (rawContent.text && typeof rawContent.text === 'string') {
                      content = rawContent.text;
                    } else if (rawContent.message && typeof rawContent.message === 'string') {
                      content = rawContent.message;
                    } else {
                      // 使用JSON.stringify并移除多余的引号
                      try {
                        content = JSON.stringify(rawContent, null, 2);
                      } catch (e) {
                        content = String(rawContent);
                      }
                    }
                  } else {
                    content = String(rawContent);
                  }
                  console.log('[SDK_NLP_EVENT]', {
                    index,
                    status: arg.status,
                    rawContentType: typeof rawContent,
                    rawContent: rawContent,
                    contentType: typeof content,
                    contentLength: content.length,
                    preview: content.slice(0, 80),
                    tail: content.slice(-80)
                  });

                  if (arg.status === 2 && content.length >= latestNlpContentRef.current.length) {
                    latestNlpContentRef.current = content;
                  }

                  if (arg.status === 2) {
                    onVirtualHumanReplyRef.current(content);
                  }
                }
              }
            });
          }
        }
        return originalEmit.apply(this, [event, ...args]);
      };

      // 播放器事件监听
      const player = avatarPlatform.player || avatarPlatform.createPlayer();
      if (player) {
        player
          .on(PlayerEvents.play, () => {
            // 播放开始
          })
          .on(PlayerEvents.playing, () => {
            // 正在播放
          })
          .on(PlayerEvents.error, (err) => {
            console.error('[PLAYER_ERROR_EVENT] 播放器错误事件触发:', {
              errorName: err?.name,
              errorMessage: err?.message,
              errorCode: err?.code,
              errorType: typeof err,
              errorKeys: Object.keys(err || {}),
              fullError: err,
              stack: err?.stack
            });
            
            // ⭐ Chrome 的自动播放限制特有错误，但 Edge 不会报这个错
            // 这说明实际播放已经成功了，只是 Chrome 在严格执行自动播放政策
            if (err && (err.message?.includes('NotAllowedError') || 
                       err.name === 'NotAllowedError' ||
                       err.message?.includes('play() failed because the user didn\'t interact'))) {
              // 这是 Chrome 的正常行为，不需要显示给用户
              console.debug('ℹ️ [BROWSER_AUTOPLAY_LIMIT] Chrome自动播放限制（仅Chrome报此错）:', err.message);
              return; // ⭐ 不处理，因为实际播放已成功（在Edge/Firefox中无此限制）
            }
            
            // 其他真正的播放器错误才需要处理
            console.error('[PLAYER_ERROR_REAL] 播放器真正的错误:', err);
            setError(err);
          });
      }

      // 状态变化回调
      if (onStatusChange) {
        onStatusChange({
          isConnected,
          currentStatus,
          error,
          needsUserInteraction
        });
      }

    } catch (e) {
      setError(e);
      setIsLoading(false);
      setCurrentStatus('error');
    }
  }, []); // 移除依赖项，因为这些回调函数在组件生命周期内是稳定的

  // 检查网络连接
  const checkNetworkConnection = useCallback(async () => {
    try {
      // 尝试连接到一个可靠的测试端点
      const response = await fetch('https://www.baidu.com', { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch (error) {
      console.warn('网络连接检查失败:', error);
      return false;
    }
  }, []);

  // 检测网络环境
  const detectNetworkEnvironment = useCallback(() => {
    const userAgent = navigator.userAgent;
    const isCorporateNetwork = userAgent.includes('Windows') && 
      (window.location.hostname.includes('corp') || 
       window.location.hostname.includes('company') ||
       window.location.hostname.includes('internal'));
    
    console.log('网络环境检测:', {
      userAgent: userAgent.substring(0, 50) + '...',
      isCorporateNetwork,
      hostname: window.location.hostname,
      protocol: window.location.protocol
    });
    
    return {
      isCorporateNetwork,
      userAgent,
      hostname: window.location.hostname
    };
  }, []);

  // 深度网络诊断（旧版本，保留兼容性）
  const performLegacyNetworkDiagnosis = useCallback(async () => {
    console.log('开始深度网络诊断...');
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      location: {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port
      },
      network: {
        online: navigator.onLine,
        connection: navigator.connection || 'unknown'
      },
      websocket: {
        supported: typeof WebSocket !== 'undefined',
        protocols: []
      }
    };
    
    // 测试基本网络连接
    try {
      const response = await fetch('https://www.baidu.com', { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      diagnosis.network.baidu = 'accessible';
    } catch (error) {
      diagnosis.network.baidu = 'blocked';
    }
    
    // 测试讯飞域名解析
    try {
      const response = await fetch('https://avatar.cn-huadong-1.xf-yun.com', { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      diagnosis.network.xfyun = 'accessible';
    } catch (error) {
      diagnosis.network.xfyun = 'blocked';
    }
    
    console.log('网络诊断结果:', diagnosis);
    return diagnosis;
  }, []);

  // 测试WebSocket连接（支持不同协议）
  const testWebSocketConnection = useCallback(async (serverUrl, protocols = []) => {
    return new Promise((resolve) => {
      console.log('测试WebSocket连接:', serverUrl, '协议:', protocols);
      
      // 检测网络环境
      const networkInfo = detectNetworkEnvironment();
      if (networkInfo.isCorporateNetwork) {
        console.log('检测到企业网络环境，可能存在防火墙限制');
      }
      
      // 执行深度网络诊断（仅在需要时）
      // performLegacyNetworkDiagnosis(); // 已移除重复调用
      
      const ws = new WebSocket(serverUrl, protocols);
      
      const timeout = setTimeout(() => {
        ws.close();
        console.log('WebSocket连接测试超时');
        resolve(false);
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('WebSocket连接测试成功');
        ws.close();
        resolve(true);
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.log('WebSocket连接测试失败:', error);
        resolve(false);
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log('WebSocket连接关闭:', event.code, event.reason);
        
        // 详细解释错误代码
        let closeReason = '';
        switch(event.code) {
          case 1000:
            closeReason = '正常关闭';
            break;
          case 1001:
            closeReason = '端点离开';
            break;
          case 1002:
            closeReason = '协议错误';
            break;
          case 1003:
            closeReason = '不支持的数据类型';
            break;
          case 1006:
            closeReason = '连接异常关闭（通常是网络问题或防火墙阻止）';
            break;
          case 1007:
            closeReason = '数据格式错误';
            break;
          case 1008:
            closeReason = '违反策略';
            break;
          case 1009:
            closeReason = '消息过大';
            break;
          case 1010:
            closeReason = '缺少扩展';
            break;
          case 1011:
            closeReason = '服务器错误';
            break;
          case 1015:
            closeReason = 'TLS握手失败';
            break;
          default:
            closeReason = '未知错误';
        }
        
        console.log('WebSocket关闭原因:', closeReason);
        
        if (event.code === 1006) {
          console.log('建议解决方案:');
          console.log('1. 检查网络连接');
          console.log('2. 检查防火墙设置');
          console.log('3. 尝试使用手机热点');
          console.log('4. 检查公司网络是否阻止WebSocket连接');
        }
      };
    });
  }, []);

  // 执行网络诊断（带防重复调用）
  const performNetworkDiagnosis = useCallback(async (force = false) => {
    const now = Date.now();
    const timeSinceLastDiagnosis = now - lastDiagnosisTimeRef.current;
    
    // 如果不是强制诊断，且距离上次诊断不到30秒，则跳过
    if (!force && timeSinceLastDiagnosis < 30000 && networkDiagnosis) {
      console.log('⏭️ 跳过重复网络诊断，距离上次诊断仅', Math.round(timeSinceLastDiagnosis / 1000), '秒');
      return networkDiagnosis;
    }
    
    if (isDiagnosing) {
      console.log('⏳ 网络诊断正在进行中，跳过重复调用');
      return networkDiagnosis;
    }
    
    try {
      setIsDiagnosing(true);
      lastDiagnosisTimeRef.current = now;
      console.log('🔍 开始网络诊断...');
      
      const diagnosis = await networkDiagnosticsRef.current.performFullDiagnosis();
      setNetworkDiagnosis(diagnosis);
      
      const advice = networkDiagnosticsRef.current.getConnectionAdvice();
      setConnectionAdvice(advice);
      
      console.log('📊 网络诊断完成:', diagnosis);
      console.log('💡 连接建议:', advice);
      
      return diagnosis;
    } catch (error) {
      console.error('网络诊断失败:', error);
      return null;
    } finally {
      setIsDiagnosing(false);
    }
  }, [isDiagnosing, networkDiagnosis]);

  // 连接虚拟人
  const connectAvatar = useCallback(async () => {
    console.log('开始连接虚拟人...');
    
    // 如果已经在连接中或已连接，不重复连接
    if (isLoading || isConnected) {
      console.log('虚拟人已在连接中或已连接，跳过重复连接');
      return;
    }

    // 执行网络诊断（异步，不阻塞连接）
    const diagnosisPromise = performNetworkDiagnosis();
    
    // 检查网络连接
    const isNetworkOk = await checkNetworkConnection();
    if (!isNetworkOk) {
      setError(new Error('网络连接异常，请检查网络设置后重试'));
      setIsLoading(false);
      setCurrentStatus('error');
      return;
    }

    // 跳过WebSocket连接测试，直接尝试连接虚拟人
    // WebSocket测试无法提供认证信息，会导致误判
    console.log('⏭️ 跳过WebSocket连接测试，直接尝试连接虚拟人...');
    
    // 等待网络诊断完成（不阻塞连接）
    const diagnosis = await diagnosisPromise;
    
    // 检查网络诊断结果，但不阻止连接
    if (diagnosis && diagnosis.tests) {
      if (diagnosis.tests.xfyun && diagnosis.tests.xfyun.status === 'blocked') {
        console.warn('⚠️ 检测到讯飞云服务可能被阻止，但继续尝试连接...');
      }
      if (diagnosis.tests.baidu && diagnosis.tests.baidu.status === 'blocked') {
        console.warn('⚠️ 检测到网络连接问题，但继续尝试连接...');
      }
    }
    
    if (!avatarPlatformRef.current) {
      console.log('SDK未初始化，先初始化SDK...');
      await initializeSDK();
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('设置连接状态为加载中...');

      let signedUrl = '';
      try {
        const signResponse = await fetch('/api/xunfei/avatar-sign');
        if (!signResponse.ok) {
          throw new Error(`HTTP ${signResponse.status}`);
        }
        const signResult = await signResponse.json();
        if (signResult?.success && signResult?.signedUrl) {
          signedUrl = signResult.signedUrl;
          console.log('🔐 已获取后端签名的讯飞连接地址');
        }
      } catch (signError) {
        console.warn('⚠️ 获取后端签名地址失败，回退为SDK直连鉴权:', signError);
      }

      // 构建API信息 - 优先使用后端签名URL，避免浏览器侧拼接鉴权参数
      const apiInfo = {
        appId: config.appId,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        sceneId: config.sceneId,
        serverUrl: config.serverUrl,
        signedUrl
      };
      
      console.log('🔧 API信息配置:', {
        appId: apiInfo.appId,
        sceneId: apiInfo.sceneId,
        serverUrl: apiInfo.serverUrl,
        signedUrl: apiInfo.signedUrl ? '已设置' : '未设置',
        apiKey: apiInfo.apiKey ? '已设置' : '未设置',
        apiSecret: apiInfo.apiSecret ? '已设置' : '未设置'
      });
      
      // 验证必要参数
      if (!apiInfo.appId || !apiInfo.apiKey || !apiInfo.apiSecret || !apiInfo.sceneId) {
        throw new Error('API信息不完整，请检查配置');
      }
      
      // 验证虚拟人配置
      console.log('验证虚拟人配置:', {
        avatar_id: config.avatar_id ? '已设置' : '缺失',
        vcn: config.vcn ? '已设置' : '缺失',
        protocol: config.protocol ? '已设置' : '缺失'
      });
      
      if (!config.avatar_id || !config.vcn) {
        throw new Error('虚拟人配置不完整，请检查avatar_id和vcn');
      }
      
      console.log('配置验证通过:', {
        appId: apiInfo.appId,
        sceneId: apiInfo.sceneId,
        avatar_id: config.avatar_id,
        vcn: config.vcn,
        serverUrl: apiInfo.serverUrl,
        signedUrl: apiInfo.signedUrl ? '已设置' : '未设置',
        protocol: config.protocol
      });
      
      // 检查参数格式
      console.log('参数格式检查:', {
        appId_length: apiInfo.appId?.length,
        apiKey_length: apiInfo.apiKey?.length,
        apiSecret_length: apiInfo.apiSecret?.length,
        sceneId_length: apiInfo.sceneId?.length,
        avatar_id_length: config.avatar_id?.length,
        vcn_length: config.vcn?.length,
        has_spaces: {
          appId: apiInfo.appId?.includes(' '),
          apiKey: apiInfo.apiKey?.includes(' '),
          apiSecret: apiInfo.apiSecret?.includes(' '),
          sceneId: apiInfo.sceneId?.includes(' '),
          avatar_id: config.avatar_id?.includes(' '),
          vcn: config.vcn?.includes(' ')
        }
      });

      // 构建全局参数 - 根据官方文档配置
      const globalParams = {
        stream: {
          protocol: 'xrtc', // 必传：实时视频协议，只有xrtc支持透明背景
          alpha: config.alpha || 1, // 非必传：是否开启透明背景，0关闭1开启，需配合protocol=xrtc使用
          bitrate: config.bitrate || 1000000, // 非必传：视频码率，默认1000000
          fps: config.fps || 25 // 非必传：视频刷新率，默认25
        },
        avatar: {
          avatar_id: config.avatar_id, // 必传：授权的形象资源id
          width: config.width || 1080, // 非必传：视频分辨率宽
          height: config.height || 1920, // 非必传：视频分辨率高
          scale: config.scale || 1, // 非必传：形象缩放比例
          move_h: config.move_h || 0, // 非必传：形象左右移动
          move_v: config.move_v || 0, // 非必传：形象上下移动
          audio_format: 1 // 非必传：音频采样率，传1即可
        },
        tts: {
          vcn: config.vcn, // 必传：授权的声音资源id
          speed: config.speed || 50, // 非必传：语速
          pitch: config.pitch || 50, // 非必传：语调
          volume: config.volume || 100 // 非必传：音量
        }
      };
      
      // 添加交互模式配置
      if (config.interactive_mode !== undefined || config.content_analysis !== undefined) {
        globalParams.avatar_dispatch = {
          interactive_mode: config.interactive_mode || 1, // 0追加模式，1打断模式
          content_analysis: config.content_analysis || 0 // 是否开启情感分析
        };
      }

      // 添加字幕配置
      if (config.subtitle !== undefined) {
        globalParams.subtitle = {
          subtitle: config.subtitle || 1, // 开启字幕
          font_color: config.font_color || '#FF0000', // 字体颜色
          font_name: config.font_name || 'Sanji.Suxian.Simple', // 字体名称
          position_x: config.position_x || 100, // 字幕水平位置
          position_y: config.position_y || 0, // 字幕竖向位置
          font_size: config.font_size || 10, // 字体大小
          width: config.subtitle_width || 100, // 字幕宽
          height: config.subtitle_height || 100 // 字幕高
        };
      }

      // 添加动作模式配置
      if (config.air !== undefined || config.add_nonsemantic !== undefined) {
        globalParams.air = {
          air: config.air || 1, // 是否开启自动动作
          add_nonsemantic: config.add_nonsemantic || 1 // 是否开启无指向性动作
        };
      }

      // 如果启用了NLP，添加NLP配置 - 完全匹配讯飞虚拟人控制台配置
      if (config.nlp && config.nlp.enabled) {
        globalParams.nlp = {
          domain: config.nlp.domain || "xdeepseekr1",
          promptTemplate: config.nlp.promptTemplate,
          embeddingTop: config.nlp.embeddingTop || 10,
          thresholdScore: config.nlp.thresholdScore || 0.45,
          qaThresholdScore: config.nlp.qaThresholdScore || 0.9,
          dialogueTop: config.nlp.dialogueTop || 5,
          dbList: config.nlp.dbList || [],
          esTop: config.nlp.esTop || 4,
          topK: config.nlp.topK || 1,
          temperature: config.nlp.temperature || 0.5,
          dialoguePromptTemplate: config.nlp.dialoguePromptTemplate,
          qqEmbThresholdScore: config.nlp.qqEmbThresholdScore || 0.8,
          model_type: config.nlp.model_type || 'deepseek-r1',
          parameters: config.nlp.parameters || {
            temperature: 0.5,
            max_tokens: 1000
          }
        };
      }

      console.log('使用官方文档配置:', globalParams);
      if (globalParams.nlp) {
        console.log('NLP配置详情:', {
          domain: globalParams.nlp.domain,
          promptTemplate: globalParams.nlp.promptTemplate?.substring(0, 100) + '...',
          temperature: globalParams.nlp.temperature,
          model_type: globalParams.nlp.model_type
        });
      }

      console.log('设置API信息和全局参数...');
      console.log('全局参数:', {
        avatar_id: globalParams.avatar.avatar_id,
        vcn: globalParams.tts.vcn,
        protocol: globalParams.stream.protocol,
        alpha: globalParams.stream.alpha,
        bitrate: globalParams.stream.bitrate,
        fps: globalParams.stream.fps,
        nlp_enabled: !!globalParams.nlp,
        nlp_domain: globalParams.nlp?.domain,
        subtitle_enabled: !!globalParams.subtitle,
        air_enabled: !!globalParams.air
      });
      
      // 验证必需参数
      const requiredParams = {
        'avatar.avatar_id': globalParams.avatar?.avatar_id,
        'tts.vcn': globalParams.tts?.vcn,
        'stream.protocol': globalParams.stream?.protocol
      };
      
      const missingParams = Object.entries(requiredParams)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
        
      if (missingParams.length > 0) {
        console.error('缺少必需参数:', missingParams);
        throw new Error(`缺少必需参数: ${missingParams.join(', ')}`);
      }
      
      console.log('所有必需参数验证通过');
      
      // 设置API信息和全局参数
      avatarPlatformRef.current.setApiInfo(apiInfo);
      avatarPlatformRef.current.setGlobalParams(globalParams);
      
      // 添加短暂延迟确保设置生效
      await new Promise(resolve => setTimeout(resolve, 100));

      // 启动参数 - 最基础配置
      const startParams = {
        wrapper: wrapperRef.current
      };
      console.log('启动参数:', startParams);

      // 启动alpha通道（如果需要）
      if (config.protocol === 'xrtc' && config.alpha === 1) {
        try {
          console.log('启动alpha通道...');
          // 检查方法是否存在
          if (typeof avatarPlatformRef.current.startAlphaChannel === 'function') {
            await avatarPlatformRef.current.startAlphaChannel();
            console.log('alpha通道启动成功');
          } else {
            console.log('startAlphaChannel方法不存在，跳过alpha通道启动');
          }
        } catch (err) {
          console.warn('alpha通道启动失败，继续正常启动:', err);
        }
      }
      
      console.log('开始启动虚拟人...');
      
      // 启动虚拟人（不设置超时，让SDK自己处理）
      await avatarPlatformRef.current.start(startParams);
      console.log('虚拟人启动命令已发送');
      
      // 启动后立即尝试移除绿色背景
      setTimeout(() => {
        removeGreenBackground();
      }, 1000);
      
      // 设置连接超时（延长到30秒，给虚拟人更多时间）
      setTimeout(() => {
        if (isLoading && !isConnected) {
          console.warn('虚拟人连接超时，可能网络问题或服务不可用');
          setError(new Error('连接超时'));
          setIsLoading(false);
          setCurrentStatus('error');
        }
      }, 30000); // 30秒超时

    } catch (e) {
      console.error('虚拟人连接失败:', e);
      console.error('错误详情:', {
        message: e.message,
        code: e.code,
        name: e.name,
        stack: e.stack
      });

      const normalizedError = new Error(e?.message || '虚拟人连接失败');
      normalizedError.code = e.code;
      normalizedError.rawCode = e.code;
      normalizedError.originalMessage = e.message;
      setError(normalizedError);
      setIsLoading(false);
      setCurrentStatus('error');
      
      // 如果是WebSocket连接失败，尝试重试
      if ((e.message.includes('WebSocket') || e.message.includes('connection')) && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`WebSocket连接失败，${2}秒后重试 (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => {
          connectAvatar();
        }, 2000);
      }
    }
  }, [initializeSDK]); // 移除config依赖，因为config在组件生命周期内是稳定的

  // 断开连接
  const disconnectAvatar = useCallback(async () => {
    if (avatarPlatformRef.current) {
      try {
        await avatarPlatformRef.current.destroy();
        setIsConnected(false);
        setError(null);
        setIsLoading(false);
        setCurrentStatus('disconnected');
        stopPing();
      } catch (e) {
        console.error('断开连接失败:', e);
      }
    }
  }, []);

  // Ping心跳
  const sendPing = useCallback(() => {
    // 虚拟人SDK的ping功能
    console.log('发送ping心跳');
  }, []);

  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      sendPing();
    }, 5000);
  }, [sendPing]);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // 发送文本
  // 检查连接状态
  const checkConnectionStatus = useCallback(() => {
    if (avatarPlatformRef.current) {
      // 检查是否有流地址
      const hasStreamUrl = avatarPlatformRef.current.streamUrl;
      // 检查是否有播放器
      const hasPlayer = avatarPlatformRef.current.player;
      
      console.log('连接状态检查:', {
        hasStreamUrl: !!hasStreamUrl,
        hasPlayer: !!hasPlayer,
        isConnected
      });
      
      // 如果有流地址或播放器，认为已连接
      if (hasStreamUrl || hasPlayer) {
        if (!isConnected) {
          console.log('检测到虚拟人已连接，更新状态');
          setIsConnected(true);
          setCurrentStatus('connected');
          setError(null);
        }
        return true;
      }
    }
    return false;
  }, [isConnected]);

  const sendText = useCallback(async (text) => {
    // 先检查连接状态
    const isReallyConnected = checkConnectionStatus();
    
    if (!avatarPlatformRef.current || (!isConnected && !isReallyConnected)) {
      console.warn('虚拟人未连接，无法发送文本');
      return;
    }

    try {
      console.log('准备发送文本到虚拟人:', text);
      const requestId = await avatarPlatformRef.current.writeText(text, {
        ctrl: 'text_interact',
        nlp: true,
        avatar_dispatch: {
          interactive_mode: 1,
          content_analysis: 0
        },
        air: {
          air: 1,
          add_nonsemantic: 1
        }
      });
      
      console.log('文本发送成功，请求ID:', requestId);
    } catch (e) {
      console.error('文本发送失败:', e);
      const isTdpNotEnabled = e?.code === 10107 || e?.message?.includes('tdp.botId can not be blank');
      if (isTdpNotEnabled) {
        const normalizedError = new Error('讯飞大模型对话未启用，请前往启用！');
        normalizedError.code = e.code;
        normalizedError.rawCode = e.code;
        normalizedError.originalMessage = e.message;
        setError(normalizedError);
      } else {
        setError(e);
      }
    }
  }, [isConnected]);

  // 移除绿色背景的函数
  const removeGreenBackground = useCallback((silent = false) => {
    if (!wrapperRef.current) return;
    
    try {
      let hasChanges = false;
      
      // 只针对虚拟人容器内的元素
      const virtualHumanElements = wrapperRef.current.querySelectorAll('canvas, video');
      virtualHumanElements.forEach(element => {
        if (element.style) {
          const currentBg = element.style.background || element.style.backgroundColor;
          if (currentBg && currentBg !== 'transparent') {
            element.style.background = 'transparent';
            element.style.backgroundColor = 'transparent';
            hasChanges = true;
          }
        }
      });
      
      // 添加更精确的样式，只针对虚拟人SDK
      const existingStyle = document.getElementById('virtual-human-transparent-style');
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'virtual-human-transparent-style';
        style.textContent = `
          /* 只针对虚拟人SDK的canvas和video元素 */
          .avatar-platform canvas,
          .avatar-platform video,
          .avatar-player canvas,
          .avatar-player video,
          .avatar-canvas canvas,
          .avatar-canvas video {
            background: transparent !important;
            background-color: transparent !important;
          }
        `;
        document.head.appendChild(style);
        hasChanges = true;
      }
      
      // 只在有实际变化或首次执行时输出日志
      if (hasChanges && !silent) {
        console.log('已移除虚拟人绿色背景');
      }
    } catch (error) {
      if (!silent) {
        console.warn('移除绿色背景失败:', error);
      }
    }
  }, []);

  // 使用MutationObserver监听DOM变化，持续移除绿色背景
  useEffect(() => {
    if (!wrapperRef.current) return;

    const observer = new MutationObserver(() => {
      removeGreenBackground(true); // 静默模式
    });

    observer.observe(wrapperRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // 定期检查并移除绿色背景（静默模式）
    const interval = setInterval(() => {
      removeGreenBackground(true); // 静默模式
    }, 1000); // 改为1秒检查一次，更频繁地移除绿色背景

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [removeGreenBackground]);

  // 开始录音 - 使用全双工模式
  const startRecording = useCallback(async () => {
    if (!avatarPlatformRef.current) return;

    try {
      const recorder = avatarPlatformRef.current.recorder || avatarPlatformRef.current.createRecorder();
      // 使用全双工模式 (duration = 0)
      await recorder.startRecord(0, () => {
        console.log('录音自动停止');
        setCurrentStatus('idle');
      });
      
      setCurrentStatus('recording');
      console.log('全双工录音已启动');
    } catch (e) {
      console.error('录音开始失败:', e);
      // 静默处理录音错误，不显示给用户，避免约束设备弹窗
      setCurrentStatus('idle');
      // 不设置错误状态，避免弹窗
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(async () => {
    if (!avatarPlatformRef.current) return;

    try {
      const recorder = avatarPlatformRef.current.recorder;
      if (recorder) {
        await recorder.stopRecord();
        setCurrentStatus('idle');
      }
    } catch (e) {
      console.error('录音停止失败:', e);
      // 静默处理录音错误，不显示给用户
      setCurrentStatus('idle');
      // 不设置错误状态，避免弹窗
    }
  }, []);

  // resumePlayback函数已在前面定义

  // 设置音频开关
  const setAudioEnabledState = useCallback((enabled) => {
    setAudioEnabled(enabled);
    // 如果虚拟人已连接，可以在这里添加实际的音频控制逻辑
    if (avatarPlatformRef.current && avatarPlatformRef.current.player) {
      const player = avatarPlatformRef.current.player;
      if (typeof player.setVolume === 'function') {
        player.setVolume(enabled ? 1 : 0);
      }
    }
  }, []);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    sendText,
    connectAvatar,
    disconnectAvatar,
    startRecording,
    stopRecording,
    resumePlayback,
    sendPing,
    checkConnectionStatus,
    startPing,
    stopPing,
    setAudioEnabled: setAudioEnabledState,
    performNetworkDiagnosis,
    getNetworkDiagnosis: () => networkDiagnosis,
    getConnectionAdvice: () => connectionAdvice,
    isConnected,
    currentStatus,
    error,
    needsUserInteraction,
    // 面试相关方法
    startInterview,
    stopInterview,
    askQuestion,
    reAskCurrentQuestion,
    handleCandidateAnswerComplete,
    handleNextQuestion,
    setInterviewState,
    getInterviewState: () => interviewState,
    getInterviewQuestions: () => interviewQuestions
  }), [sendText, connectAvatar, disconnectAvatar, startRecording, stopRecording, resumePlayback, sendPing, startPing, stopPing, setAudioEnabledState, performNetworkDiagnosis, networkDiagnosis, connectionAdvice, isConnected, currentStatus, error, needsUserInteraction, startInterview, stopInterview, askQuestion, interviewState, interviewQuestions]);

  // 初始化 - 只在组件挂载时执行一次
  useEffect(() => {
    if (config.autoConnect && !isConnected && !isLoading) {
      // 延迟连接，避免重复调用
      const timer = setTimeout(() => {
        console.log('🚀 自动连接虚拟人...');
        connectAvatar();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []); // 移除所有依赖项，只在组件挂载时执行一次

  // 清理函数 - 在组件卸载时执行
  useEffect(() => {
    return () => {
      console.log('🧹 虚拟人组件卸载，清理资源...');
      stopPing();
      if (avatarPlatformRef.current) {
        avatarPlatformRef.current.destroy();
      }
    };
  }, []);

  // 状态变化时通知父组件
  useEffect(() => {
    if (onStatusChangeRef.current) {
      onStatusChangeRef.current({
        isConnected,
        currentStatus,
        error,
        needsUserInteraction
      });
    }
  }, [isConnected, currentStatus, error, needsUserInteraction]);


  // 处理用户交互（点击、触摸等）
  const handleUserInteraction = useCallback(async (e) => {
    console.log('👆 检测到用户交互');
    
    // 标记用户已交互
    if (!userInteracted) {
      setUserInteracted(true);
      setNeedsUserInteraction(false);
      
      // 尝试恢复播放
      if (avatarPlatformRef.current && isConnected) {
        try {
          console.log('🔄 尝试恢复虚拟人播放...');
          await resumePlayback();
        } catch (error) {
          console.warn('恢复播放失败:', error);
        }
      }
    }
    
    // 调用原有的点击处理
    if (onAvatarClick) {
      onAvatarClick(e);
    }
  }, [userInteracted, isConnected, resumePlayback, onAvatarClick]);

  // 处理点击事件
  const handleClick = (e) => {
    handleUserInteraction(e);
  };

  return (
    <div 
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: 'transparent',
        zIndex: 1,
        ...config.style
      }}
      onClick={handleClick}
    >
      {/* 加载状态 - 已移除显示 */}

    </div>
  );
});

VirtualHumanSDK.displayName = 'VirtualHumanSDK';

export default VirtualHumanSDK;
