// 服务器数据同步工具 - 使用Express服务器进行跨设备数据同步
class ServerDataSync {
  constructor() {
    // 使用相对路径，避免Mixed Content错误
    // 前端和后端都通过ngrok暴露，使用相对路径
    this.baseUrl = '/api';
  }

  // 获取所有候选人数据
  async getAllCandidates(options = {}) {
    try {
      const { normalizeResumeFiles = false } = options;
      const query = normalizeResumeFiles ? '?normalizeResumeFiles=true' : '';
      const response = await fetch(`${this.baseUrl}/candidates${query}`, {
        headers: this.getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        console.log('从服务器获取候选人数据:', data);
        return data;
      } else {
        console.error('获取数据失败:', response.status);
        return [];
      }
    } catch (error) {
      console.error('获取候选人数据失败:', error);
      return [];
    }
  }

  // 添加候选人数据（支持文件上传）
  async addCandidateWithFile(formData, options = {}) {
    try {
      console.log('开始保存候选人数据到服务器（包含文件）');
      const ownerId = options?.ownerId ? Number(options.ownerId) : null;
      const requestUrl = ownerId ? `${this.baseUrl}/candidates?ownerId=${ownerId}` : `${this.baseUrl}/candidates`;
      console.log('API URL:', requestUrl);
      
      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      // 调试FormData内容
      console.log('FormData内容:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData, // 直接发送FormData，不设置Content-Type让浏览器自动设置
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('服务器响应状态:', response.status);
      console.log('服务器响应头:', response.headers);

      if (response.ok) {
        const result = await response.json();
        console.log('候选人数据已保存到服务器:', result.candidate);
        return result.candidate;
      } else {
        const errorText = await response.text();
        console.error('保存数据失败:', response.status, errorText);
        
        if (response.status === 504) {
          throw new Error('请求超时，请检查网络连接或稍后重试');
        } else {
          throw new Error(`保存数据失败: ${response.status} ${errorText}`);
        }
      }
    } catch (error) {
      console.error('保存候选人数据失败:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接或稍后重试');
      }
      
      throw error;
    }
  }

  // 添加候选人数据（兼容旧版本）
  async addCandidate(candidateData) {
    try {
      console.log('开始保存候选人数据到服务器:', candidateData);
      console.log('数据字段检查:', {
        name: candidateData.name,
        position: candidateData.position,
        phone: candidateData.phone,
        email: candidateData.email,
        mbti: candidateData.mbti
      });
      console.log('API URL:', `${this.baseUrl}/candidates`);
      
      const requestBody = JSON.stringify(candidateData);
      console.log('请求体内容:', requestBody);
      
      const response = await fetch(`${this.baseUrl}/candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: requestBody
      });

      console.log('服务器响应状态:', response.status);
      console.log('服务器响应头:', response.headers);

      if (response.ok) {
        const result = await response.json();
        console.log('候选人数据已保存到服务器:', result.candidate);
        return result.candidate;
      } else {
        const errorText = await response.text();
        console.error('保存数据失败:', response.status, errorText);
        throw new Error(`保存数据失败: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('保存候选人数据失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        url: `${this.baseUrl}/candidates`,
        candidateData: candidateData
      });
      throw error;
    }
  }

  // 删除候选人数据
  async deleteCandidate(candidateId) {
    try {
      const response = await fetch(`${this.baseUrl}/candidates/${candidateId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        console.log('候选人数据已从服务器删除:', candidateId);
        return true;
      } else {
        console.error('删除数据失败:', response.status);
        return false;
      }
    } catch (error) {
      console.error('删除候选人数据失败:', error);
      return false;
    }
  }

  // 清空所有数据
  async clearAllCandidates() {
    try {
      const response = await fetch(`${this.baseUrl}/candidates`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({ success: true }));
        console.log('所有候选人数据已从服务器清空');
        return result;
      } else {
        console.error('清空数据失败:', response.status);
        return false;
      }
    } catch (error) {
      console.error('清空候选人数据失败:', error);
      return false;
    }
  }

  // 预览无效候选人清理结果
  async previewInvalidCandidatesCleanup() {
    try {
      const response = await fetch(`${this.baseUrl}/candidates/cleanup-invalid-preview`, {
        headers: this.getAuthHeaders()
      });
      if (response.ok) {
        return await response.json();
      }
      console.error('预览无效候选人清理失败:', response.status);
      return { success: false, count: 0, candidates: [] };
    } catch (error) {
      console.error('预览无效候选人清理失败:', error);
      return { success: false, count: 0, candidates: [] };
    }
  }

  // 清理无效候选人
  async cleanupInvalidCandidates() {
    try {
      const response = await fetch(`${this.baseUrl}/candidates/cleanup-invalid`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        return await response.json();
      }
      console.error('清理无效候选人失败:', response.status);
      return { success: false, removedCount: 0, removedCandidates: [] };
    } catch (error) {
      console.error('清理无效候选人失败:', error);
      return { success: false, removedCount: 0, removedCandidates: [] };
    }
  }

  async getAvailablePositions(options = {}) {
    try {
      const token = options?.token || null;
      const ownerId = options?.ownerId ? Number(options.ownerId) : null;
      const params = new URLSearchParams();
      if (ownerId) params.set('ownerId', String(ownerId));
      if (token) params.set('token', token);
      const queryString = params.toString();
      const requestUrl = queryString ? `${this.baseUrl}/positions?${queryString}` : `${this.baseUrl}/positions`;
      // 如果有公开 token，不使用 localStorage 的 auth header，让后端走公开通道
      const headers = token ? {} : this.getAuthHeaders();
      const response = await this.fetchWithTimeout(requestUrl, {
        method: 'GET',
        headers
      });
      const result = await response.json();
      return Array.isArray(result.positions) ? result.positions : [];
    } catch (error) {
      console.error('获取岗位列表失败:', error);
      return [];
    }
  }

  async savePosition(positionData) {
    try {
      const hasId = Boolean(positionData?.id);
      const response = await this.fetchWithTimeout(
        hasId ? `${this.baseUrl}/positions/${positionData.id}` : `${this.baseUrl}/positions`,
        {
          method: hasId ? 'PUT' : 'POST',
          headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(positionData || {})
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || '保存岗位失败');
      return result.position;
    } catch (error) {
      console.error('保存岗位失败:', error);
      throw error;
    }
  }

  async deletePosition(positionId) {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/positions/${positionId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || '删除岗位失败');
      return true;
    } catch (error) {
      console.error('删除岗位失败:', error);
      throw error;
    }
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  }

  // 公开投递候选人（二维码扫码等场景，无需登录）
  async addCandidatePublic(formData, options = {}) {
    try {
      const token = options?.token || null;
      if (!token) {
        throw new Error('公开投递缺少访问令牌');
      }
      const requestUrl = `${this.baseUrl}/public/candidates?token=${encodeURIComponent(token)}`;
      console.log('公开投递 URL:', requestUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(requestUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('公开投递响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('公开投递成功:', result.candidate);
        return result.candidate;
      } else {
        const errorText = await response.text();
        console.error('公开投递失败:', response.status, errorText);
        throw new Error(`提交失败: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('公开投递候选人数据失败:', error);
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接或稍后重试');
      }
      throw error;
    }
  }

  // 检查服务器健康状态
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        const result = await response.json();
        console.log('服务器健康状态:', result);
        return true;
      } else {
        console.error('服务器健康检查失败:', response.status);
        return false;
      }
    } catch (error) {
      console.error('服务器连接失败:', error);
      return false;
    }
  }
}

// 创建单例实例
const serverDataSync = new ServerDataSync();

export default serverDataSync;
