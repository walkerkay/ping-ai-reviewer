# Ping Code Review

基于 NestJS、MongoDB 和 TypeScript 的 AI 代码审查工具，支持 GitLab 和 GitHub 平台的自动化代码审查。

## 功能特性

- 🚀 **多模型支持** - 兼容 DeepSeek、OpenAI、通义千问、智谱AI 和 Ollama
- 📢 **消息即时推送** - 审查结果一键直达钉钉、企业微信或飞书
- 📅 **自动化日报生成** - 基于 GitLab & GitHub Commit 记录，自动整理每日开发进展
- 📊 **数据持久化** - 使用 MongoDB 存储审查记录和统计数据
- 🎭 **多种审查风格** - 专业型、讽刺型、绅士型、幽默型任你选择
- 🔧 **现代化技术栈** - NestJS + MongoDB + TypeScript

## 技术栈

- **后端框架**: NestJS
- **数据库**: MongoDB
- **语言**: TypeScript
- **容器化**: Docker & Docker Compose
- **LLM 支持**: DeepSeek、OpenAI、通义千问、智谱AI、Ollama

## 快速开始

### 使用 Docker Compose（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd ping-codereview
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件，配置必要的参数
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **验证部署**
- 访问 http://localhost:5001 查看服务状态
- 访问 http://localhost:5001/health 查看健康检查

### 本地开发

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件
```

3. **启动 MongoDB**
```bash
# 使用 Docker 启动 MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

4. **启动应用**
```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

## 环境配置

### 必需配置

```bash
# 应用配置
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/ping-codereview

# LLM 配置（至少配置一个）
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key

# Git 平台配置（至少配置一个）
GITLAB_ACCESS_TOKEN=your_gitlab_token
GITHUB_ACCESS_TOKEN=your_github_token
```

### 可选配置

```bash
# 通知配置
DINGTALK_ENABLED=1
DINGTALK_WEBHOOK_URL=your_dingtalk_webhook_url

# 审查配置
SUPPORTED_EXTENSIONS=.java,.py,.php,.yml,.vue,.go,.c,.cpp,.h,.js,.css,.md,.sql
PUSH_REVIEW_ENABLED=0
REPORT_CRONTAB_EXPRESSION=0 18 * * 1-5
```

## Webhook 配置

### GitLab Webhook

1. 在 GitLab 项目中，进入 Settings > Webhooks
2. 添加 Webhook URL: `http://your-server:5001/review/webhook`
3. 选择触发事件：Push Events 和 Merge Request Events
4. 设置 Secret Token（可选）

### GitHub Webhook

1. 在 GitHub 仓库中，进入 Settings > Webhooks
2. 添加 Webhook URL: `http://your-server:5001/review/webhook`
3. 选择事件类型：Pull requests 和 Pushes
4. 设置 Secret（可选）

## API 接口

### 健康检查
```
GET /health
```

### 手动生成日报
```
GET /review/daily_report?startTime=timestamp&endTime=timestamp
```

### Webhook 接收
```
POST /review/webhook
```

## 项目结构

```
src/
├── modules/                 # 功能模块
│   ├── database/           # 数据库模块
│   ├── llm/               # LLM 集成模块
│   ├── notification/      # 通知模块
│   ├── review/            # 代码审查模块
│   ├── report/            # 报告生成模块
│   └── webhook/           # Webhook 处理模块
├── common/                # 公共模块
├── config/                # 配置文件
├── app.module.ts          # 应用根模块
└── main.ts               # 应用入口
```

## 开发指南

### 添加新的 LLM 提供商

1. 在 `src/modules/llm/clients/` 下创建新的客户端类
2. 继承 `BaseLLMClient` 并实现必要的方法
3. 在 `LLMFactory` 中注册新的提供商

### 添加新的通知渠道

1. 在 `src/modules/notification/notifiers/` 下创建新的通知器类
2. 实现 `Notifier` 接口
3. 在 `NotificationModule` 中注册新的通知器

## 部署

### 生产环境部署

1. **使用 Docker Compose**
```bash
docker-compose -f docker-compose.yml up -d
```

2. **使用 Kubernetes**
```bash
# 创建 ConfigMap 和 Secret
kubectl apply -f k8s/

# 部署应用
kubectl apply -f k8s/deployment.yaml
```

### 监控和日志

- 应用日志：通过 Docker logs 查看
- 健康检查：`GET /health`
- 数据库监控：MongoDB 内置监控

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- 原项目：[AI-Codereview-Gitlab](https://github.com/sunmh207/AI-Codereview-Gitlab)
- NestJS 框架
- MongoDB 数据库
- 各种 LLM 提供商

