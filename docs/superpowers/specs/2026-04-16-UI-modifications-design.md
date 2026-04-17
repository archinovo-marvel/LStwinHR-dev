---
name: UI 前端修改设计方案
description: 修改网站UI前端内容，包括侧边栏、顶部导航、主页功能卡和个人资料页面
type: project
---

# UI 前端修改设计方案

## 概述
修改网站UI前端界面，优化导航结构和视觉一致性，删除冗余功能入口，调整页面布局。

## 修改内容

### 1. 侧边栏菜单调整
**修改前:**
- 首页 (`/`) - HomeOutlined
- 智能对话 (`/chat`) - MessageOutlined
- 简历初筛 (`/resume`) - UploadOutlined
- 候选管理 (`/resume-analysis`) - RobotOutlined
- 个人资料 (`/profile`) - UserOutlined

**修改后:**
- 首页 (`/`) - HomeOutlined
- 简历初筛 (`/resume`) - UploadOutlined
- 面试访谈 (`/chat`) - MessageOutlined (文本从"智能对话"改为"面试访谈")

**具体修改:**
- 删除候选管理菜单项 (`/resume-analysis`)
- 删除个人资料菜单项 (`/profile`)
- 将智能对话菜单项重命名为面试访谈 (保持相同路由 `/chat`)

**文件:** [Layout.js](client/src/components/Layout.js)
**位置:** `menuItems` 数组定义 (第460-486行)

### 2. 顶部下拉菜单调整
**修改前:**
1. 个人资料 - UserOutlined (路由 `/profile`)
2. 设置 - SettingOutlined (路由 `/profile`)
3. 退出登录 - LogoutOutlined

**修改后:**
1. 个人资料 - UserOutlined (路由 `/profile`)
2. 候选管理 - FileTextOutlined (路由 `/resume-analysis`)
3. 退出登录 - LogoutOutlined

**具体修改:**
- "设置"按钮改为"候选管理"
- 图标从 SettingOutlined 改为 FileTextOutlined
- 点击处理函数从 `handleSettings` 改为 `handleCandidateManagement`
- 路由从 `/profile` 改为 `/resume-analysis`

**文件:** [Layout.js](client/src/components/Layout.js)
**位置:** 第518-522行 (处理函数) 和 第628-631行 (菜单项)

### 3. 主页核心功能卡调整
**修改前功能卡 (4个):**
1. 智能对话 - MessageOutlined (蓝色) - 路由 `/chat`
2. 简历初筛 - FileTextOutlined (绿色) - 路由 `/resume`
3. 候选管理 - TeamOutlined (橙色) - 路由 `/resume-analysis`
4. 面试访谈 - RobotOutlined (紫色) - 路由 `/chat`

**修改后功能卡 (3个):**
1. 简历初筛 - FileTextOutlined (绿色) - 路由 `/resume`
2. 候选管理 - TeamOutlined (橙色) - 路由 `/resume-analysis`
3. 面试访谈 - RobotOutlined (紫色) - 路由 `/chat`

**具体修改:**
- 删除智能对话功能卡
- 保持其余三个功能卡，排序为: 简历初筛、候选管理、面试访谈
- 路由保持不变

**文件:** [HomePage.js](client/src/pages/HomePage.js)
**位置:** `features` 数组定义 (第436-465行)

### 4. 个人资料页面调整
**按钮高度差调整:**
- 移除注销账户按钮的额外 `margin-top: 12px` 样式
- 保持按钮组统一 `gap: 12px` 间距
- 保持三个按钮原有高度 (均为40px)

**安全设置模块删除:**
- 删除整个安全设置 InfoCard 组件
- 删除包含的两个 SecurityItem (登录密码和两步验证)

**文件:** [ProfilePage.js](client/src/pages/ProfilePage.js)
**位置:**
- 按钮样式: 第215行 (DangerButton 的 margin-top)
- 安全设置模块: 第1137-1160行 (InfoCard title="安全设置")

## 技术要求
1. 所有修改仅涉及UI前端，不影响核心功能实现
2. 保持现有路由不变
3. 保持组件结构和样式系统一致性
4. 修改后的导航逻辑应清晰合理

## 验证标准
1. 侧边栏显示三个菜单项: 首页、简历初筛、面试访谈
2. 顶部下拉菜单显示: 个人资料、候选管理、退出登录
3. 主页核心功能显示三个卡片: 简历初筛、候选管理、面试访谈
4. 个人资料页面按钮间距均匀，无安全设置模块
5. 所有链接和路由正常工作

## 注意事项
1. 面试访谈继续使用原有 `/chat` 路由，指向 ChatPage 组件
2. 候选管理路由为 `/resume-analysis`，指向 ResumeAnalysis 组件
3. 需要导入 FileTextOutlined 图标到 Layout.js
4. 确保删除的菜单项不影响其他功能