# 双角色用户体系设计 — 企业端与个人端

## 1. 背景与目标

现有招聘平台仅服务企业端（简历初筛/候选管理/面试访谈）。新增个人用户角色，提供独立的简历优化服务。两套体系共用同一代码库，通过`userType`（`CORP`/`PERSONAL`）路由到不同数据库和Dashboard，数据物理隔离。

## 2. 数据库设计

### 2.1 用户表

**现有`User`表改造：** 新增`userType`字段（默认`CORP`），企业用户走这张表。

**新建`PersonalUser`表：**
```sql
CREATE TABLE luanshu-authhub.PersonalUser (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(30),
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'PERSONAL_USER',
  systemCode VARCHAR(50) DEFAULT 'zplx',
  memberLevel VARCHAR(50) DEFAULT '普通会员',
  userType ENUM('CORP', 'PERSONAL') DEFAULT 'PERSONAL',
  createdAt DATETIME,
  updatedAt DATETIME
);
```

### 2.2 企业用户数据库
`lstwin_candidates_user_{userId}` — 现有结构不变（candidates/positions/interview_sessions三张表）。

### 2.3 个人用户数据库
`lstwin_personal_user_{userId}` — 每用户独立数据库：
```sql
CREATE TABLE personal_resumes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_user_id BIGINT,
  original_file_blob LONGBLOB,
  optimized_content LONGTEXT,
  optimization_history LONGTEXT,
  resume_score DECIMAL(10,2),
  status VARCHAR(64),
  created_at DATETIME,
  updated_at DATETIME
);
```

## 3. 登录/注册页面

### 3.1 卡片叠加切换

- **企业卡片（蓝色调）：** 公司图标，字段（用户名/邮箱/手机/密码/公司名）
- **个人卡片（绿色调）：** 人像图标，字段（用户名/邮箱/密码）
- 背靠背叠加，点击Tab触发Y轴180度翻转切换
- 共享邮箱验证码注册流程

### 3.2 AuthContext

```javascript
loginCorp({ email, password })    → POST /api/corp/login
loginPersonal({ email, password }) → POST /api/personal/login
registerCorp({ ...fields })      → POST /api/corp/register
registerPersonal({ ...fields })  → POST /api/personal/register

// user对象统一结构
{ id, username, email, userType: 'CORP'|'PERSONAL', memberLevel }
```

## 4. 侧边栏+顶部栏

### 4.1 企业端侧边栏
- 左侧：Logo（招聘灵犀）
- 主体：简历初筛 `/resume` | 候选管理 `/resume-analysis` | 面试访谈 `/chat`

### 4.2 个人端侧边栏
- 左侧：Logo（招聘灵犀）
- 主体：简历优化 `/personal/resume`

### 4.3 顶部栏（企业/个人共用右侧）
个人资料 `/profile` | "XXX欢迎回来" | 退出登录

## 5. 路由设计

```
企业端：
/dashboard           → 企业版Dashboard（简历初筛/候选管理/面试访谈三个入口卡片）
/resume              → ResumeUpload（简历初筛）
/resume-analysis     → ResumeAnalysis（候选管理）
/chat                → ChatPage（面试访谈）
/profile             → ProfilePage

个人端：
/personal/dashboard   → 个人版Dashboard（简历优化入口卡片）
/personal/resume      → 个人简历优化页（上传+AI优化+历史记录）
/personal/profile     → PersonalProfilePage
```

## 6. API设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/corp/login | 企业登录 |
| POST | /api/corp/register | 企业注册（含验证码） |
| POST | /api/personal/login | 个人登录 |
| POST | /api/personal/register | 个人注册（含验证码） |
| POST | /api/personal/resume/upload | 个人简历上传+AI优化 |
| GET | /api/personal/resume/history | 历史优化记录 |
| GET | /api/personal/resume/:id | 获取单条优化结果 |

## 7. 实现步骤概要

1. 新建`PersonalUser`表 + 个人用户数据库初始化脚本
2. 新增`/api/personal/*`路由（login/register/resume）
3. AuthContext改造成支持双角色切换
4. LoginPage/RegisterPage改造成卡片翻转切换
5. 企业端侧边栏不变，个人端侧边栏独立
6. 新建`PersonalDashboardPage` + `PersonalResumePage`
7. 顶部栏根据userType渲染对应内容

## 8. 关键文件清单

- `client/src/components/Layout.js` — 侧边栏/顶部栏（按userType分支）
- `client/src/components/LoginForm.js` — 登录表单（双角色）
- `client/src/components/RegisterForm.js` — 注册表单（双角色）
- `client/src/context/AuthContext.js` — 双角色认证状态
- `client/src/pages/PersonalDashboardPage.js` — 新建
- `client/src/pages/PersonalResumePage.js` — 新建
- `server/routes/corpAuthRoutes.js` — 新建（企业认证路由）
- `server/routes/personalAuthRoutes.js` — 新建（个人认证路由）
- `server/routes/personalResumeRoutes.js` — 新建（个人简历路由）
- `server/middleware/auth.middleware.js` — 支持双角色JWT验证
- `db.js` — 个人用户数据库连接
- `mysql-init/02-personal-users.sql` — 新建
