/**
 * 网络诊断工具
 * 用于检测和解决虚拟人连接问题
 */

export class NetworkDiagnostics {
  constructor() {
    this.diagnosisResults = {};
  }

  /**
   * 执行完整的网络诊断
   */
  async performFullDiagnosis() {
    console.log('🔍 开始完整网络诊断...');
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      location: {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
        origin: window.location.origin
      },
      network: {
        online: navigator.onLine,
        connection: navigator.connection || 'unknown'
      },
      websocket: {
        supported: typeof WebSocket !== 'undefined',
        protocols: []
      },
      tests: {}
    };

    // 测试基本网络连接
    diagnosis.tests.baidu = await this.testBasicConnectivity('https://www.baidu.com');
    diagnosis.tests.xfyun = await this.testBasicConnectivity('https://avatar.cn-huadong-1.xf-yun.com');
    
    // 测试WebSocket连接
    diagnosis.tests.websocket = await this.testWebSocketConnectivity();
    
    // 测试虚拟人服务器连接
    diagnosis.tests.virtualHuman = await this.testVirtualHumanServer();
    
    // 检测网络环境
    diagnosis.networkEnvironment = this.detectNetworkEnvironment();
    
    this.diagnosisResults = diagnosis;
    console.log('📊 网络诊断结果:', diagnosis);
    
    return diagnosis;
  }

  /**
   * 测试基本网络连接
   */
  async testBasicConnectivity(url) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache',
        timeout: 5000
      });
      return { status: 'accessible', response: 'ok' };
    } catch (error) {
      return { status: 'blocked', error: error.message };
    }
  }

  /**
   * 测试WebSocket连接
   */
  async testWebSocketConnectivity() {
    // 只测试主要的服务器地址，避免不必要的测试
    const testUrls = [
      'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact'
    ];

    const results = {};
    
    for (const url of testUrls) {
      results[url] = await this.testSingleWebSocket(url);
    }
    
    return results;
  }

  /**
   * 测试单个WebSocket连接
   */
  testSingleWebSocket(url) {
    return new Promise((resolve) => {
      console.log(`🔌 测试WebSocket连接: ${url}`);
      
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ status: 'timeout', error: '连接超时' });
      }, 3000); // 减少超时时间
      
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log(`✅ WebSocket连接成功: ${url}`);
        ws.close();
        resolve({ status: 'success', connected: true });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.log(`❌ WebSocket连接失败: ${url}`, error);
        
        // 分析错误类型
        let errorType = 'unknown';
        if (error.message && error.message.includes('Authentication failed')) {
          errorType = 'auth_failed';
        } else if (error.message && error.message.includes('ERR_NAME_NOT_RESOLVED')) {
          errorType = 'dns_failed';
        } else if (error.message && error.message.includes('ERR_ABORTED')) {
          errorType = 'blocked';
        }
        
        resolve({ 
          status: 'error', 
          error: error.message || '连接失败',
          errorType: errorType
        });
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        const closeReason = this.getWebSocketCloseReason(event.code);
        console.log(`🔒 WebSocket连接关闭: ${url}`, closeReason);
        resolve({ 
          status: 'closed', 
          code: event.code, 
          reason: event.reason,
          description: closeReason
        });
      };
    });
  }

  /**
   * 测试虚拟人服务器连接
   */
  async testVirtualHumanServer() {
    const serverUrl = 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact';
    
    try {
      // 先测试基本连接
      const basicTest = await this.testBasicConnectivity('https://avatar.cn-huadong-1.xf-yun.com');
      
      // 再测试WebSocket连接
      const wsTest = await this.testSingleWebSocket(serverUrl);
      
      return {
        basic: basicTest,
        websocket: wsTest,
        overall: basicTest.status === 'accessible' && wsTest.status === 'success' ? 'success' : 'failed'
      };
    } catch (error) {
      return {
        error: error.message,
        overall: 'error'
      };
    }
  }

  /**
   * 检测网络环境
   */
  detectNetworkEnvironment() {
    const userAgent = navigator.userAgent;
    const hostname = window.location.hostname;
    
    const isCorporateNetwork = userAgent.includes('Windows') && 
      (hostname.includes('corp') || 
       hostname.includes('company') ||
       hostname.includes('internal') ||
       hostname.includes('ngrok'));
    
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isNgrok = hostname.includes('ngrok');
    
    return {
      isCorporateNetwork,
      isLocalhost,
      isNgrok,
      hostname,
      userAgent: userAgent.substring(0, 100) + '...'
    };
  }

  /**
   * 获取WebSocket关闭原因
   */
  getWebSocketCloseReason(code) {
    const reasons = {
      1000: '正常关闭',
      1001: '端点离开',
      1002: '协议错误',
      1003: '不支持的数据类型',
      1006: '连接异常关闭（通常是网络问题或防火墙阻止）',
      1007: '数据格式错误',
      1008: '违反策略',
      1009: '消息过大',
      1010: '缺少扩展',
      1011: '服务器错误',
      1015: 'TLS握手失败'
    };
    
    return reasons[code] || '未知错误';
  }

  /**
   * 生成诊断报告
   */
  generateDiagnosisReport() {
    if (!this.diagnosisResults.tests) {
      return '请先执行网络诊断';
    }

    const results = this.diagnosisResults;
    let report = '🔍 网络诊断报告\n\n';
    
    // 基本信息
    report += `📅 诊断时间: ${results.timestamp}\n`;
    report += `🌐 当前域名: ${results.location.hostname}\n`;
    report += `🔗 协议: ${results.location.protocol}\n`;
    report += `📶 网络状态: ${results.network.online ? '在线' : '离线'}\n\n`;
    
    // 网络环境
    report += `🏢 网络环境:\n`;
    report += `- 企业网络: ${results.networkEnvironment.isCorporateNetwork ? '是' : '否'}\n`;
    report += `- 本地环境: ${results.networkEnvironment.isLocalhost ? '是' : '否'}\n`;
    report += `- Ngrok隧道: ${results.networkEnvironment.isNgrok ? '是' : '否'}\n\n`;
    
    // 连接测试结果
    report += `🔌 连接测试结果:\n`;
    report += `- 百度访问: ${results.tests.baidu.status}\n`;
    report += `- 讯飞云服务: ${results.tests.xfyun.status}\n`;
    
    // WebSocket测试结果
    if (results.tests.websocket) {
      report += `\n🌐 WebSocket连接测试:\n`;
      Object.entries(results.tests.websocket).forEach(([url, result]) => {
        const shortUrl = url.replace('wss://', '').replace('/v1/interact', '');
        report += `- ${shortUrl}: ${result.status}\n`;
        if (result.error) {
          report += `  错误: ${result.error}\n`;
        }
      });
    }
    
    // 虚拟人服务器测试
    if (results.tests.virtualHuman) {
      report += `\n🤖 虚拟人服务器测试:\n`;
      report += `- 整体状态: ${results.tests.virtualHuman.overall}\n`;
      if (results.tests.virtualHuman.websocket) {
        report += `- WebSocket: ${results.tests.virtualHuman.websocket.status}\n`;
      }
    }
    
    // 建议
    report += `\n💡 建议:\n`;
    if (results.networkEnvironment.isNgrok) {
      report += `- 检测到ngrok隧道，请确认隧道是否正常运行\n`;
    }
    if (results.networkEnvironment.isCorporateNetwork) {
      report += `- 检测到企业网络，可能存在防火墙限制\n`;
    }
    if (results.tests.xfyun.status === 'blocked') {
      report += `- 讯飞云服务被阻止，请联系网络管理员\n`;
    }
    
    return report;
  }

  /**
   * 获取连接建议
   */
  getConnectionAdvice() {
    const results = this.diagnosisResults;
    const advice = [];
    
    if (results.networkEnvironment.isNgrok) {
      advice.push({
        type: 'warning',
        message: '检测到ngrok隧道',
        suggestion: '请确认ngrok隧道是否正常运行，可能需要重新启动ngrok'
      });
    }
    
    if (results.networkEnvironment.isCorporateNetwork) {
      advice.push({
        type: 'warning',
        message: '检测到企业网络环境',
        suggestion: '可能存在防火墙限制，建议尝试使用手机热点或联系网络管理员'
      });
    }
    
    if (results.tests.xfyun && results.tests.xfyun.status === 'blocked') {
      advice.push({
        type: 'error',
        message: '讯飞云服务被阻止',
        suggestion: '请联系网络管理员开放 avatar.cn-huadong-1.xf-yun.com 域名'
      });
    }
    
    if (results.tests.websocket) {
      const failedConnections = Object.entries(results.tests.websocket)
        .filter(([_, result]) => result.status !== 'success');
      
      if (failedConnections.length > 0) {
        // 分析具体的WebSocket错误类型
        const hasAuthError = failedConnections.some(([_, result]) => 
          result.errorType === 'auth_failed'
        );
        const hasDnsError = failedConnections.some(([_, result]) => 
          result.errorType === 'dns_failed'
        );
        const hasBlockedError = failedConnections.some(([_, result]) => 
          result.errorType === 'blocked'
        );
        
        if (hasAuthError) {
          advice.push({
            type: 'error',
            message: 'WebSocket认证失败',
            suggestion: '这是正常现象，WebSocket测试无法提供认证信息。虚拟人连接时会自动处理认证。'
          });
        } else if (hasDnsError) {
          advice.push({
            type: 'error',
            message: '域名解析失败',
            suggestion: '检查DNS设置或尝试使用不同的网络环境'
          });
        } else if (hasBlockedError) {
          advice.push({
            type: 'error',
            message: 'WebSocket连接被阻止',
            suggestion: '检查防火墙设置，尝试使用手机热点或联系网络管理员'
          });
        } else {
          advice.push({
            type: 'error',
            message: 'WebSocket连接失败',
            suggestion: '检查网络连接和防火墙设置，尝试使用不同的网络环境'
          });
        }
      }
    }
    
    return advice;
  }
}

export default NetworkDiagnostics;
