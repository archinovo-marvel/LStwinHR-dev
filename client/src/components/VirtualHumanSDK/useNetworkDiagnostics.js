import { useRef, useCallback } from 'react';
import NetworkDiagnostics from '../../utils/networkDiagnostics.js';

/**
 * Network Diagnostics Hook
 * Handles network connection checks and diagnostics
 */

// 检查网络连接
export const checkNetworkConnection = async () => {
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
};

// 检测网络环境
export const detectNetworkEnvironment = () => {
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
};

// 深度网络诊断（旧版本，保留兼容性）
export const performLegacyNetworkDiagnosis = async () => {
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
};

// 测试WebSocket连接（支持不同协议）
export const testWebSocketConnection = async (serverUrl, protocols = []) => {
  return new Promise((resolve) => {
    console.log('测试WebSocket连接:', serverUrl, '协议:', protocols);

    // 检测网络环境
    const networkInfo = detectNetworkEnvironment();
    if (networkInfo.isCorporateNetwork) {
      console.log('检测到企业网络环境，可能存在防火墙限制');
    }

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
      switch (event.code) {
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
};

/**
 * Hook for network diagnostics
 */
export const useNetworkDiagnostics = () => {
  const networkDiagnosticsRef = useRef(new NetworkDiagnostics());
  const lastDiagnosisTimeRef = useRef(0);

  // 执行网络诊断（带防重复调用）
  const performNetworkDiagnosis = useCallback(async (options = {}) => {
    const { isDiagnosing, networkDiagnosis, setIsDiagnosing, setNetworkDiagnosis, setConnectionAdvice, force = false } = options;
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
  }, []);

  return {
    networkDiagnosticsRef,
    checkNetworkConnection,
    detectNetworkEnvironment,
    performLegacyNetworkDiagnosis,
    testWebSocketConnection,
    performNetworkDiagnosis,
  };
};

export default useNetworkDiagnostics;
