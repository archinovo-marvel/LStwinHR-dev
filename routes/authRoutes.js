const express = require('express');

function createAuthRouter({
  pool,
  bcrypt,
  jwt,
  JWT_SECRET,
  verificationCodes,
  emailTransporter,
  EMAIL_VERIFICATION_MODE,
  authMiddleware,
  createPublicSubmissionToken,
  ensureCandidateDatabase,
  emailFromName,
  emailFromAddress
}) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码不能为空' });
      }

      const [users] = await pool.query(
        'SELECT * FROM User WHERE email = ? OR username = ?',
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

      await ensureCandidateDatabase(user.id);

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
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
      console.error('登录错误:', error);
      res.status(500).json({ message: '登录失败，请稍后重试' });
    }
  });

  router.post('/register', async (req, res) => {
    try {
      const { userId, phone, email, password, verificationCode } = req.body;
      if (!userId || !phone || !email || !password) {
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
        'SELECT * FROM User WHERE username = ?',
        [userId]
      );
      if (existingUsername.length > 0) {
        return res.status(400).json({ message: '用户名已被注册', field: 'userId' });
      }
      // 检查邮箱是否已存在
      const [existingEmail] = await pool.query(
        'SELECT * FROM User WHERE email = ?',
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({ message: '该邮箱已被注册', field: 'email' });
      }
      // 检查手机号是否已存在
      const [existingPhone] = await pool.query(
        'SELECT * FROM User WHERE phone = ?',
        [phone]
      );
      if (existingPhone.length > 0) {
        return res.status(400).json({ message: '该手机号已被注册', field: 'phone' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date();
      const [result] = await pool.query(
        'INSERT INTO User (username, email, phone, password, role, systemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, email, phone, hashedPassword, 'USER', 'zplx', now, now]
      );

      await ensureCandidateDatabase(result.insertId);

      verificationCodes.delete(email);
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
      console.error('注册错误:', error);
      res.status(500).json({ message: '注册失败，请稍后重试' });
    }
  });

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
        subject: type === 'reset' ? '密码重置验证码' : '邮箱验证码',
        html: `
          <div style="padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
              <h2 style="color: #1890ff; text-align: center;">${type === 'reset' ? '密码重置验证码' : '邮箱验证'}</h2>
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
        console.log(`[验证码][${type || 'register'}] ${email}: ${code}`);
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
      console.error('发送验证码错误:', error.message);
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

  router.post('/reset-password', async (req, res) => {
    try {
      const { username, email, verificationCode, newPassword } = req.body;
      if (!username || !email || !verificationCode || !newPassword) {
        return res.status(400).json({ message: '请填写完整信息' });
      }

      const storedCode = verificationCodes.get(email);
      if (!storedCode || storedCode.code !== verificationCode) {
        return res.status(400).json({ message: '验证码错误或已过期' });
      }
      if (Date.now() > storedCode.expiry) {
        verificationCodes.delete(email);
        return res.status(400).json({ message: '验证码已过期' });
      }

      const [users] = await pool.query(
        'SELECT * FROM User WHERE email = ? AND username = ?',
        [email, username]
      );
      if (users.length === 0) {
        return res.status(400).json({ message: '用户不存在' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE User SET password = ? WHERE email = ? AND username = ?',
        [hashedPassword, email, username]
      );

      verificationCodes.delete(email);
      res.json({
        success: true,
        message: '密码重置成功，请使用新密码登录'
      });
    } catch (error) {
      console.error('重置密码错误:', error);
      res.status(500).json({ message: '重置密码失败，请稍后重试' });
    }
  });

  router.get('/user/info', authMiddleware, async (req, res) => {
    try {
      const [users] = await pool.query(
        'SELECT id, username, email, phone, company, memberLevel, role, createdAt, updatedAt FROM User WHERE id = ?',
        [req.user.id]
      );
      if (users.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      res.json({
        success: true,
        user: users[0]
      });
    } catch (error) {
      console.error('获取用户信息错误:', error);
      res.status(500).json({ message: '获取用户信息失败' });
    }
  });

  router.put('/user/info', authMiddleware, async (req, res) => {
    try {
      const { username, phone, company } = req.body;
      const userId = req.user.id;

      try {
        await pool.query(
          'UPDATE User SET username = ?, phone = ?, company = ?, updatedAt = NOW() WHERE id = ?',
          [username, phone, company || null, userId]
        );
      } catch (updateError) {
        console.log('完整更新失败，尝试只更新username和phone:', updateError.message);
        await pool.query(
          'UPDATE User SET username = ?, phone = ?, updatedAt = NOW() WHERE id = ?',
          [username, phone, userId]
        );
      }

      const [users] = await pool.query(
        'SELECT id, username, email, phone, memberLevel, role, createdAt, updatedAt FROM User WHERE id = ?',
        [userId]
      );
      const userData = users[0];

      try {
        const [extendedInfo] = await pool.query(
          'SELECT company FROM User WHERE id = ?',
          [userId]
        );
        if (extendedInfo[0]) {
          userData.company = extendedInfo[0].company;
        }
      } catch (error) {
        // ignore missing column
      }

      res.json({
        success: true,
        message: '用户信息更新成功',
        user: userData
      });
    } catch (error) {
      console.error('更新用户信息错误:', error);
      res.status(500).json({ message: '更新用户信息失败' });
    }
  });

  router.put('/user/password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.id;

      const [users] = await pool.query('SELECT password FROM User WHERE id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, users[0].password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: '原密码错误' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE User SET password = ?, updatedAt = NOW() WHERE id = ?',
        [hashedPassword, userId]
      );

      res.json({
        success: true,
        message: '密码修改成功'
      });
    } catch (error) {
      console.error('修改密码错误:', error);
      res.status(500).json({ message: '修改密码失败' });
    }
  });

  router.get('/candidate-submission-token', authMiddleware, async (req, res) => {
    try {
      const token = createPublicSubmissionToken(req.user);
      res.json({
        success: true,
        submissionToken: token,
        expiresIn: '7d'
      });
    } catch (error) {
      console.error('生成候选人投递令牌失败:', error);
      res.status(500).json({ message: '生成候选人投递令牌失败' });
    }
  });

  router.post('/check-duplicate', async (req, res) => {
    try {
      const { field, value } = req.body;
      if (!field || !value) {
        return res.status(400).json({ success: false, message: '缺少检查字段或值' });
      }
      const trimmedValue = String(value).trim();
      if (!trimmedValue) {
        return res.json({ success: true, exists: false });
      }
      let query = '';
      let fieldName = '';
      switch (field) {
        case 'userId':
          query = 'SELECT id FROM User WHERE username = ?';
          fieldName = '用户名';
          break;
        case 'email':
          query = 'SELECT id FROM User WHERE email = ?';
          fieldName = '邮箱';
          break;
        case 'phone':
          query = 'SELECT id FROM User WHERE phone = ?';
          fieldName = '手机号';
          break;
        default:
          return res.status(400).json({ success: false, message: '不支持的检查字段' });
      }
      const [results] = await pool.query(query, [trimmedValue]);
      if (results.length > 0) {
        return res.json({ success: true, exists: true, message: `该${fieldName}已被注册` });
      }
      res.json({ success: true, exists: false });
    } catch (error) {
      console.error('检查重复信息错误:', error);
      res.status(500).json({ success: false, message: '检查失败，请稍后重试' });
    }
  });

  router.delete('/user', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const candidateTableName = `lstwin_candidates_user_${userId}_candidates`;
        const positionTableName = `lstwin_candidates_user_${userId}_positions`;
        const interviewTableName = `lstwin_candidates_user_${userId}_interview_sessions`;
        const [candidateTables] = await connection.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
          [candidateTableName]
        );
        if (candidateTables.length > 0) {
          await connection.query(`DROP TABLE \`${candidateTableName}\``);
        }
        const [positionTables] = await connection.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
          [positionTableName]
        );
        if (positionTables.length > 0) {
          await connection.query(`DROP TABLE \`${positionTableName}\``);
        }
        const [interviewTables] = await connection.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
          [interviewTableName]
        );
        if (interviewTables.length > 0) {
          await connection.query(`DROP TABLE \`${interviewTableName}\``);
        }
        await connection.query('DELETE FROM User WHERE id = ?', [userId]);
        await connection.commit();
        res.json({ success: true, message: '账户注销成功' });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('删除用户错误:', error);
      res.status(500).json({ message: '账户注销失败' });
    }
  });

  return router;
}

module.exports = {
  createAuthRouter
};
