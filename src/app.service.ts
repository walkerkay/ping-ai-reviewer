import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHome(): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ping AI Reviewer - AI 代码审查工具</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .status-badge {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            margin: 20px 0;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.8rem;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .feature {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        
        .feature h3 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 1.2rem;
        }
        
        .feature p {
            color: #666;
            font-size: 0.95rem;
        }
        
        .api-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .api-endpoint {
            background: white;
            border: 1px solid #e1e5e9;
            border-radius: 6px;
            padding: 15px;
            margin: 10px 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
        }
        
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            margin-right: 10px;
        }
        
        .method.get {
            background: #e8f5e8;
            color: #2e7d32;
        }
        
        .method.post {
            background: #fff3e0;
            color: #f57c00;
        }
        
        .links {
            text-align: center;
            margin: 30px 0;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 10px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.3s ease;
            font-weight: 500;
        }
        
        .btn:hover {
            background: #2980b9;
        }
        
        .btn.github {
            background: #24292e;
        }
        
        .btn.github:hover {
            background: #1a1e22;
        }
        
        .btn.gitee {
            background: #c71d23;
        }
        
        .btn.gitee:hover {
            background: #a0171c;
        }
        
        .footer {
            text-align: center;
            color: white;
            margin-top: 40px;
            opacity: 0.8;
        }
        
        .tech-stack {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 20px 0;
        }
        
        .tech-tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .features {
                grid-template-columns: 1fr;
            }
            
            .btn {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Ping AI Reviewer</h1>
            <p>基于 AI 的智能代码审查工具</p>
            <div class="status-badge">✅ 服务运行正常</div>
        </div>
        
        <div class="card">
            <h2>🚀 功能特性</h2>
            <div class="features">
                <div class="feature">
                    <h3>🧠 多模型支持</h3>
                    <p>兼容 DeepSeek、OpenAI 等多种 LLM 模型，灵活选择最适合的 AI 引擎</p>
                </div>
                <div class="feature">
                    <h3>📢 消息推送</h3>
                    <p>支持 PingCode、钉钉、企业微信、飞书等多种通知渠道</p>
                </div>
                <div class="feature">
                    <h3>📅 日报生成</h3>
                    <p>基于 Commit 记录自动生成开发日报，提升团队协作效率</p>
                </div>
                <div class="feature">
                    <h3>📊 数据存储</h3>
                    <p>使用 MongoDB 存储审查记录，支持历史数据查询和分析</p>
                </div>
                <div class="feature">
                    <h3>🔧 现代化技术栈</h3>
                    <p>基于 NestJS + MongoDB + TypeScript 构建，性能优异</p>
                </div>
                <div class="feature">
                    <h3>🔗 多平台支持</h3>
                    <p>支持 GitLab 和 GitHub 平台，满足不同团队需求</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>🛠️ 技术栈</h2>
            <div class="tech-stack">
                <span class="tech-tag">NestJS</span>
                <span class="tech-tag">TypeScript</span>
                <span class="tech-tag">MongoDB</span>
                <span class="tech-tag">Mongoose</span>
                <span class="tech-tag">GitLab API</span>
                <span class="tech-tag">GitHub API</span>
                <span class="tech-tag">DeepSeek</span>
                <span class="tech-tag">OpenAI</span>
                <span class="tech-tag">Vercel</span>
            </div>
        </div>
        
        
        <div class="card">
            <h2>🔧 快速开始</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.9rem;">
                <div style="margin-bottom: 15px;">
                    <strong>1. 安装依赖</strong><br>
                    <span style="color: #666;">npm install</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>2. 配置环境变量</strong><br>
                    <span style="color: #666;">cp env.example .env</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>3. 启动应用</strong><br>
                    <span style="color: #666;">npm run start:dev</span>
                </div>
                <div>
                    <strong>4. 配置 Webhook</strong><br>
                    <span style="color: #666;">在 GitLab/GitHub 项目中添加 Webhook URL</span>
                </div>
            </div>
        </div>
        
        <div class="links">
            <a href="https://github.com/sunmh207/AI-Codereview-Gitlab" target="_blank" class="btn github">
                📁 GitHub 仓库
            </a>
            <a href="https://gitee.com/sunminghui/ai-codereview-gitlab" target="_blank" class="btn gitee">
                📁 Gitee 仓库
            </a>
            <a href="/health" class="btn">
                🔍 健康检查
            </a>
            <a href="/status" class="btn">
                📊 系统状态
            </a>
        </div>
        
        <div class="footer">
            <p>© 2025 Ping AI Reviewer - 让代码审查更智能</p>
            <p>基于 NestJS 构建 | 部署在 Vercel</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  getStatus(): any {
    return {
      service: 'Ping AI Reviewer',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      platform: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      features: {
        llm: {
          deepseek: !!process.env.DEEPSEEK_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
        },
        git: {
          gitlab: !!process.env.GITLAB_ACCESS_TOKEN,
          github: !!process.env.GITHUB_ACCESS_TOKEN,
        },
        integration: {
          pingcode: !!process.env.PINGCODE_WEBHOOK_URL,
          dingtalk: !!process.env.DINGTALK_WEBHOOK_URL,
          wechat: !!process.env.WECHAT_WEBHOOK_URL,
          feishu: !!process.env.FEISHU_WEBHOOK_URL,
        },
        database: {
          mongodb: !!process.env.MONGODB_URI,
        },
      },
    };
  }
}
