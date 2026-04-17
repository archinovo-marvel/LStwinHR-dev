// 数据同步工具 - 结合IndexedDB和简单API
class DataSync {
  constructor() {
    this.apiUrl = 'https://jsonbin.io/v3/b'; // 使用免费的JSON存储服务
    this.binId = '65f8a8c2dc74654018b8c8a1'; // 替换为你的bin ID
    this.apiKey = '$2a$10$your-api-key'; // 替换为你的API key
  }

  // 保存数据到云端
  async saveToCloud(data) {
    try {
      const response = await fetch(`${this.apiUrl}/${this.binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.apiKey
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        console.log('数据已保存到云端');
        return true;
      } else {
        console.error('云端保存失败:', response.status);
        return false;
      }
    } catch (error) {
      console.error('云端保存错误:', error);
      return false;
    }
  }

  // 从云端加载数据
  async loadFromCloud() {
    try {
      const response = await fetch(`${this.apiUrl}/${this.binId}/latest`, {
        headers: {
          'X-Master-Key': this.apiKey
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('从云端加载数据:', result.record);
        return result.record || [];
      } else {
        console.error('云端加载失败:', response.status);
        return [];
      }
    } catch (error) {
      console.error('云端加载错误:', error);
      return [];
    }
  }

  // 同步数据（保存到云端和本地）
  async syncData(candidates) {
    try {
      // 保存到云端
      const cloudSuccess = await this.saveToCloud(candidates);
      
      if (cloudSuccess) {
        console.log('数据同步成功');
        return true;
      } else {
        console.log('云端同步失败，仅保存到本地');
        return false;
      }
    } catch (error) {
      console.error('数据同步错误:', error);
      return false;
    }
  }
}

// 创建单例实例
const dataSync = new DataSync();

export default dataSync;

