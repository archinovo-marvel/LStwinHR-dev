/**
 * 播放器管理器
 * 支持多种协议：xrtc, webrtc, rtmp, flv
 */
export class PlayerManager {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    this.player = null;
    this.isPlaying = false;
    this.eventListeners = new Map();
    this._audioResumeListener = null;
  }

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...any} args - 事件参数
   */
  emit(event, ...args) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`播放器事件监听器错误 [${event}]:`, error);
        }
      });
    }
  }

  /**
   * 初始化播放器
   * @param {string} protocol - 协议类型 (xrtc, webrtc, rtmp, flv)
   * @param {Object} streamInfo - 流信息
   */
  async initPlayer(protocol, streamInfo) {
    try {
      console.log('初始化播放器:', protocol, streamInfo);

      switch (protocol) {
        case 'xrtc':
          await this.initXRTCPlayer(streamInfo);
          break;
        case 'webrtc':
          await this.initWebRTCPlayer(streamInfo);
          break;
        case 'rtmp':
          await this.initRTMPPlayer(streamInfo);
          break;
        case 'flv':
          await this.initFLVPlayer(streamInfo);
          break;
        default:
          throw new Error(`不支持的协议: ${protocol}`);
      }

      this.emit('player_ready');
    } catch (error) {
      console.error('播放器初始化失败:', error);
      this.emit('error', error);
    }
  }

  /**
   * 初始化XRTC播放器
   * @param {Object} streamInfo - 流信息
   */
  async initXRTCPlayer(streamInfo) {
    // XRTC是讯飞自研协议，需要使用专门的播放器
    // 这里创建一个video元素作为占位符
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.controls = false;
    video.autoplay = true;
    video.muted = false;

    // 设置流信息
    if (streamInfo.stream_url) {
      video.src = streamInfo.stream_url;
    }

    // 清空容器并添加视频元素
    this.container.innerHTML = '';
    this.container.appendChild(video);

    this.player = video;
    this.setupVideoEvents(video);

    console.log('XRTC播放器初始化完成');
  }

  /**
   * 初始化WebRTC播放器
   * @param {Object} streamInfo - 流信息
   */
  async initWebRTCPlayer(streamInfo) {
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.controls = false;
    video.autoplay = true;
    video.muted = false;

    // 清空容器并添加视频元素
    this.container.innerHTML = '';
    this.container.appendChild(video);

    this.player = video;
    this.setupVideoEvents(video);

    // 如果提供了流URL，直接设置
    if (streamInfo.stream_url) {
      video.src = streamInfo.stream_url;
    }

    console.log('WebRTC播放器初始化完成');
  }

  /**
   * 初始化RTMP播放器
   * @param {Object} streamInfo - 流信息
   */
  async initRTMPPlayer(streamInfo) {
    // RTMP需要特殊的播放器，这里使用video元素作为占位符
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.controls = false;
    video.autoplay = true;
    video.muted = false;

    // 清空容器并添加视频元素
    this.container.innerHTML = '';
    this.container.appendChild(video);

    this.player = video;
    this.setupVideoEvents(video);

    console.log('RTMP播放器初始化完成');
  }

  /**
   * 初始化FLV播放器
   * @param {Object} streamInfo - 流信息
   */
  async initFLVPlayer(streamInfo) {
    // FLV需要特殊的播放器，这里使用video元素作为占位符
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.controls = false;
    video.autoplay = true;
    video.muted = false;

    // 清空容器并添加视频元素
    this.container.innerHTML = '';
    this.container.appendChild(video);

    this.player = video;
    this.setupVideoEvents(video);

    console.log('FLV播放器初始化完成');
  }

  /**
   * 设置视频事件监听器
   * @param {HTMLVideoElement} video - 视频元素
   */
  setupVideoEvents(video) {
    this._videoElement = video;
    this._videoListeners = {
      loadstart: () => { console.log('视频开始加载'); this.emit('loadstart'); },
      loadeddata: () => { console.log('视频数据加载完成'); this.emit('loadeddata'); },
      canplay: () => { console.log('视频可以播放'); this.emit('canplay'); },
      play: () => { console.log('视频开始播放'); this.isPlaying = true; this.emit('play'); },
      playing: () => { console.log('视频正在播放'); this.emit('playing'); },
      pause: () => { console.log('视频暂停'); this.isPlaying = false; this.emit('pause'); },
      ended: () => { console.log('视频播放结束'); this.isPlaying = false; this.emit('ended'); },
      error: (error) => { console.error('视频播放错误:', error); this.emit('error', error); },
      waiting: () => { console.log('视频缓冲中'); this.emit('waiting'); },
      stalled: () => { console.log('视频停滞'); this.emit('stalled'); }
    };
    for (const [event, handler] of Object.entries(this._videoListeners)) {
      video.addEventListener(event, handler);
    }
  }

  teardownVideoEvents() {
    if (this._videoElement && this._videoListeners) {
      for (const [event, handler] of Object.entries(this._videoListeners)) {
        this._videoElement.removeEventListener(event, handler);
      }
      this._videoListeners = null;
      this._videoElement = null;
    }
  }

  /**
   * 播放视频
   * 处理浏览器自动播放限制：NotAllowedError
   */
  async play() {
    if (this.player) {
      try {
        await this.player.play();
        this.isPlaying = true;
        this.emit('play');
      } catch (error) {
        // 处理自动播放限制错误（页面刷新时发生）
        if (error.name === 'NotAllowedError') {
          console.warn('浏览器阻止了自动播放，尝试静音播放...');
          try {
            // 静音后再播放
            this.player.muted = true;
            await this.player.play();
            this.isPlaying = true;
            this.emit('autoplay_muted', { message: '已静音播放' });
            console.log('静音播放成功，等待用户交互后恢复声音');
            // 监听用户交互，恢复声音
            this.setupUserInteractionListener();
          } catch (muteError) {
            console.error('即使静音也无法播放:', muteError);
            this.emit('error', muteError);
          }
        } else {
          console.error('播放失败:', error);
          this.emit('error', error);
        }
      }
    }
  }

  /**
   * 设置用户交互监听器，用于恢复静音的音频
   */
  setupUserInteractionListener() {
    if (this._audioResumeListener) {
      // 避免重复添加监听器
      return;
    }

    const resumeAudio = () => {
      try {
        if (this.player && this.isPlaying && this.player.muted) {
          console.log('检测到用户交互，恢复声音...');
          this.player.muted = false;
          this.emit('audio_resumed');
        }
      } catch (error) {
        console.error('恢复声音失败:', error);
      }
    };

    this._audioResumeListener = resumeAudio;
    document.addEventListener('click', resumeAudio, { once: true });
    document.addEventListener('keydown', resumeAudio, { once: true });
    document.addEventListener('touchstart', resumeAudio, { once: true });
  }

  /**
   * 暂停视频
   */
  pause() {
    if (this.player) {
      this.player.pause();
      this.isPlaying = false;
      this.emit('pause');
    }
  }

  /**
   * 停止视频
   */
  stop() {
    if (this.player) {
      this.player.pause();
      this.player.currentTime = 0;
      this.isPlaying = false;
      this.emit('stop');
    }
  }

  /**
   * 设置音量
   * @param {number} volume - 音量 (0-1)
   */
  setVolume(volume) {
    if (this.player) {
      this.player.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 获取音量
   * @returns {number} 当前音量
   */
  getVolume() {
    return this.player ? this.player.volume : 0;
  }

  /**
   * 设置静音
   * @param {boolean} muted - 是否静音
   */
  setMuted(muted) {
    if (this.player) {
      this.player.muted = muted;
    }
  }

  /**
   * 获取静音状态
   * @returns {boolean} 是否静音
   */
  getMuted() {
    return this.player ? this.player.muted : true;
  }

  /**
   * 销毁播放器
   */
  destroy() {
    this.teardownVideoEvents();
    if (this._audioResumeListener) {
      document.removeEventListener('click', this._audioResumeListener);
      document.removeEventListener('keydown', this._audioResumeListener);
      document.removeEventListener('touchstart', this._audioResumeListener);
      this._audioResumeListener = null;
    }
    if (this.player) {
      this.stop();
      if (this.player.parentNode) {
        this.player.parentNode.removeChild(this.player);
      }
      this.player = null;
    }
    this.isPlaying = false;
    this.eventListeners.clear();
  }
}

export default PlayerManager;

