/**
 * 日志过滤器工具
 * 用于过滤掉不必要的XRTC网络质量日志
 */

class LogFilter {
  constructor() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };
    this.filters = [
      'network-quality',
      'XRTC',
      'uplinkNetworkQuality',
      'downlinkNetworkQuality',
      'case0001894bhu1994b38fa6b0441392',
      'xrtc-player-BJTnVhG9.js',
      'XRTC <Warn>',
      'downlinkNetworkQualityList'
    ];
    this.isEnabled = false;
  }

  /**
   * 启用日志过滤
   */
  enable() {
    if (this.isEnabled) return;
    
    console.log = this.createFilteredFunction(this.originalConsole.log);
    console.warn = this.createFilteredFunction(this.originalConsole.warn);
    console.error = this.createFilteredFunction(this.originalConsole.error);
    console.info = this.createFilteredFunction(this.originalConsole.info);
    
    this.isEnabled = true;
    console.log('🔇 日志过滤器已启用，将过滤XRTC网络质量日志');
  }

  /**
   * 禁用日志过滤
   */
  disable() {
    if (!this.isEnabled) return;
    
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
    
    this.isEnabled = false;
    console.log('🔊 日志过滤器已禁用');
  }

  /**
   * 创建过滤后的控制台函数
   */
  createFilteredFunction(originalFunction) {
    return (...args) => {
      const message = args.join(' ');
      
      // 检查是否包含需要过滤的关键词
      const shouldFilter = this.filters.some(filter => 
        message.includes(filter)
      );
      
      if (shouldFilter) {
        return; // 不输出被过滤的日志
      }
      
      // 输出正常的日志
      originalFunction.apply(console, args);
    };
  }

  /**
   * 添加新的过滤关键词
   */
  addFilter(keyword) {
    if (!this.filters.includes(keyword)) {
      this.filters.push(keyword);
    }
  }

  /**
   * 移除过滤关键词
   */
  removeFilter(keyword) {
    const index = this.filters.indexOf(keyword);
    if (index > -1) {
      this.filters.splice(index, 1);
    }
  }

  /**
   * 获取当前过滤关键词列表
   */
  getFilters() {
    return [...this.filters];
  }

  /**
   * 清空所有过滤关键词
   */
  clearFilters() {
    this.filters = [];
  }
}

// 创建全局实例
const logFilter = new LogFilter();

export default logFilter;
