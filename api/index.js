const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ValidationPipe } = require('@nestjs/common');

let app;

async function createApp() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    
    // 全局验证管道
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));

    // 启用CORS
    app.enableCors();
    
    await app.init();
  }
  return app;
}

module.exports = async (req, res) => {
  try {
    const nestApp = await createApp();
    const server = nestApp.getHttpAdapter().getInstance();
    
    // 设置请求和响应对象
    server(req, res);
  } catch (error) {
    console.error('Error in Vercel handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
