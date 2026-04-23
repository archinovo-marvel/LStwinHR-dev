const express = require('express');

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

      const [users] = await pool.query(
        'SELECT * FROM PersonalUser WHERE email = ? OR username = ?',
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

      const storedCode = verificationCodes.get(email);
      if (!storedCode || storedCode.code !== verificationCode) {
        return res.status(400).json({ message: '验证码错误或已过期' });
      }
      if (Date.now() > storedCode.expiry) {
        verificationCodes.delete(email);
        return res.status(400).json({ message: '验证码已过期' });
      }

      // 检查用户名是否已存在
      const [existingUsername] = await pool.query(
        'SELECT * FROM PersonalUser WHERE username = ?',
        [username]
      );
      if (existingUsername.length > 0) {
        return res.status(400).json({ message: '用户名已被注册', field: 'userId' });
      }
      // 检查邮箱是否已存在
      const [existingEmail] = await pool.query(
        'SELECT * FROM PersonalUser WHERE email = ?',
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({ message: '该邮箱已被注册', field: 'email' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date();
      const [result] = await pool.query(
        'INSERT INTO PersonalUser (username, email, password, role, systemCode, memberLevel, userType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, 'PERSONAL_USER', 'zplx', '普通会员', 'PERSONAL', now, now]
      );

      await initPersonalUserDB(result.insertId);

      verificationCodes.delete(email);
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

      const storedCode = verificationCodes.get(email);
      if (storedCode && Date.now() < storedCode.expiry - 4 * 60 * 1000) {
        const waitTime = Math.ceil((storedCode.expiry - 4 * 60 * 1000 - Date.now()) / 1000);
        return res.status(429).json({
          message: '发送过于频繁，请稍后再试',
          waitTime
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 5 * 60 * 1000;
      verificationCodes.set(email, { code, expiry });

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

      const sendEmailWithTimeout = Promise.race([
        emailTransporter.sendMail(mailOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('邮件发送超时')), 15000))
      ]);
      await sendEmailWithTimeout;

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

  return router;
}

module.exports = createPersonalAuthRouter;