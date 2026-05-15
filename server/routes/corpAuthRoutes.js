const express = require('express');
const crypto = require('crypto');

const { checkLoginRateLimit, resetLoginAttempts } = require('../utils/loginRateLimit');

function createCorpAuthRouter({
  pool,
  bcrypt,
  jwt,
  JWT_SECRET,
  verificationCodes,
  emailTransporter,
  EMAIL_VERIFICATION_MODE,
  authMiddleware,
  ensureCandidateDatabase,
  emailFromName,
  emailFromAddress
}) {
  const router = express.Router();

  // POST /api/corp/login
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
        'SELECT id, username, email, phone, password, role, memberLevel, userType, company, systemCode FROM User WHERE email = ? OR username = ?',
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

      await ensureCandidateDatabase(user.id);

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username, userType: 'CORP' },
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
          phone: user.phone,
          company: user.company,
          memberLevel: user.memberLevel || '普通会员',
          role: user.role
        }
      });
    } catch (error) {
      console.error('企业用户登录错误:', error);
      res.status(500).json({ message: '登录失败，请稍后重试' });
    }
  });

  // POST /api/corp/register
  router.post('/register', async (req, res) => {
    try {
      const { userId, phone, email, password, verificationCode } = req.body;
      if (!userId || !phone || !email || !password) {
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
        'SELECT username, email, phone FROM User WHERE username = ? OR email = ? OR phone = ?',
        [userId, email, phone]
      );
      if (existing.length > 0) {
        const m = existing[0];
        if (m.username === userId) return res.status(400).json({ message: '用户名已被注册', field: 'userId' });
        if (m.email === email) return res.status(400).json({ message: '该邮箱已被注册', field: 'email' });
        return res.status(400).json({ message: '该手机号已被注册', field: 'phone' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date();
      let result;
      try {
        [result] = await pool.query(
          'INSERT INTO User (username, email, phone, password, role, systemCode, userType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, email, phone, hashedPassword, 'USER', 'zplx', 'CORP', now, now]
        );
      } catch (insertErr) {
        if (insertErr.errno === 1062) {
          const msg = insertErr.message || '';
          if (msg.includes('uk_user_username') || msg.includes('username')) return res.status(400).json({ message: '用户名已被注册', field: 'userId' });
          if (msg.includes('uk_user_email') || msg.includes('email')) return res.status(400).json({ message: '该邮箱已被注册', field: 'email' });
          return res.status(400).json({ message: '该信息已被注册' });
        }
        throw insertErr;
      }

      try {
        await ensureCandidateDatabase(result.insertId);
      } catch (initErr) {
        await pool.query('DELETE FROM User WHERE id = ?', [result.insertId]).catch(() => {});
        throw initErr;
      }

      await verificationCodes.delete(email);
      res.json({
        success: true,
        message: '注册成功',
        user: {
          id: result.insertId,
          name: userId,
          email,
          phone
        }
      });
    } catch (error) {
      console.error('企业用户注册错误:', error);
      res.status(500).json({ message: '注册失败，请稍后重试' });
    }
  });

  // POST /api/corp/send-verification-code
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
        subject: type === 'reset' ? '密码重置验证码' : '企业用户邮箱验证',
        html: `
          <div style="padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
              <h2 style="color: #1890ff; text-align: center;">${type === 'reset' ? '密码重置验证码' : '企业用户邮箱验证'}</h2>
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
        console.log(`[企业验证码][${type || 'register'}] ${email}: ${code}`);
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
      console.error('发送企业验证码错误:', error.message);
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

  return router;
}

module.exports = createCorpAuthRouter;