import { useRef, useCallback, useEffect } from 'react';
import AvatarPlatform, { PlayerEvents, SDKEvents } from '../../sdk/3.2.1.1016/avatar-sdk-web_3.2.1.1016/esm/index.js';

/**
 * SDK Connection Hook
 * Handles SDK initialization, connection, autoplay restrictions, and player management
 */

//判定是否为浏览器自动播放限制错误
export const isAutoplayError = (err) => {
  if (!err) return false;
  const msg = err.message || '';
  return (
    err.name === 'NotAllowedError' ||
    msg.includes('NotAllowedError') ||
    msg.includes("play() failed because the user didn't interact")
  );
};

// 为播放器包装自动播放限制保护
export const wrapAutoplaySafe = (playerInstance) => {
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
};

export const ensurePlayerAudible = (player) => {
  if (!player) return;
  try {
    player.muted = false;
    if (typeof player.volume === 'number') player.volume = 1;
    if (typeof player.setVolume === 'function') player.setVolume(1);
  } catch (e) {
    console.warn('[PLAYER_AUDIO_RECOVER_WARN] 恢复音量失败:', e);
  }
};

// 恢复播放函数
export const resumePlayback = (avatarPlatformRef, wrapAutoplaySafeFn, ensurePlayerAudibleFn, isAutoplayErrorFn) => async () => {
  if (!avatarPlatformRef.current) return;

  try {
    const player = wrapAutoplaySafeFn(avatarPlatformRef.current.player);
    if (player) {
      if (typeof player.resume === 'function') {
        await player.resume();
      } else if (typeof player.play === 'function') {
        await player.play();
      }
      ensurePlayerAudibleFn(player);
    }
  } catch (e) {
    if (isAutoplayErrorFn(e)) {
      console.debug('[RESUME_AUTOPLAY_SWALLOW] 恢复播放时忽略自动播放限制错误');
      return;
    }
    console.error('恢复播放失败:', e);
  }
};

// 在用户首次交互后恢复音量并重试播放，解决 Chrome 自动播放限制
export const setupAutoplayRecovery = (player, ensurePlayerAudibleFn) => {
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
      ensurePlayerAudibleFn(player);
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
};

const extractAsrTranscript = (payload) => {
  if (!payload) return '';
  const candidates = [
    payload.text,
    payload.content,
    payload.displayContent,
    payload.final_text,
    payload.transcript,
    payload.answer?.text,
    payload.result?.text,
    payload.result?.content,
    payload.asr_text,
  ];

  const transcript = candidates.find((value) => typeof value === 'string' && value.trim());
  return transcript ? transcript.trim() : '';
};

/**
 * Hook for SDK connection management
 */
export const useSDKConnection = ({
  config,
  avatarPlatformRef,
  wrapAutoplaySafe,
  isAutoplayError,
  ensurePlayerAudible,
  setupAutoplayRecovery,
  onStatusChange,
  onVirtualHumanReply,
  onVirtualHumanStreamingEnd,
  onAsrMessage,
}) => {
  const onStatusChangeRef = useRef(onStatusChange);
  const onVirtualHumanReplyRef = useRef(onVirtualHumanReply);
  const onVirtualHumanStreamingEndRef = useRef(onVirtualHumanStreamingEnd);
  const onAsrMessageRef = useRef(onAsrMessage);
  const nlpFinalizeTimeoutRef = useRef(null);
  const frameStopFinalizeTimeoutRef = useRef(null);
  const latestNlpContentRef = useRef('');

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

  useEffect(() => {
    onAsrMessageRef.current = onAsrMessage;
  }, [onAsrMessage]);

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
  const initializeSDK = useCallback(async ({
    setIsConnected,
    setIsLoading,
    setError,
    setCurrentStatus,
    removeGreenBackground,
    startPing,
    stopPing,
  }) => {
    try {
      console.log('[SDK_INIT_START] 开始初始化虚拟人SDK...');
      setIsLoading(true);
      setError(null);

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
                setupAutoplayRecovery(player, ensurePlayerAudible);
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
                      setupAutoplayRecovery(player, ensurePlayerAudible);
                      return;
                    }
                    console.error('[PLAYER_START_FATAL] 播放器启动失败:', err);
                  });
              }
            } else if (typeof player.resume === 'function') {
              console.warn('[PLAYER_START_NO_METHOD] 无 start 方法，改用 resume()');
              if (!hasGesture) {
                console.warn('[PLAYER_RESUME_DEFER] 无用户交互，延迟 resume，等待点击/按键');
                setupAutoplayRecovery(player, ensurePlayerAudible);
              } else {
                player.resume()
                  .then(() => ensurePlayerAudible(player))
                  .catch((err) => {
                    console.error('[PLAYER_RESUME_ERROR] resume 出错:', err);
                    if (err?.message?.includes('play() failed because the user didn\'t interact')) {
                      setupAutoplayRecovery(player, ensurePlayerAudible);
                    }
                  });
              }
            } else if (typeof player.play === 'function') {
              console.warn('[PLAYER_START_NO_METHOD] 无 start/resume 方法，改用 play()');
              if (!hasGesture) {
                console.warn('[PLAYER_PLAY_DEFER] 无用户交互，延迟 play，等待点击/按键');
                setupAutoplayRecovery(player, ensurePlayerAudible);
              } else {
                player.play()
                  .then(() => ensurePlayerAudible(player))
                  .catch((err) => {
                    console.error('[PLAYER_PLAY_ERROR] play 出错:', err);
                    if (err?.message?.includes('play() failed because the user didn\'t interact')) {
                      setupAutoplayRecovery(player, ensurePlayerAudible);
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
        .on(SDKEvents.nlp, () => {
          // NLP 内容统一走 emit 包装后的最终结果回调，避免分片重复渲染
        })
        .on(SDKEvents.asr, (payload) => {
          const transcript = extractAsrTranscript(payload);
          if (transcript && onAsrMessageRef.current) {
            onAsrMessageRef.current(transcript, payload);
          }
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
        })
        .on(SDKEvents.frame_stop, (frameData) => {
          console.log('🎬 AI播报完成');
          console.log('[SDK_FRAME_STOP]', {
            frameData
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

            // Chrome 的自动播放限制特有错误
            if (err && (err.message?.includes('NotAllowedError') ||
                       err.name === 'NotAllowedError' ||
                       err.message?.includes('play() failed because the user didn\'t interact'))) {
              console.debug('ℹ️ [BROWSER_AUTOPLAY_LIMIT] Chrome自动播放限制（仅Chrome报此错）:', err.message);
              return;
            }

            // 其他真正的播放器错误才需要处理
            console.error('[PLAYER_ERROR_REAL] 播放器真正的错误:', err);
            setError(err);
          });
      }

    } catch (e) {
      setError(e);
      setIsLoading(false);
      setCurrentStatus('error');
    }
  }, []);

  return {
    initializeSDK,
    nlpFinalizeTimeoutRef,
    frameStopFinalizeTimeoutRef,
    latestNlpContentRef,
  };
};

export default useSDKConnection;
