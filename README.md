# 🎯 孪数数字人面试软件 (LStwinHR)

<div align="center">

![版本](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/Node.js-18+-green.svg)
![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

**基于 AI 数字人技术的智能招聘管理系统**

集虚拟人技术、智能对话、简历分析、AI 面试评估于一体的现代化招聘解决方案

[功能介绍](#-核心功能) • [快速开始](#-快速开始) • [部署指南](#-部署指南) • [项目结构](#-项目结构) • [配置说明](#-配置说明)

</div>

---

## ✨ 项目简介

孪数数字人面试软件是一款专为招聘场景打造的智能化管理系统，采用先进的 AI 技术和虚拟人技术，为企业提供全新的招聘体验。系统支持 AI 智能面试、简历自动分析评估、虚拟人实时交互等功能，大幅提升招聘效率和质量。

### 🎯 核心价值

| 价值主张 | 说明 |
|---------|------|
| 🚀 **效率提升** | AI 自动化筛选和评估，减少人工审核工作量 |
| 🎨 **体验升级** | 虚拟人技术提供更真实、更友好的面试体验 |
| 📊 **数据驱动** | 多维度数据分析，助力科学招聘决策 |
| 🔒 **安全可靠** | 完善的身份验证和数据加密，保护隐私安全 |

---

## 🎯 核心功能

### 🤖 AI 智能对话系统

- 基于 Ollama 和本地 LLM 模型的双引擎支持
- 智能 HR 助手，解答招聘相关问题
- 支持多种场景的智能问答

### 📄 简历智能分析

- **多格式支持**：PDF、Word、图片（JPG/PNG）等
- **三维评估**：基本信息、工作经历、技能评估
- **自动评分**：基于 MBTI 性格测试和简历内容的综合评分
- **文件优化**：自动压缩图片简历，提升处理速度

### 🎭 AI 虚拟面试

- **虚拟人形象**：基于 Three.js 的 3D 虚拟面试官
- **实时交互**：流畅的面部表情和动作同步
- **智能提问**：根据候选人背景自动调整面试问题
- **多模型支持**：Ollama / 本地 LLM 灵活切换

### 👥 候选人管理

- 候选人信息录入和管理
- 简历上传和解析
- 面试状态跟踪
- 多维度数据分析

### 📈 工作流程管理

- 完整的招聘流程覆盖
- 面试安排和提醒
- 评估报告生成
- 数据可视化分析

---

## 🏗️ 技术架构

### 技术栈概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  UI 组件     │  状态管理   │  3D 渲染   │  实时通信         │
│  Ant Design  │  Context   │  Three.js │  Socket.io       │
├─────────────────────────────────────────────────────────────┤
│                        后端 (Node.js + Express)              │
├─────────────────────────────────────────────────────────────┤
│  REST API    │  认证授权   │  文件处理  │  AI 模型集成     │
│  JWT Token   │  Multer    │  Ollama   │  本地 LLM        │
├─────────────────────────────────────────────────────────────┤
│                        数据层 (MySQL)                        │
├─────────────────────────────────────────────────────────────┤
│  用户数据     │  候选人数据  │  面试记录  │  系统配置        │
└─────────────────────────────────────────────────────────────┘
```

### 前端技术栈

| 技术 | 用途 | 版本 |
|-----|------|------|
| React | 用户界面框架 | 18.2.0 |
| Ant Design | UI 组件库 | 5.2.2 |
| React Router | 页面路由 | 6.8.1 |
| Three.js | 3D 虚拟人渲染 | 0.182.0 |
| React Three Fiber | React 3D 集成 | 8.15.19 |
| Framer Motion | 动画效果 | 10.0.1 |
| Chart.js | 数据可视化 | 4.2.1 |
| Socket.io-client | 实时通信 | 4.6.1 |
| Axios | HTTP 请求 | 1.3.4 |

### 后端技术栈

| 技术 | 用途 | 版本 |
|-----|------|------|
| Node.js | 运行时环境 | - |
| Express | Web 框架 | 4.21.2 |
| MySQL | 数据库 | 3.20.0 |
| JWT | 身份认证 | 9.0.3 |
| Multer | 文件上传 | 1.4.5 |
| Jimp | 图片处理 | 1.6.0 |
| pdf-parse | PDF 解析 | 1.1.1 |
| mammoth | Word 解析 | 1.12.0 |
| Nodemailer | 邮件服务 | 7.0.12 |
| bcryptjs | 密码加密 | 2.4.3 |

### AI 模型支持

| 模型类型 | 配置项 | 说明 |
|---------|-------|------|
| Ollama | `OLLAMA_BASE_URL` | 远程 Ollama 服务 |
| 本地 LLM | `LOCAL_LLM_URL` | 本地 Qwen2-7B 模型 |
| 视觉模型 | `LOCAL_LLM_VL_URL` | 本地 Qwen3-VL-8B 模型 |

---

## 📁 项目结构

```
LStwinHR-dev_v0.0.3/
│
├── client/                          # 🎨 React 前端项目
│   ├── public/                      # 静态资源
│   │   ├── index.html               # HTML 入口
│   │   ├── logo.png                 # 系统 Logo
│   │   └── manifest.json             # PWA 配置
│   ├── src/                         # 源代码目录
│   │   ├── components/              # 📦 公共组件
│   │   │   ├── AuthLayout.js         # 认证布局
│   │   │   ├── CandidateDetailModal.js  # 候选人详情弹窗
│   │   │   ├── CandidateSelector.js  # 候选人选择器
│   │   │   ├── Layout.js             # 主布局
│   │   │   ├── LoginForm.js          # 登录表单
│   │   │   ├── LoginPromptModal.js   # 登录提示弹窗
│   │   │   ├── RegisterForm.js       # 注册表单
│   │   │   └── VirtualHumanSDK.js    # 虚拟人 SDK 组件
│   │   ├── config/                   # ⚙️ 配置文件
│   │   │   └── virtualHumanConfig.js # 虚拟人配置
│   │   ├── context/                  # 🔄 React Context
│   │   │   └── AuthContext.js       # 认证上下文
│   │   ├── pages/                    # 📄 页面组件
│   │   │   ├── AdminDashboard.js     # 管理后台
│   │   │   ├── AvatarGenerator.js    # 头像生成
│   │   │   ├── CandidateForm.js      # 候选人表单
│   │   │   ├── ChatPage.js           # AI 聊天页面
│   │   │   ├── HomePage.js           # 首页
│   │   │   ├── InterviewPage.js      # 面试页面
│   │   │   ├── LoginPage.js          # 登录页
│   │   │   ├── ProfilePage.js        # 个人资料页
│   │   │   ├── RegisterPage.js       # 注册页
│   │   │   ├── ResumeAnalysis.js     # 简历分析页
│   │   │   ├── ResumeUpload.js       # 简历上传页
│   │   │   └── WorkflowPage.js       # 工作流页
│   │   ├── sdk/                      # 🧩 SDK 集成
│   │   │   └── 3.2.1.1016/           # 虚拟人 SDK 版本
│   │   ├── utils/                    # 🛠️ 工具函数
│   │   │   ├── auth.js               # 认证工具
│   │   │   ├── candidateDB.js        # 候选人数据库
│   │   │   ├── dataSync.js           # 数据同步
│   │   │   ├── interviewScoring.js   # 面试评分
│   │   │   ├── interviewStorage.js   # 面试存储
│   │   │   ├── logFilter.js          # 日志过滤
│   │   │   ├── networkDiagnostics.js # 网络诊断
│   │   │   ├── playerManager.js      # 播放器管理
│   │   │   ├── realTimeSync.js       # 实时同步
│   │   │   ├── resumeAnalyzer.js     # 简历分析
│   │   │   ├── serverDataSync.js     # 服务器数据同步
│   │   │   └── websocketManager.js   # WebSocket 管理
│   │   ├── App.css                   # 全局样式
│   │   ├── App.js                    # 应用入口
│   │   ├── index.js                  # 渲染入口
│   │   ├── setupProxy.js             # 开发代理配置
│   │   └── styled-components-config.js  # 样式配置
│   ├── package.json                  # 前端依赖
│   └── Dockerfile                    # 前端容器配置
│
├── local_llm_service/               # 💻 本地 LLM 服务
│   ├── app.py                        # Python 应用
│   ├── start_llama_cpp_qwen2_gguf.ps1  # Qwen2 启动脚本
│   ├── start_llama_cpp_qwen2vl_gguf.ps1 # Qwen2VL 启动脚本
│   └── *.log                         # 日志文件
│
├── mysql-init/                      # 🗄️ MySQL 初始化
│   └── 01-init.sql                   # 初始化脚本
│
├── routes/                           # 🛤️ 路由定义
│   ├── authRoutes.js                 # 认证路由
│   ├── candidateRoutes.js            # 候选人路由
│   └── interviewSessionRoutes.js     # 面试会话路由
│
├── services/                         # 🔧 业务服务
│   ├── candidateStore.js             # 候选人存储服务
│   └── resume/                       # 简历分析服务
│       ├── analysisConfig.js         # 分析配置
│       ├── compositeScoreService.js  # 综合评分服务
│       ├── extractorService.js       # 信息提取服务
│       ├── index.js                  # 服务入口
│       ├── matcherService.js         # 匹配服务
│       ├── parserService.js          # 解析服务
│       ├── positionConfig.js         # 岗位配置
│       ├── preprocessService.js      # 预处理服务
│       ├── reportService.js          # 报告服务
│       ├── resumeAnalysisService.js  # 简历分析主服务
│       ├── riskService.js            # 风险评估服务
│       └── scoringService.js         # 评分服务
│
├── uploads/                          # 📤 文件上传目录
│   └── resumes/                      # 简历文件存储
│
├── utils/                            # 🛠️ 工具函数
│   └── registerHandler.js           # 注册处理器
│
├── .env                              # 环境变量配置
├── .gitignore                        # Git 忽略配置
├── docker-compose.yml                # Docker Compose 编排
├── Dockerfile                        # 后端容器配置
├── nginx.conf                        # Nginx 配置
├── nodemon.json                      # Nodemon 配置
├── package.json                      # 后端依赖
├── server.js                         # 后端主入口
└── README.md                         # 项目文档
```

---

## 🚀 快速开始

### 环境要求

| 要求 | 最低版本 | 推荐版本 |
|-----|--------|---------|
| Node.js | 16.x | 18.x+ |
| npm | 8.x | 9.x+ |
| Docker | 20.x | 24.x+ |
| Docker Compose | 2.x | 最新版 |
| MySQL | 8.0 | 8.0+ |
| Ollama | 0.1.x | 最新版 |

### 📦 Docker 部署（推荐）

#### 1. 克隆项目

```bash
git clone <repository-url>
cd LStwinHR-dev_v0.0.3
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
nano .env
```

**主要配置项说明：**

```env
# 数据库配置
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lstwinhr

# JWT 密钥
JWT_SECRET=your_jwt_secret_here

# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b

# 本地 LLM 配置
LOCAL_LLM_ENABLED=true
LOCAL_LLM_URL=http://host.docker.internal:8002
LOCAL_LLM_MODEL=qwen2-7b-gguf
LOCAL_LLM_VL_URL=http://host.docker.internal:8003
LOCAL_LLM_VL_MODEL=qwen3-vl-8b-gguf

# 邮件服务配置
EMAIL_HOST=smtp.exmail.qq.com
EMAIL_PORT=465
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password

# 虚拟人配置
REACT_APP_VIRTUAL_HUMAN_ENABLED=true
```

#### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看实时日志
docker-compose logs -f
```

#### 4. 访问应用

| 服务 | 地址 | 说明 |
|-----|------|------|
| 前端应用 | http://localhost:3000 | React 开发服务器 |
| 后端 API | http://localhost:3001 | Express API 服务 |
| Nginx | http://localhost:80 | 生产环境反向代理 |
| Ollama | http://localhost:11434 | AI 模型服务 |

### 💻 本地开发部署

#### 前置条件

1. 安装 Node.js 18+
2. 安装 MySQL 8.0+
3. 安装 Ollama（可选）

#### 后端启动

```bash
# 进入项目根目录
cd LStwinHR-dev_v0.0.3

# 安装后端依赖
npm install

# 启动后端开发服务器（支持热更新）
npm run dev
```

#### 前端启动

```bash
# 进入前端目录
cd client

# 安装前端依赖
npm install

# 启动前端开发服务器
npm start
```

---

## 🔧 部署指南

### Docker Compose 服务说明

| 服务名 | 镜像 | 端口 | 说明 |
|-------|-----|------|------|
| `ai-hr-frontend` | React App | 3000 | 前端应用 |
| `ai-hr-backend` | Node.js | 3001 | 后端 API |
| `mysql` | MySQL 8.0 | 3306 | 数据库 |
| `nginx` | Nginx | 80, 443 | 反向代理 |
| `ollama` | Ollama | 11434 | AI 模型服务 |

### 📁 目录挂载说明

```yaml
volumes:
  # 前端代码挂载（支持热更新）
  - ./client:/app
    # 后端代码挂载（支持热更新）
  - ./server.js:/app/server.js
  # MySQL 数据持久化
  - mysql_data:/var/lib/mysql
  # 简历文件存储
  - ./uploads:/app/uploads
```

### 🔐 安全配置

#### 生产环境建议

1. **修改默认密码**：更改 `DB_PASSWORD`、`JWT_SECRET`、`EMAIL_PASSWORD`
2. **启用 HTTPS**：配置 SSL 证书
3. **限制端口访问**：使用防火墙规则
4. **启用日志审计**：配置日志收集和分析

---

## ⚙️ 配置说明

### 环境变量详解

#### 数据库配置

| 变量名 | 说明 | 默认值 |
|-------|------|-------|
| `DB_HOST` | 数据库主机地址 | localhost |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户名 | root |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | lstwinhr |

#### AI 模型配置

| 变量名 | 说明 | 可选值 |
|-------|------|-------|
| `OLLAMA_BASE_URL` | Ollama 服务地址 | http://localhost:11434 |
| `OLLAMA_MODEL` | Ollama 模型名称 | qwen3:8b, deepseek-r1:14b |
| `LOCAL_LLM_ENABLED` | 是否启用本地模型 | true, false |
| `LOCAL_LLM_URL` | 本地 LLM 服务地址 | http://localhost:8002 |
| `LOCAL_LLM_MODEL` | 本地模型名称 | qwen2-7b-gguf |
| `LOCAL_LLM_VL_URL` | 本地视觉模型地址 | http://localhost:8003 |
| `LOCAL_LLM_VL_MODEL` | 本地视觉模型名称 | qwen3-vl-8b-gguf |

#### 邮件服务配置

| 变量名 | 说明 | 示例值 |
|-------|------|-------|
| `EMAIL_HOST` | SMTP 服务器 | smtp.exmail.qq.com |
| `EMAIL_PORT` | SMTP 端口 | 465 |
| `EMAIL_SECURE` | 是否使用 SSL | true, false |
| `EMAIL_USER` | 邮箱用户名 | gaolu@lstwin.top |
| `EMAIL_PASSWORD` | 邮箱密码 | - |
| `EMAIL_FROM_NAME` | 发件人名称 | 孪数AI面试系统 |

#### JWT 配置

| 变量名 | 说明 | 默认值 |
|-------|------|-------|
| `JWT_SECRET` | JWT 加密密钥 | your_jwt_secret_change_this_in_production |
| `JWT_EXPIRES_IN` | Token 过期时间 | 24h |

---

## 📡 API 文档

### 认证接口

| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|-----|
| POST | `/api/login` | 用户登录 | ❌ |
| POST | `/api/register` | 用户注册 | ❌ |
| POST | `/api/send-verification-code` | 发送验证码 | ❌ |
| POST | `/api/reset-password` | 重置密码 | ❌ |
| GET | `/api/user/info` | 获取用户信息 | ✅ |
| PUT | `/api/user/info` | 更新用户信息 | ✅ |
| PUT | `/api/user/password` | 修改密码 | ✅ |

### 候选人接口

| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|-----|
| GET | `/api/candidates` | 获取候选人列表 | ✅ |
| GET | `/api/candidates/:id` | 获取候选人详情 | ✅ |
| POST | `/api/candidates` | 创建候选人 | ✅ |
| PUT | `/api/candidates/:id` | 更新候选人 | ✅ |
| DELETE | `/api/candidates/:id` | 删除候选人 | ✅ |

### 简历分析接口

| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|-----|
| POST | `/api/resume/upload` | 上传简历 | ✅ |
| POST | `/api/resume/analyze` | 分析简历 | ✅ |
| GET | `/api/resume/:id` | 获取分析结果 | ✅ |

### 面试接口

| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|-----|
| GET | `/api/interviews` | 获取面试列表 | ✅ |
| GET | `/api/interviews/:id` | 获取面试详情 | ✅ |
| POST | `/api/interviews/start` | 开始面试 | ✅ |
| POST | `/api/interviews/:id/question` | 获取下一题 | ✅ |
| POST | `/api/interviews/:id/answer` | 提交回答 | ✅ |
| POST | `/api/interviews/:id/end` | 结束面试 | ✅ |

---

## 🔄 热更新说明

### 后端热更新

- 使用 `nodemon` 监控文件变化
- 修改 `.js` 或 `.json` 文件后自动重启服务
- 配置文件修改需要手动重启

```bash
# 查看后端日志
docker-compose logs -f ai-hr-backend
```

### 前端热更新

- React 开发服务器支持 HMR（热模块替换）
- 修改代码后浏览器自动刷新
- CSS 修改即时生效，无需刷新

```bash
# 查看前端日志
docker-compose logs -f ai-hr-frontend
```

### 文件监控范围

| 服务 | 监控目录 | 文件类型 |
|-----|---------|---------|
| 前端 | `/app` | .js, .jsx, .css, .json |
| 后端 | `/app` | .js, .json |

---

## 🔍 故障排除

### 常见问题

#### 1. 端口冲突

如果端口被占用，可以修改 `docker-compose.yml` 中的端口映射：

```yaml
services:
  frontend:
    ports:
      - "3001:3000"  # 修改前一个端口
```

#### 2. 数据库连接失败

```bash
# 检查 MySQL 容器状态
docker-compose ps mysql

# 查看 MySQL 日志
docker-compose logs mysql

# 重新启动 MySQL
docker-compose restart mysql
```

#### 3. AI 模型服务不可用

```bash
# 检查 Ollama 状态
docker-compose ps ollama

# 进入 Ollama 容器拉取模型
docker-compose exec ollama ollama pull qwen3:8b

# 检查本地 LLM 服务
curl http://localhost:8002/health
```

#### 4. 前端构建失败

```bash
# 清理前端缓存
docker-compose exec frontend rm -rf node_modules/.cache

# 重新构建
docker-compose up -d --build frontend
```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql

# 查看最近 100 行日志
docker-compose logs --tail=100 backend
```

---

## 📈 系统监控

### 健康检查端点

| 端点 | 说明 |
|-----|------|
| GET `/api/health` | 后端服务健康状态 |
| GET `/api/health/db` | 数据库连接状态 |
| GET `/api/health/ollama` | Ollama 服务状态 |

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 遵循 ESLint 配置规则
- 使用统一的代码格式化工具
- 编写清晰的注释和文档

---

## 📄 许可证

本项目基于 MIT 许可证开源。详细信息请参阅 [LICENSE](LICENSE) 文件。

---

## 📧 联系方式

- **项目作者**：LuanShuAgent
- **邮箱**：gaolu@lstwin.top
- **项目主页**：https://lstwin.top

---

<div align="center">

**如果这个项目对你有帮助，请给我们一个 ⭐️！**

</div>
