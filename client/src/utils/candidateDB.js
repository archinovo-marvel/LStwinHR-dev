// IndexedDB 候选人数据管理工具 - 支持用户专属数据库
class CandidateDB {
  constructor() {
    this.dbVersion = 2;
    this.storeName = 'candidates';
    this.db = null;
    this.currentUserId = null;
    this.dbName = null;
  }

  ensureStore(db) {
    if (!db.objectStoreNames.contains(this.storeName)) {
      const store = db.createObjectStore(this.storeName, {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('name', 'name', { unique: false });
      store.createIndex('position', 'position', { unique: false });
      store.createIndex('submitTime', 'submitTime', { unique: false });
      store.createIndex('userId', 'userId', { unique: false });
      console.log(`用户专属候选人数据存储创建成功: ${this.dbName}`);
    }
  }
  // 获取当前登录用户信息
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        return null;
      }
      const user = JSON.parse(userStr);
      return user;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }
  // 生成用户专属数据库名称
  generateUserDbName(userId) {
    // 使用用户ID生成唯一的数据库名称，确保唯一性和可追溯性
    // 格式：CandidateDatabase_user_{userId}
    return `CandidateDatabase_user_${userId}`;
  }
  // 验证用户身份并获取用户ID
  validateAndGetUserId() {
    const user = this.getCurrentUser();
    if (!user || !user.id) {
      throw new Error('用户未登录，无法访问数据库');
    }
    return user.id;
  }
  // 初始化数据库（支持用户专属数据库）
  async init() {
    try {
      // 验证用户身份
      const userId = this.validateAndGetUserId();
      // 检查用户是否变更，如果变更则需要重新初始化
      if (this.currentUserId !== userId) {
        this.currentUserId = userId;
        this.dbName = this.generateUserDbName(userId);
        this.db = null; // 重置数据库连接
      }
      // 如果数据库已初始化，直接返回
      if (this.db) {
        return this.db;
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName);

        request.onerror = () => {
          console.error('IndexedDB 打开失败:', request.error);
          reject(new Error(`数据库连接失败: ${request.error?.message || '未知错误'}`));
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          this.ensureStore(db);
        };

        request.onsuccess = () => {
          const db = request.result;
          this.dbVersion = db.version;

          if (!db.objectStoreNames.contains(this.storeName)) {
            console.log(`Object store "${this.storeName}" 不存在，需要升级数据库`);
            db.close();
            const currentVersion = db.version;
            const upgradeRequest = indexedDB.open(this.dbName, currentVersion + 1);

            upgradeRequest.onerror = () => {
              console.error('数据库升级失败:', upgradeRequest.error);
              reject(new Error(`数据库升级失败: ${upgradeRequest.error?.message || '未知错误'}`));
            };

            upgradeRequest.onupgradeneeded = (event) => {
              const upgradedDb = event.target.result;
              this.ensureStore(upgradedDb);
            };

            upgradeRequest.onsuccess = () => {
              this.db = upgradeRequest.result;
              this.dbVersion = upgradeRequest.result.version;
              console.log(`用户专属数据库升级成功: ${this.dbName}, 版本: ${this.dbVersion}`);
              resolve(this.db);
            };
          } else {
            this.db = db;
            console.log(`用户专属数据库初始化成功: ${this.dbName}, 版本: ${this.dbVersion}`);
            resolve(this.db);
          }
        };
      });
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }
  // 检查数据库是否存在
  async checkDatabaseExists() {
    try {
      const userId = this.validateAndGetUserId();
      const dbName = this.generateUserDbName(userId);
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          db.close();
          resolve(true);
        };
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      return false;
    }
  }
  // 获取数据库状态信息
  async getDatabaseStatus() {
    try {
      const userId = this.validateAndGetUserId();
      const dbName = this.generateUserDbName(userId);
      const exists = await this.checkDatabaseExists();
      return {
        userId,
        dbName,
        exists,
        status: exists ? '已创建' : '未创建',
        message: exists 
          ? `用户专属数据库已存在: ${dbName}` 
          : `用户专属数据库尚未创建，将在首次使用时自动创建`
      };
    } catch (error) {
      return {
        userId: null,
        dbName: null,
        exists: false,
        status: '错误',
        message: error.message
      };
    }
  }

  // 添加候选人数据（自动添加用户ID，实现数据隔离）
  async addCandidate(candidateData) {
    try {
      if (!this.db) {
        await this.init();
      }
      // 获取当前用户ID，确保数据隔离
      const userId = this.validateAndGetUserId();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        // 自动添加用户ID和创建时间，确保数据归属
        const dataWithUser = {
          ...candidateData,
          userId: userId, // 添加用户ID，实现数据隔离
          createdAt: new Date().toISOString()
        };
        const request = store.add(dataWithUser);
        request.onsuccess = () => {
          console.log('候选人数据添加成功:', dataWithUser);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error('候选人数据添加失败:', request.error);
          reject(new Error(`添加候选人数据失败: ${request.error?.message || '未知错误'}`));
        };
      });
    } catch (error) {
      console.error('添加候选人数据失败:', error);
      throw error;
    }
  }

  // 获取所有候选人数据（只返回当前用户的数据）
  async getAllCandidates() {
    try {
      if (!this.db) {
        await this.init();
      }
      // 检查 object store 是否存在
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        console.warn(`Object store "${this.storeName}" 不存在，返回空数据`);
        return [];
      }
      // 获取当前用户ID，确保只返回该用户的数据
      const userId = this.validateAndGetUserId();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          // 过滤出当前用户的数据，实现数据隔离
          const allData = request.result || [];
          const userSpecificData = allData.filter(item => item.userId === userId);
          console.log(`获取用户 ${userId} 的候选人数据:`, userSpecificData.length, '条');
          resolve(userSpecificData);
        };
        request.onerror = () => {
          console.error('获取候选人数据失败:', request.error);
          reject(new Error(`获取候选人数据失败: ${request.error?.message || '未知错误'}`));
        };
      });
    } catch (error) {
      console.error('获取候选人数据失败:', error);
      throw error;
    }
  }

  // 根据ID删除候选人（验证数据归属）
  async deleteCandidate(id) {
    try {
      if (!this.db) {
        await this.init();
      }
      // 检查 object store 是否存在
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        throw new Error('候选人数据不存在');
      }
      // 获取当前用户ID
      const userId = this.validateAndGetUserId();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        // 先获取数据验证归属
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const data = getRequest.result;
          // 验证数据是否属于当前用户
          if (!data) {
            reject(new Error('候选人数据不存在'));
            return;
          }
          if (data.userId !== userId) {
            reject(new Error('无权删除此数据：数据不属于当前用户'));
            return;
          }
          // 验证通过，执行删除
          const deleteRequest = store.delete(id);
          deleteRequest.onsuccess = () => {
            console.log('候选人数据删除成功:', id);
            resolve(deleteRequest.result);
          };
          deleteRequest.onerror = () => {
            console.error('候选人数据删除失败:', deleteRequest.error);
            reject(new Error(`删除失败: ${deleteRequest.error?.message || '未知错误'}`));
          };
        };
        getRequest.onerror = () => {
          console.error('获取候选人数据失败:', getRequest.error);
          reject(new Error(`获取数据失败: ${getRequest.error?.message || '未知错误'}`));
        };
      });
    } catch (error) {
      console.error('删除候选人数据失败:', error);
      throw error;
    }
  }

  // 更新候选人数据（验证数据归属）
  async updateCandidate(id, updateData) {
    try {
      if (!this.db) {
        await this.init();
      }
      // 检查 object store 是否存在
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        throw new Error('候选人数据不存在');
      }
      // 获取当前用户ID
      const userId = this.validateAndGetUserId();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const existingData = getRequest.result;
          // 验证数据是否存在
          if (!existingData) {
            reject(new Error('候选人数据不存在'));
            return;
          }
          // 验证数据归属
          if (existingData.userId !== userId) {
            reject(new Error('无权更新此数据：数据不属于当前用户'));
            return;
          }
          // 更新数据，保留用户ID
          const updatedData = {
            ...existingData,
            ...updateData,
            userId: userId, // 确保用户ID不被修改
            updatedAt: new Date().toISOString()
          };
          const putRequest = store.put(updatedData);
          putRequest.onsuccess = () => {
            console.log('候选人数据更新成功:', updatedData);
            resolve(updatedData);
          };
          putRequest.onerror = () => {
            console.error('候选人数据更新失败:', putRequest.error);
            reject(new Error(`更新失败: ${putRequest.error?.message || '未知错误'}`));
          };
        };
        getRequest.onerror = () => {
          console.error('获取候选人数据失败:', getRequest.error);
          reject(new Error(`获取数据失败: ${getRequest.error?.message || '未知错误'}`));
        };
      });
    } catch (error) {
      console.error('更新候选人数据失败:', error);
      throw error;
    }
  }

  // 清空当前用户的所有数据（不影响其他用户）
  async clearAll() {
    try {
      if (!this.db) {
        await this.init();
      }
      // 再次检查 object store 是否存在
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        console.warn(`Object store "${this.storeName}" 不存在，无需清空`);
        return { deleteCount: 0, errorCount: 0 };
      }
      // 获取当前用户ID
      const userId = this.validateAndGetUserId();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          const allData = request.result || [];
          // 只删除当前用户的数据
          const userSpecificData = allData.filter(item => item.userId === userId);
          let deleteCount = 0;
          let errorCount = 0;
          // 逐个删除用户的数据
          userSpecificData.forEach(item => {
            const deleteRequest = store.delete(item.id);
            deleteRequest.onsuccess = () => {
              deleteCount++;
            };
            deleteRequest.onerror = () => {
              errorCount++;
            };
          });
          // 等待所有删除操作完成
          transaction.oncomplete = () => {
            console.log(`已清空用户 ${userId} 的所有数据，共删除 ${deleteCount} 条`);
            if (errorCount > 0) {
              console.warn(`删除过程中有 ${errorCount} 条数据失败`);
            }
            resolve({ deleteCount, errorCount });
          };
          transaction.onerror = () => {
            reject(new Error('清空数据事务失败'));
          };
        };
        request.onerror = () => {
          console.error('获取数据失败:', request.error);
          reject(new Error(`获取数据失败: ${request.error?.message || '未知错误'}`));
        };
      });
    } catch (error) {
      console.error('清空数据失败:', error);
      throw error;
    }
  }

  // 根据姓名搜索候选人（只搜索当前用户的数据）
  async searchByName(name) {
    try {
      if (!this.db) {
        await this.init();
      }
      // 检查 object store 是否存在
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        console.warn(`Object store "${this.storeName}" 不存在，返回空数据`);
        return [];
      }
      // 获取当前用户ID
      const userId = this.validateAndGetUserId();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('name');
        const request = index.getAll(name);
        request.onsuccess = () => {
          // 过滤出当前用户的数据
          const allResults = request.result || [];
          const userSpecificResults = allResults.filter(item => item.userId === userId);
          resolve(userSpecificResults);
        };
        request.onerror = () => {
          reject(new Error(`搜索失败: ${request.error?.message || '未知错误'}`));
        };
      });
    } catch (error) {
      console.error('搜索候选人失败:', error);
      throw error;
    }
  }
  // 切换用户时重置数据库连接（用于用户登出或切换账号）
  resetConnection() {
    this.db = null;
    this.currentUserId = null;
    this.dbName = null;
    console.log('数据库连接已重置');
  }
}

const candidateDB = new CandidateDB();

export default candidateDB;
