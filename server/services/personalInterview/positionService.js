/**
 * 岗位管理服务
 * 负责个人用户自定义岗位的 CRUD 操作
 */
const { v4: uuidv4 } = require('uuid');

class PositionService {
  /**
   * 创建新岗位
   * @param {number} userId - 用户ID
   * @param {Object} data - 岗位数据
   * @returns {Promise<Object>} - 创建的岗位
   */
  async create(userId, data, pool) {
    const id = uuidv4();
    const {
      positionName,
      description,
      companyName,
      workYears,
      salaryRange,
      skills
    } = data;

    await pool.execute(
      `INSERT INTO personal_positions
       (id, user_id, position_name, description, company_name, work_years, salary_range, skills, usage_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        userId,
        positionName,
        description,
        companyName || null,
        workYears || null,
        salaryRange || null,
        skills ? JSON.stringify(skills) : null
      ]
    );

    return this.getById(id, pool);
  }

  /**
   * 获取用户所有岗位
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} - 岗位列表
   */
  async getByUserId(userId, pool) {
    const [rows] = await pool.execute(
      `SELECT * FROM personal_positions
       WHERE user_id = ?
       ORDER BY last_used_at DESC, created_at DESC`,
      [userId]
    );

    return rows.map(row => this.formatPosition(row));
  }

  /**
   * 获取单个岗位
   * @param {string} id - 岗位ID
   * @returns {Promise<Object|null>} - 岗位信息
   */
  async getById(id, pool) {
    const [rows] = await pool.execute(
      'SELECT * FROM personal_positions WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return null;
    return this.formatPosition(rows[0]);
  }

  /**
   * 更新岗位
   * @param {string} id - 岗位ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object|null>} - 更新后的岗位
   */
  async update(id, data, pool) {
    const fields = [];
    const values = [];

    const fieldMap = {
      positionName: 'position_name',
      description: 'description',
      companyName: 'company_name',
      workYears: 'work_years',
      salaryRange: 'salary_range',
      skills: 'skills'
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        if (key === 'skills') {
          values.push(data[key] ? JSON.stringify(data[key]) : null);
        } else {
          values.push(data[key]);
        }
      }
    }

    if (fields.length === 0) {
      return this.getById(id, pool);
    }

    values.push(id);
    await pool.execute(
      `UPDATE personal_positions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getById(id, pool);
  }

  /**
   * 删除岗位
   * @param {string} id - 岗位ID
   * @returns {Promise<boolean>} - 是否删除成功
   */
  async delete(id, pool) {
    const [result] = await pool.execute(
      'DELETE FROM personal_positions WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 增加使用次数
   * @param {string} id - 岗位ID
   */
  async incrementUsage(id, pool) {
    await pool.execute(
      `UPDATE personal_positions
       SET usage_count = usage_count + 1, last_used_at = NOW()
       WHERE id = ?`,
      [id]
    );
  }

  /**
   * 格式化岗位数据
   */
  formatPosition(row) {
    return {
      id: row.id,
      userId: row.user_id,
      positionName: row.position_name,
      description: row.description,
      companyName: row.company_name,
      workYears: row.work_years,
      salaryRange: row.salary_range,
      skills: row.skills ? JSON.parse(row.skills) : null,
      usageCount: row.usage_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = new PositionService();
