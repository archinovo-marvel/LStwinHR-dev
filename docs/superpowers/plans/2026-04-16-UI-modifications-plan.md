# UI 前端修改实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修改网站UI前端内容，包括侧边栏、顶部导航、主页功能卡和个人资料页面

**Architecture:** 修改三个React组件文件：Layout.js（侧边栏和顶部下拉菜单）、HomePage.js（主页功能卡）、ProfilePage.js（个人资料页面）。所有修改仅涉及UI，不影响核心功能。

**Tech Stack:** React, Ant Design, styled-components, React Router

---

### Task 1: 修改侧边栏菜单 (Layout.js)

**Files:**
- Modify: `client/src/components/Layout.js:460-486` (menuItems数组定义)

- [ ] **Step 1: 修改menuItems数组**

```javascript
// 修改前
const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/chat',
    icon: <MessageOutlined />,
    label: '智能对话',
  },
  {
    key: '/resume',
    icon: <UploadOutlined />,
    label: '简历初筛',
  },
  {
    key: '/resume-analysis',
    icon: <RobotOutlined />,
    label: '候选管理',
  },
  {
    key: '/profile',
    icon: <UserOutlined />,
    label: '个人资料',
  },
];

// 修改后
const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/resume',
    icon: <UploadOutlined />,
    label: '简历初筛',
  },
  {
    key: '/chat',
    icon: <MessageOutlined />,
    label: '面试访谈',
  },
];
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/components/Layout.js
git commit -m "feat: 修改侧边栏菜单 - 删除候选管理和个人资料，智能对话改为面试访谈"
```

---

### Task 2: 修改顶部下拉菜单图标导入 (Layout.js)

**Files:**
- Modify: `client/src/components/Layout.js:1-15` (图标导入部分)

- [ ] **Step 1: 添加FileTextOutlined图标导入**

```javascript
// 修改前
import {
  HomeOutlined,
  MessageOutlined,
  UploadOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  LoginOutlined,
  DownOutlined
} from '@ant-design/icons';

// 修改后
import {
  HomeOutlined,
  MessageOutlined,
  UploadOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  LoginOutlined,
  DownOutlined,
  FileTextOutlined
} from '@ant-design/icons';
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/components/Layout.js
git commit -m "feat: 添加FileTextOutlined图标导入"
```

---

### Task 3: 修改顶部下拉菜单处理函数 (Layout.js)

**Files:**
- Modify: `client/src/components/Layout.js:518-522` (handleSettings函数)

- [ ] **Step 1: 修改处理函数**

```javascript
// 修改前
const handleSettings = () => {
  setMenuOpen(false);
  navigate('/profile');
};

// 修改后
const handleCandidateManagement = () => {
  setMenuOpen(false);
  navigate('/resume-analysis');
};
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/components/Layout.js
git commit -m "feat: 修改顶部下拉菜单处理函数 - 设置改为候选管理"
```

---

### Task 4: 修改顶部下拉菜单项 (Layout.js)

**Files:**
- Modify: `client/src/components/Layout.js:628-631` (菜单项渲染)

- [ ] **Step 1: 修改菜单项**

```javascript
// 修改前
<MenuItem onClick={handleSettings}>
  <SettingOutlined />
  <span>设置</span>
</MenuItem>

// 修改后
<MenuItem onClick={handleCandidateManagement}>
  <FileTextOutlined />
  <span>候选管理</span>
</MenuItem>
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/components/Layout.js
git commit -m "feat: 修改顶部下拉菜单项 - 设置按钮改为候选管理"
```

---

### Task 5: 修改主页核心功能卡 (HomePage.js)

**Files:**
- Modify: `client/src/pages/HomePage.js:436-465` (features数组定义)

- [ ] **Step 1: 修改features数组**

```javascript
// 修改前
const features = [
  {
    icon: <MessageOutlined />,
    title: '智能对话',
    description: '支持语音和文字交互，提供专业的HR咨询服务，快速解答招聘相关问题',
    color: 'blue',
    route: '/chat'
  },
  {
    icon: <FileTextOutlined />,
    title: '简历初筛',
    description: '从愿不愿、能不能、合不合三个维度深度分析候选人，生成专业报告',
    color: 'green',
    route: '/resume'
  },
  {
    icon: <TeamOutlined />,
    title: '候选管理',
    description: '查看和管理所有候选人信息，跟踪面试进度，高效管理招聘流程',
    color: 'orange',
    route: '/resume-analysis'
  },
  {
    icon: <RobotOutlined />,
    title: '面试访谈',
    description: '模拟真实面试场景，AI智能提问与评估，提供专业面试报告',
    color: 'purple',
    route: '/chat'
  }
];

// 修改后
const features = [
  {
    icon: <FileTextOutlined />,
    title: '简历初筛',
    description: '从愿不愿、能不能、合不合三个维度深度分析候选人，生成专业报告',
    color: 'green',
    route: '/resume'
  },
  {
    icon: <TeamOutlined />,
    title: '候选管理',
    description: '查看和管理所有候选人信息，跟踪面试进度，高效管理招聘流程',
    color: 'orange',
    route: '/resume-analysis'
  },
  {
    icon: <RobotOutlined />,
    title: '面试访谈',
    description: '模拟真实面试场景，AI智能提问与评估，提供专业面试报告',
    color: 'purple',
    route: '/chat'
  }
];
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/pages/HomePage.js
git commit -m "feat: 修改主页核心功能卡 - 删除智能对话，排序为简历初筛、候选管理、面试访谈"
```

---

### Task 6: 修改个人资料页面按钮间距 (ProfilePage.js)

**Files:**
- Modify: `client/src/pages/ProfilePage.js:215` (DangerButton的margin-top样式)

- [ ] **Step 1: 移除注销账户按钮的额外margin-top**

```javascript
// 修改前
const DangerButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid ${colors.danger};
  color: ${colors.danger};
  background: ${colors.cardBg};
  margin-top: 12px;  // 删除这一行

  &:hover {
    border-color: ${colors.danger};
    color: ${colors.danger};
    background: #FEF2F2;
  }
`;

// 修改后
const DangerButton = styled(Button)`
  height: 40px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid ${colors.danger};
  color: ${colors.danger};
  background: ${colors.cardBg};

  &:hover {
    border-color: ${colors.danger};
    color: ${colors.danger};
    background: #FEF2F2;
  }
`;
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/pages/ProfilePage.js
git commit -m "feat: 调整个人资料页面按钮间距 - 移除注销账户按钮的额外margin-top"
```

---

### Task 7: 删除个人资料页面安全设置模块 (ProfilePage.js)

**Files:**
- Modify: `client/src/pages/ProfilePage.js:1137-1160` (安全设置模块)

- [ ] **Step 1: 删除安全设置InfoCard组件**

```javascript
// 删除以下整个组件代码块：
<InfoCard title="安全设置">
  <SecurityItem>
    <div className="security-left">
      <div className="security-title">登录密码</div>
      <div className="security-desc">定期更换密码可以提高账号安全性</div>
    </div>
    <div className="security-right">
      <Button type="link" onClick={handleChangePassword}>
        修改
      </Button>
    </div>
  </SecurityItem>
  <SecurityItem>
    <div className="security-left">
      <div className="security-title">两步验证</div>
      <div className="security-desc">未开启</div>
    </div>
    <div className="security-right">
      <Button type="link">
        设置
      </Button>
    </div>
  </SecurityItem>
</InfoCard>
```

- [ ] **Step 2: 验证文件语法**

运行: `cd client && npm run build`
预期: 构建成功无错误

- [ ] **Step 3: 提交修改**

```bash
git add client/src/pages/ProfilePage.js
git commit -m "feat: 删除个人资料页面安全设置模块"
```

---

### Task 8: 验证完整功能

**Files:**
- Test: 所有修改的组件

- [ ] **Step 1: 运行完整构建**

运行: `cd client && npm run build`
预期: 构建成功，无任何错误或警告

- [ ] **Step 2: 启动开发服务器验证**

运行: `cd client && npm start`
预期: 应用正常启动，浏览器中可访问

- [ ] **Step 3: 功能验证清单**
   1. 侧边栏显示三个菜单项: 首页、简历初筛、面试访谈
   2. 顶部下拉菜单显示: 个人资料、候选管理、退出登录
   3. 主页核心功能显示三个卡片: 简历初筛、候选管理、面试访谈
   4. 所有链接和路由正常工作
   5. 个人资料页面按钮间距均匀
   6. 个人资料页面无安全设置模块

- [ ] **Step 4: 提交最终验证**

```bash
git status
git diff --stat
```
预期: 显示所有已修改文件，无未提交更改