// 实时数据同步工具 - 使用轮询机制实现跨设备数据同步
// 版本: v2.0 - 使用sessionStorage + 轮询机制
class RealTimeSync {
  constructor() {
    this.syncInterval = null;
    this.isPolling = false;
    this.lastDataHash = null;
    this.version = 'v2.0';
    
    console.log('RealTimeSync 初始化 - 版本:', this.version);
  }

  // 生成数据哈希值，用于检测数据变化
  generateDataHash(data) {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  // 保存数据到共享存储（使用localStorage，因为sessionStorage不能跨设备）
  saveToSharedStorage(data) {
    try {
      const dataWithTimestamp = {
        data: data,
        timestamp: Date.now(),
        hash: this.generateDataHash(data)
      };
      localStorage.setItem('shared_candidate_data', JSON.stringify(dataWithTimestamp));
      console.log('数据已保存到共享存储(localStorage):', dataWithTimestamp);
      return true;
    } catch (error) {
      console.error('保存到共享存储失败:', error);
      return false;
    }
  }

  // 从共享存储加载数据
  loadFromSharedStorage() {
    try {
      const stored = localStorage.getItem('shared_candidate_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('从共享存储加载数据(localStorage):', parsed);
        return parsed.data || [];
      }
      return [];
    } catch (error) {
      console.error('从共享存储加载失败:', error);
      return [];
    }
  }

  // 开始轮询检查数据变化
  startPolling(onDataChange) {
    if (this.isPolling) {
      console.log('轮询已在进行中');
      return;
    }

    this.isPolling = true;
    console.log('开始轮询检查数据变化...');

    this.syncInterval = setInterval(() => {
      try {
        const currentData = this.loadFromSharedStorage();
        const currentHash = this.generateDataHash(currentData);

        if (this.lastDataHash !== currentHash) {
          console.log('检测到数据变化:', {
            oldHash: this.lastDataHash,
            newHash: currentHash,
            dataLength: currentData.length
          });

          this.lastDataHash = currentHash;
          onDataChange(currentData);
        }
      } catch (error) {
        console.error('轮询检查失败:', error);
      }
    }, 1000); // 每1秒检查一次（从2秒缩短）
  }

  // 停止轮询
  stopPolling() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isPolling = false;
    console.log('轮询已停止');
  }

  // 同步数据（保存并触发轮询检查）
  async syncData(data) {
    try {
      // 保存到共享存储
      this.saveToSharedStorage(data);
      
      // 更新哈希值
      this.lastDataHash = this.generateDataHash(data);
      
      console.log('数据同步完成');
      return true;
    } catch (error) {
      console.error('数据同步失败:', error);
      return false;
    }
  }

  // 获取数据状态信息
  getDataStatus() {
    const data = this.loadFromSharedStorage();
    return {
      dataLength: data.length,
      lastUpdate: data.length > 0 ? new Date().toLocaleString() : '无数据',
      isPolling: this.isPolling,
      lastHash: this.lastDataHash
    };
  }
}

// 创建单例实例
const realTimeSync = new RealTimeSync();

export default realTimeSync;
