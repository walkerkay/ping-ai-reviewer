import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

let app: any;

async function createApp() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    
    // 全局验证管道
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    // 启用CORS
    app.enableCors();
    
    // 在 serverless 环境中只初始化应用，不启动服务器
    await app.init();
  }
  return app;
}

// 导出 serverless 处理函数
const handler = async (req: any, res: any) => {
  try {
    const nestApp = await createApp();
    const server = nestApp.getHttpAdapter().getInstance();
    
    // 设置请求和响应对象
    server(req, res);
  } catch (error) {
    console.error('Error in serverless handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
module.exports = handler;
