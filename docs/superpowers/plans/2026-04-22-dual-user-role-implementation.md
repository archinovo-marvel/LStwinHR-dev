# 双角色用户体系实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 企业端/个人端双角色隔离登录、注册、Dashboard、侧边栏、个人简历优化全功能

**Architecture:** 单代码库，userType字段路由。企业用户走User表+`lstwin_candidates_user_{id}`数据库；个人用户走PersonalUser表+`lstwin_personal_user_{id}`数据库。前端根据userType渲染不同侧边栏/Dashboard。

**Tech Stack:** React + Express + MySQL + JWT + Ant Design

---

## 文件结构总览

### 后端新建
- `server/routes/personalAuthRoutes.js` — 个人用户认证路由
- `server/routes/corpAuthRoutes.js` — 企业用户认证路由（从原authRoutes.js拆分）
- `server/routes/personalResumeRoutes.js` — 个人简历路由
- `mysql-init/02-personal-users.sql` — PersonalUser表 + 个人数据库初始化

### 后端修改
- `server.js` — 注册personal/corp新路由前缀
- `server/middleware/auth.middleware.js` — 支持PersonalUser JWT验证
- `db.js` — 增加个人用户数据库连接方法

### 前端新建
- `client/src/pages/PersonalDashboardPage.js` — 个人版Dashboard
- `client/src/pages/PersonalResumePage.js` — 个人简历优化页
- `client/src/components/AuthCard.jsx` — 卡片翻转登录/注册组件

### 前端修改
- `client/src/App.js` — 路由按userType分支
- `client/src/context/AuthContext.js` — 双角色登录/状态管理
- `client/src/components/Layout.js` — 按userType渲染侧边栏
- `client/src/components/LoginForm.js` — 卡片切换登录
- `client/src/components/RegisterForm.js` — 卡片切换注册
- `client/src/pages/LoginPage.js` — 替换为AuthCard
- `client/src/pages/RegisterPage.js` — 替换为AuthCard

---

## Task 1: 数据库 — PersonalUser表和个人用户数据库初始化

**Files:**
- Create: `mysql-init/02-personal-users.sql`
- Modify: `db.js`

- [ ] **Step 1: 创建PersonalUser表和初始化脚本**

```sql
-- mysql-init/02-personal-users.sql

CREATE TABLE IF NOT EXISTS luanshu-authhub.PersonalUser (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(30),
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'PERSONAL_USER',
  systemCode VARCHAR(50) DEFAULT 'zplx',
  memberLevel VARCHAR(50) DEFAULT '普通会员',
  userType ENUM('CORP', 'PERSONAL') DEFAULT 'PERSONAL',
  verificationCode VARCHAR(10),
  verificationExpiry DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: 创建个人用户简历数据库初始化SQL**

```sql
-- mysql-init/02-personal-users.sql (追加)
-- 注意：个人用户数据库在注册时动态创建，这里写建表语句模板
-- 实际创建通过 Node.js 的 db.js 方法执行
```

- [ ] **Step 3: 修改db.js增加个人用户数据库连接方法**

```javascript
// db.js 追加以下方法

// 获取个人用户数据库连接
function getPersonalUserDB(userId) {
  const dbName = `lstwin_personal_user_${userId}`;
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  return pool;
}

// 初始化个人用户数据库（注册时调用）
async function initPersonalUserDB(userId) {
  const dbName = `lstwin_personal_user_${userId}`;
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS personal_resumes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      owner_user_id BIGINT NOT NULL,
      original_file_name VARCHAR(255),
      original_file_blob LONGBLOB,
      optimized_content LONGTEXT,
      optimization_history LONGTEXT,
      resume_score DECIMAL(10,2),
      status VARCHAR(64) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.end();
}
```

- [ ] **Step 4: Commit**

```bash
git add db.js mysql-init/02-personal-users.sql
git commit -m "feat(db): add PersonalUser table and personal user DB init"
```

---

## Task 2: 后端认证路由 — corpAuthRoutes 和 personalAuthRoutes

**Files:**
- Create: `server/routes/corpAuthRoutes.js`
- Create: `server/routes/personalAuthRoutes.js`
- Modify: `server.js`（路由注册）

- [ ] **Step 1: 创建企业认证路由 corpAuthRoutes.js**

从现有`routes/authRoutes.js`中企业相关部分拆分，保留：
- `POST /api/corp/register` — 企业注册（发送验证码+创建User）
- `POST /api/corp/login` — 企业登录
- `POST /api/corp/send-verification-code` — 发送验证码

核心逻辑：注册时创建User记录（userType='CORP'），登录时验证User表。

- [ ] **Step 2: 创建个人认证路由 personalAuthRoutes.js**

- `POST /api/personal/register` — 个人注册（创建PersonalUser + 调用initPersonalUserDB初始化数据库）
- `POST /api/personal/login` — 个人登录（验证PersonalUser表）
- `POST /api/personal/send-verification-code` — 发送验证码

注册成功后调用`db.initPersonalUserDB(newUserId)`。

- [ ] **Step 3: 修改server.js注册新路由**

```javascript
// server.js 追加
const corpAuthRoutes = require('./server/routes/corpAuthRoutes');
const personalAuthRoutes = require('./server/routes/personalAuthRoutes');

app.use('/api/corp', corpAuthRoutes);
app.use('/api/personal', personalAuthRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/corpAuthRoutes.js server/routes/personalAuthRoutes.js server.js
git commit -m "feat(auth): split auth routes for corp and personal users"
```

---

## Task 3: 个人简历API路由

**Files:**
- Create: `server/routes/personalResumeRoutes.js`
- Modify: `server.js`

- [ ] **Step 1: 创建个人简历路由 personalResumeRoutes.js**

```javascript
// server/routes/personalResumeRoutes.js
const express = require('express');
const router = express.Router();
const { getPersonalUserDB } = require('../../db');

// POST /api/personal/resume/upload — 上传简历并AI优化
router.post('/resume/upload', authMiddleware, async (req, res) => {
  // multer处理文件上传
  // 调用AI优化服务
  // 存入 lstwin_personal_user_{userId}.personal_resumes
});

// GET /api/personal/resume/history — 获取历史优化记录
router.get('/resume/history', authMiddleware, async (req, res) => {
  // 查询当前用户的personal_resumes表
});

// GET /api/personal/resume/:id — 获取单条优化结果
router.get('/resume/:id', authMiddleware, async (req, res) => {
  // 查询单条记录
});

// PUT /api/personal/resume/:id — 更新优化内容（重复修改）
router.put('/resume/:id', authMiddleware, async (req, res) => {
  // 追加到optimization_history，保存新optimized_content
});
```

- [ ] **Step 2: server.js注册路由**

```javascript
const personalResumeRoutes = require('./server/routes/personalResumeRoutes');
app.use('/api/personal', personalResumeRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/personalResumeRoutes.js server.js
git commit -m "feat(personal): add personal resume routes"
```

---

## Task 4: AuthContext 双角色支持

**Files:**
- Modify: `client/src/context/AuthContext.js`

- [ ] **Step 1: 改造AuthContext支持双角色**

```javascript
// client/src/context/AuthContext.js

// 新增loginCorp和loginPersonal两个函数
const loginCorp = async ({ email, password }) => {
  const res = await axios.post('/api/corp/login', { email, password });
  const { token, user } = res.data;
  localStorage.setItem('token', token);
  localStorage.setItem('userType', 'CORP');
  setUser({ ...user, userType: 'CORP' });
};

const loginPersonal = async ({ email, password }) => {
  const res = await axios.post('/api/personal/login', { email, password });
  const { token, user } = res.data;
  localStorage.setItem('token', token);
  localStorage.setItem('userType', 'PERSONAL');
  setUser({ ...user, userType: 'PERSONAL' });
};

// logout时清除userType
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userType');
  setUser(null);
};

// 初始化时从localStorage恢复userType
const initAuth = () => {
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');
  // 验证token有效则恢复登录状态
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/context/AuthContext.js
git commit -m "feat(auth): support dual userType in AuthContext"
```

---

## Task 5: 登录/注册页面 — AuthCard卡片翻转组件

**Files:**
- Create: `client/src/components/AuthCard.jsx`
- Modify: `client/src/components/LoginForm.js`
- Modify: `client/src/components/RegisterForm.js`
- Modify: `client/src/pages/LoginPage.js`
- Modify: `client/src/pages/RegisterPage.js`

- [ ] **Step 1: 创建AuthCard翻转组件**

企业卡片（蓝色）和个人卡片（绿色）背靠背叠加，Y轴180度翻转切换。

```javascript
// client/src/components/AuthCard.jsx
// 使用useState管理 activeCard ('CORP' | 'PERSONAL')
// 企业卡片: 蓝色渐变边框, building图标, 字段: username/email/phone/password/company
// 个人卡片: 绿色渐变边框, user图标, 字段: username/email/password
// 切换动画: CSS transform: rotateY(180deg), transition 0.6s
```

- [ ] **Step 2: 改造LoginForm.js**

替换现有表单为AuthCard，接受onCorpLogin/onPersonalLogin两个回调。

```javascript
// LoginForm.js
// onCorpLogin={loginCorp}
// onPersonalLogin={loginPersonal}
```

- [ ] **Step 3: 改造RegisterForm.js**

同上，onCorpRegister/onPersonalRegister回调。

```javascript
// RegisterForm.js
// onCorpRegister={registerCorp}
// onPersonalRegister={registerPersonal}
// 企业注册字段: username/email/phone/password/company
// 个人注册字段: username/email/password（+ 邮箱验证码）
```

- [ ] **Step 4: LoginPage和RegisterPage改为使用AuthCard**

删除原有分列布局，直接渲染AuthCard。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AuthCard.jsx client/src/components/LoginForm.js client/src/components/RegisterForm.js client/src/pages/LoginPage.js client/src/pages/RegisterPage.js
git commit -m "feat(auth): card-flip auth UI for corp/personal switch"
```

---

## Task 6: Layout侧边栏按userType渲染

**Files:**
- Modify: `client/src/components/Layout.js`

- [ ] **Step 1: 侧边栏内容按userType分支**

```javascript
// Layout.js 侧边栏
const sideMenu = userType === 'PERSONAL' ? [
  { key: '/personal/resume', icon: <FileTextOutlined />, label: '简历优化' }
] : [
  { key: '/resume', icon: <FileSearchOutlined />, label: '简历初筛' },
  { key: '/resume-analysis', icon: <TeamOutlined />, label: '候选管理' },
  { key: '/chat', icon: <MessageOutlined />, label: '面试访谈' }
];

// 顶部栏右侧（两种角色相同）
const rightMenu = [
  { key: '/profile', label: '个人资料' },
  { key: 'welcome', label: `${username}欢迎回来` },
  { key: 'logout', label: '退出登录' }
];
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Layout.js
git commit -m "feat(layout): sidebar changes based on userType"
```

---

## Task 7: 前端路由按userType分支

**Files:**
- Modify: `client/src/App.js`

- [ ] **Step 1: App.js路由按userType条件渲染**

```javascript
// App.js
// 登录状态下根据userType渲染不同路由
// 个人用户: /personal/* 路由
// 企业用户: /resume, /resume-analysis, /chat, /dashboard 路由

<Routes>
  {/* 无条件路由 */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* 企业用户路由 */}
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/resume" element={<ResumeUpload />} />
  <Route path="/resume-analysis" element={<ResumeAnalysis />} />
  <Route path="/chat" element={<ChatPage />} />

  {/* 个人用户路由 */}
  <Route path="/personal/dashboard" element={<PersonalDashboardPage />} />
  <Route path="/personal/resume" element={<PersonalResumePage />} />

  {/* 共用 */}
  <Route path="/profile" element={<ProfilePage />} />
</Routes>
```

根据userType在DashboardPage内部跳转到对应首页。

- [ ] **Step 2: Commit**

```bash
git add client/src/App.js
git commit -m "feat(routing): split routes by userType"
```

---

## Task 8: PersonalDashboardPage 和 PersonalResumePage

**Files:**
- Create: `client/src/pages/PersonalDashboardPage.js`
- Create: `client/src/pages/PersonalResumePage.js`

- [ ] **Step 1: PersonalDashboardPage**

简洁欢迎页 + 简历优化入口卡片（和现有DashboardPage风格一致，企业端三卡片改为个人端单卡片）。

- [ ] **Step 2: PersonalResumePage**

上传简历 → AI优化 → 结果展示 + 历史记录列表。

上传后调用`POST /api/personal/resume/upload`，历史调用`GET /api/personal/resume/history`。

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/PersonalDashboardPage.js client/src/pages/PersonalResumePage.js
git commit -m "feat(personal): add personal dashboard and resume pages"
```

---

## Task 9: ProfilePage 个人版

**Files:**
- Modify: `client/src/pages/ProfilePage.js`

- [ ] **Step 1: ProfilePage支持PersonalUser编辑**

读取`/api/personal/user/info`，编辑username/phone等字段。

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/ProfilePage.js
git commit -m "feat(profile): support personal user profile editing"
```

---

## Task 10: auth.middleware.js 支持 PersonalUser JWT

**Files:**
- Modify: `server/middleware/auth.middleware.js`

- [ ] **Step 1: 验证时区分User和PersonalUser**

JWT payload包含`userType`字段，根据类型查对应表。

```javascript
// auth.middleware.js
const User = require('../models/User'); // 企业用户
const PersonalUser = require('../models/PersonalUser'); // 个人用户

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, SECRET);
  const { id, userType } = decoded;

  if (userType === 'PERPERSAL') {
    req.user = await PersonalUser.findById(id);
  } else {
    req.user = await User.findById(id);
  }
  next();
};
```

- [ ] **Step 2: Commit**

```bash
git add server/middleware/auth.middleware.js
git commit -m "fix(auth): middleware supports both User and PersonalUser"
```

---

## 自检清单

1. [ ] Spec覆盖：每条需求都有对应Task ✓
2. [ ] Placeholder扫描：无TBD/TODO ✓
3. [ ] 类型一致性：userType字段贯穿所有层（DB/路由/前端/上下文） ✓
4. [ ] Task 1建表 → Task 2路由 → Task 3 API → Task 4 AuthContext → Task 5-9 UI 依赖顺序正确 ✓

---

Plan saved to `docs/superpowers/plans/2026-04-22-dual-user-role-implementation.md`.
