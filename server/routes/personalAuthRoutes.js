const express = require('express');
const crypto = require('crypto');

const { checkLoginRateLimit, resetLoginAttempts } = require('../utils/loginRateLimit');

function createPersonalAuthRouter({
  pool,
  bcrypt,
  jwt,
  JWT_SECRET,
  verificationCodes,
  emailTransporter,
  EMAIL_VERIFICATION_MODE,
  authMiddleware,
  initPersonalUserDB,
  emailFromName,
  emailFromAddress
}) {
  const router = express.Router();

  // POST /api/personal/login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码不能为空' });
      }

      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      if (!checkLoginRateLimit(ip)) {
        return res.status(429).json({ message: '登录尝试次数过多，请15分钟后重试' });
      }

      const [users] = await pool.query(
        'SELECT id, username, email, phone, password, role, memberLevel, userType, systemCode FROM PersonalUser WHERE email = ? OR username = ?',
        [username, username]
      );

      if (users.length === 0) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }

      const user = users[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }

      resetLoginAttempts(ip);

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username, userType: 'PERSONAL' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: '登录成功',
        token,
        user: {
          id: user.id,
          name: user.username,
          email: user.email,
          memberLevel: user.memberLevel || '普通会员',
          role: user.role
        }
      });
    } catch (error) {
      console.error('个人用户登录错误:', error);
      res.status(500).json({ message: '登录失败，请稍后重试' });
    }
  });

  // POST /api/personal/register
  router.post('/register', async (req, res) => {
    try {
      const { username, email, password, verificationCode } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: '请填写完整的注册信息' });
      }

      const storedCode = await verificationCodes.get(email);
      if (!storedCode || storedCode.code !== verificationCode) {
        return res.status(400).json({ message: '验证码错误或已过期' });
      }
      if (Date.now() > storedCode.expiry) {
        await verificationCodes.delete(email);
        return res.status(400).json({ message: '验证码已过期' });
      }

      // 早期快速检查（优化用途，不是唯一性保障）
      const [existing] = await pool.query(
        'SELECT username, email FROM PersonalUser WHERE username = ? OR email = ?',
        [username, email]
      );
      if (existing.length > 0) {
        const m = existing[0];
        if (m.username === username) return res.status(400).json({ message: '用户名已被注册', field: 'userId' });
        return res.status(400).json({ message: '该邮箱已被注册', field: 'email' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date();
      let result;
      try {
        [result] = await pool.query(
          'INSERT INTO PersonalUser (username, email, password, role, systemCode, memberLevel, userType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [username, email, hashedPassword, 'PERSONAL_USER', 'zplx', '普通会员', 'PERSONAL', now, now]
        );
      } catch (insertErr) {
        if (insertErr.errno === 1062) {
          const msg = insertErr.message || '';
          if (msg.includes('email')) return res.status(400).json({ message: '该邮箱已被注册', field: 'email' });
          return res.status(400).json({ message: '用户名已被注册', field: 'userId' });
        }
        throw insertErr;
      }

      try {
        await initPersonalUserDB(result.insertId);
      } catch (initErr) {
        await pool.query('DELETE FROM PersonalUser WHERE id = ?', [result.insertId]).catch(() => {});
        throw initErr;
      }

      await verificationCodes.delete(email);
      res.json({
        success: true,
        message: '注册成功',
        user: {
          id: result.insertId,
          name: username,
          email
        }
      });
    } catch (error) {
      console.error('个人用户注册错误:', error);
      res.status(500).json({ message: '注册失败，请稍后重试' });
    }
  });

  // POST /api/personal/send-verification-code
  router.post('/send-verification-code', async (req, res) => {
    try {
      const { email, type } = req.body;
      if (!email) {
        return res.status(400).json({ message: '请提供邮箱地址' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: '请提供有效的邮箱地址' });
      }

      const storedCode = await verificationCodes.get(email);
      if (storedCode && Date.now() < storedCode.expiry - 4 * 60 * 1000) {
        const waitTime = Math.ceil((storedCode.expiry - 4 * 60 * 1000 - Date.now()) / 1000);
        return res.status(429).json({
          message: '发送过于频繁，请稍后再试',
          waitTime
        });
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      const expiry = Date.now() + 5 * 60 * 1000;
      await verificationCodes.set(email, { code, expiry });

      const mailOptions = {
        from: `"${emailFromName}" <${emailFromAddress}>`,
        to: email,
        subject: type === 'reset' ? '密码重置验证码' : '个人用户邮箱验证',
        html: `
          <div style="padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
              <h2 style="color: #1890ff; text-align: center;">${type === 'reset' ? '密码重置验证码' : '个人用户邮箱验证'}</h2>
              <p style="font-size: 16px; color: #333;">您好！</p>
              <p style="font-size: 16px; color: #333;">您的验证码是：</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #1890ff; letter-spacing: 10px;">${code}</span>
              </div>
              <p style="font-size: 14px; color: #999;">验证码有效期为5分钟，请尽快使用。</p>
              <p style="font-size: 14px; color: #999;">如果这不是您的操作，请忽略此邮件。</p>
            </div>
          </div>
        `
      };

      if (EMAIL_VERIFICATION_MODE === 'console') {
        console.log(`[个人验证码][${type || 'register'}] ${email}: ${code}`);
        return res.json({
          success: true,
          message: '验证码已生成，请联系管理员查看服务端日志'
        });
      }

      if (!emailTransporter) {
        return res.status(503).json({ message: '邮件服务未配置，请联系管理员' });
      }

      let emailTimeoutId;
      const emailTimeoutPromise = new Promise((_, reject) => { emailTimeoutId = setTimeout(() => reject(new Error('邮件发送超时')), 15000); });
      await Promise.race([emailTransporter.sendMail(mailOptions), emailTimeoutPromise]).finally(() => clearTimeout(emailTimeoutId));

      res.json({
        success: true,
        message: '验证码已发送至您的邮箱'
      });
    } catch (error) {
      console.error('发送个人验证码错误:', error.message);
      if (error.message.includes('timeout') || error.message.includes('超时')) {
        return res.status(504).json({ message: '邮件发送超时，请检查网络连接后重试' });
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({ message: '邮件服务暂时不可用，请稍后重试' });
      }
      if (error.code === 'EAUTH') {
        return res.status(500).json({ message: '邮件服务认证失败，请联系管理员' });
      }
      res.status(500).json({ message: '发送验证码失败，请稍后重试' });
    }
  });

  // GET /api/personal/user/info
  router.get('/user/info', authMiddleware, async (req, res) => {
    try {
      const [users] = await pool.query(
        'SELECT id, username, email, memberLevel, role, createdAt, updatedAt FROM PersonalUser WHERE id = ?',
        [req.user.id]
      );
      if (users.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      res.json({ success: true, user: users[0] });
    } catch (error) {
      console.error('获取个人用户信息错误:', error);
      res.status(500).json({ message: '获取用户信息失败' });
    }
  });

  // PUT /api/personal/user/info
  router.put('/user/info', authMiddleware, async (req, res) => {
    try {
      const { username } = req.body;
      await pool.query(
        'UPDATE PersonalUser SET username = ?, updatedAt = NOW() WHERE id = ?',
        [username, req.user.id]
      );
      const [users] = await pool.query(
        'SELECT id, username, email, memberLevel, role, createdAt, updatedAt FROM PersonalUser WHERE id = ?',
        [req.user.id]
      );
      res.json({ success: true, message: '用户信息更新成功', user: users[0] });
    } catch (error) {
      console.error('更新个人用户信息错误:', error);
      res.status(500).json({ message: '更新用户信息失败' });
    }
  });

  // PUT /api/personal/user/password
  router.put('/user/password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const [users] = await pool.query('SELECT password FROM PersonalUser WHERE id = ?', [req.user.id]);
      if (users.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      const isPasswordValid = await bcrypt.compare(oldPassword, users[0].password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: '原密码错误' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE PersonalUser SET password = ?, updatedAt = NOW() WHERE id = ?', [hashedPassword, req.user.id]);
      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      console.error('修改密码错误:', error);
      res.status(500).json({ message: '修改密码失败' });
    }
  });

  // DELETE /api/personal/user - 注销个人账户
  router.delete('/user', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const dbName = `lstwin_personal_user_${userId}`;

      // 删除个人用户数据库
      const rootConnectionConfig = {
        host: pool.pool.config.connectionConfig.host,
        port: pool.pool.config.connectionConfig.port,
        user: process.env.DB_ROOT_USER || 'root',
        password: process.env.DB_ROOT_PASSWORD || 'rootpassword',
        multipleStatements: true
      };

      let rootConnection;
      try {
        const mysql = require('mysql2/promise');
        rootConnection = await mysql.createConnection(rootConnectionConfig);
        await rootConnection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      } catch (dbError) {
        console.error('删除个人用户数据库失败:', dbError.message);
      } finally {
        if (rootConnection) await rootConnection.end();
      }

      // 删除用户记录
      await pool.query('DELETE FROM PersonalUser WHERE id = ?', [userId]);

      res.json({ success: true, message: '账户注销成功' });
    } catch (error) {
      console.error('删除个人用户错误:', error);
      res.status(500).json({ message: '账户注销失败' });
    }
  });

  return router;
}

module.exports = createPersonalAuthRouter;