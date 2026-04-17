import { generateAuth } from './auth.js';

/**
 * WebSocket连接管理器
 */
export class WebSocketManager {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.eventListeners = new Map();
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
          console.error(`事件监听器错误 [${event}]:`, error);
        }
      });
    }
  }

  /**
   * 连接WebSocket
   */
  async connect() {
    try {
      // 生成鉴权信息
      const authInfo = await generateAuth(
        this.config.apiKey,
        this.config.apiSecret,
        this.config.appId
      );

      // 构建WebSocket URL
      const wsUrl = this.buildWebSocketUrl(authInfo);
      
      console.log('正在连接WebSocket:', wsUrl);

      // 创建WebSocket连接
      this.ws = new WebSocket(wsUrl);

      // 设置事件监听器
      this.setupEventListeners();

    } catch (error) {
      console.error('WebSocket连接失败:', error);
      this.emit('error', error);
    }
  }

  /**
   * 构建WebSocket URL
   * @param {Object} authInfo - 鉴权信息
   * @returns {string} WebSocket URL
   */
  buildWebSocketUrl(authInfo) {
    const { timestamp, authorization } = authInfo;
    const date = new Date(timestamp * 1000).toUTCString();
    
    const params = new URLSearchParams({
      authorization: btoa(authorization),
      date: date,
      host: 'avatar.cn-huadong-1.xf-yun.com'
    });
    
    return `wss://avatar.cn-huadong-1.xf-yun.com/v1/interact?${params.toString()}`;
  }

  /**
   * 设置WebSocket事件监听器
   */
  setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('WebSocket连接已建立');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', event);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('收到WebSocket消息:', data);
        this.handleMessage(data);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
        this.emit('error', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket连接已关闭:', event.code, event.reason);
      this.isConnected = false;
      this.emit('disconnected', event);
      
      // 自动重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.connect();
        }, this.reconnectInterval);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      this.emit('error', error);
    };
  }

  /**
   * 处理收到的消息
   * @param {Object} data - 消息数据
   */
  handleMessage(data) {
    const { code, message, data: payload } = data;

    if (code === 0) {
      // 成功消息
      if (payload) {
        this.emit('message', payload);
        
        // 根据消息类型分发事件
        if (payload.type === 'stream_info') {
          this.emit('stream_info', payload);
        } else if (payload.type === 'asr') {
          this.emit('asr', payload);
        } else if (payload.type === 'nlp') {
          this.emit('nlp', payload);
        } else if (payload.type === 'tts') {
          this.emit('tts', payload);
        }
      }
    } else {
      // 错误消息
      console.error('服务器错误:', code, message);
      this.emit('error', { code, message });
    }
  }

  /**
   * 发送消息
   * @param {Object} message - 要发送的消息
   */
  send(message) {
    if (this.ws && this.isConnected) {
      const messageStr = JSON.stringify(message);
      console.log('发送WebSocket消息:', messageStr);
      this.ws.send(messageStr);
    } else {
      console.warn('WebSocket未连接，无法发送消息');
      this.emit('error', new Error('WebSocket未连接'));
    }
  }

  /**
   * 发送文本驱动
   * @param {string} text - 文本内容
   * @param {Object} options - 选项
   */
  sendText(text, options = {}) {
    const message = {
      common: {
        app_id: this.config.appId
      },
      business: {
        aue: 'raw',
        vcn: this.config.vcn,
        speed: this.config.speed || 50,
        pitch: this.config.pitch || 50,
        volume: this.config.volume || 100,
        ...options
      },
      data: {
        status: 2, // 2表示数据结束
        text: btoa(unescape(encodeURIComponent(text)))
      }
    };

    this.send(message);
  }

  /**
   * 发送音频驱动
   * @param {ArrayBuffer} audioData - 音频数据
   * @param {number} status - 状态 (0: 开始, 1: 中间, 2: 结束)
   */
  sendAudio(audioData, status = 1) {
    const message = {
      common: {
        app_id: this.config.appId
      },
      business: {
        aue: 'raw',
        vcn: this.config.vcn,
        ...this.config.nlp
      },
      data: {
        status: status,
        audio: btoa(String.fromCharCode(...new Uint8Array(audioData)))
      }
    };

    this.send(message);
  }

  /**
   * 发送动作驱动
   * @param {string} actionId - 动作ID
   */
  sendAction(actionId) {
    const message = {
      common: {
        app_id: this.config.appId
      },
      business: {
        action: actionId
      },
      data: {
        status: 2
      }
    };

    this.send(message);
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * 销毁连接管理器
   */
  destroy() {
    this.disconnect();
    this.eventListeners.clear();
  }
}

export default WebSocketManager;

