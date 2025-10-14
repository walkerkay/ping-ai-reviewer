# Vercel 部署指南

本项目已配置支持 Vercel 部署。以下是部署步骤和说明。

## 部署步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 构建项目
```bash
npm run build
```

### 3. 本地测试 Vercel
```bash
npm run vercel:dev
```

### 4. 部署到 Vercel

#### 方法一：使用 Vercel CLI
```bash
# 安装 Vercel CLI（如果未安装）
npm install -g vercel

# 登录 Vercel
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

#### 方法二：通过 Vercel Dashboard
1. 将代码推送到 GitHub
2. 在 Vercel Dashboard 中导入项目
3. 配置环境变量
4. 部署

## 环境变量配置

在 Vercel Dashboard 中配置以下环境变量：

- `NODE_ENV=production`
- `MONGODB_URI` - MongoDB 连接字符串
- 其他项目特定的环境变量

## 项目结构

```
├── api/
│   └── index.js          # Vercel API 入口点
├── dist/                 # 构建输出目录
├── vercel.json           # Vercel 配置文件
├── .vercelignore         # Vercel 忽略文件
└── src/                  # 源代码目录
```

## 注意事项

1. **构建输出**：确保 `dist/` 目录包含所有编译后的文件
2. **环境变量**：在 Vercel Dashboard 中正确配置所有必需的环境变量
3. **数据库连接**：确保 MongoDB 连接字符串正确配置
4. **CORS 设置**：已启用 CORS 以支持跨域请求

## 本地开发

```bash
# 正常开发模式
npm run start:dev

# Vercel 本地开发模式
npm run vercel:dev
```

## 故障排除

1. **构建失败**：检查 TypeScript 编译错误
2. **运行时错误**：检查环境变量配置
3. **数据库连接**：确保 MongoDB 连接字符串正确
4. **CORS 问题**：检查 CORS 配置

## 性能优化

1. 使用 Vercel 的 Edge Functions 进行地理分布
2. 配置适当的缓存策略
3. 优化数据库查询
4. 使用 CDN 加速静态资源
