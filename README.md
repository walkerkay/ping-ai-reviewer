# Ping AI Reviewer

基于 NestJS、MongoDB 和 TypeScript 的 AI 代码审查工具，支持 GitLab 和 GitHub 平台的自动化代码审查。

## 功能特性

- 🚀 **多模型支持** - 兼容 DeepSeek、OpenAI
- 📢 **消息推送** - 支持 PingCode、钉钉、企业微信、飞书
- 📅 **日报生成** - 基于 Commit 记录自动生成开发日报
- 📊 **数据存储** - 使用 MongoDB 存储审查记录
- 🔧 **现代化技术栈** - NestJS + MongoDB + TypeScript

## 快速开始

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件，至少配置 LLM 和 Git 平台
```

3. **启动应用**
```bash
# 开发模式
npm run start:dev
```

## 环境配置

### 必需配置
```bash
# LLM 配置（至少配置一个）
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key

# Git 平台配置（至少配置一个）
GITLAB_ACCESS_TOKEN=your_gitlab_token
GITHUB_ACCESS_TOKEN=your_github_token
```

## Webhook 配置

1. 在 GitLab/GitHub 项目中，进入 Settings > Webhooks
2. 添加 Webhook URL: `http://your-server:5001/review/webhook`
3. 选择触发事件：Push Events 和 Merge Request Events

## API 接口

- `GET /health` - 健康检查
- `GET /review/daily_report` - 手动生成日报
- `POST /review/webhook` - Webhook 接收

## 开发

### 项目结构
```
src/
├── modules/
│   ├── core/               # 核心模块
│   ├── database/           # 数据库
│   ├── git/                # Git 平台
│   ├── integration/        # 通知集成
│   ├── llm/                # LLM 集成
│   ├── review/             # 代码审查
│   ├── report/             # 报告生成
│   └── webhook/            # Webhook 处理
└── main.ts                 # 应用入口
```

### 部署
```bash
# 构建
npm run build

# 生产环境
npm run start:prod

# Vercel 部署
vercel --prod
```

## 许可证

MIT License

