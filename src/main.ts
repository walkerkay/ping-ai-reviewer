import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // 检查是否在Vercel环境中
  if (process.env.VERCEL) {
    // 在Vercel环境中，不启动服务器，只初始化应用
    await app.init();
    return app;
  }

  const port = process.env.PORT || 5001;
  await app.listen(port);

  console.log(
    `🚀 Ping Code Review API is running on: http://localhost:${port}`,
  );
}

// 只在非Vercel环境中启动服务器
if (!process.env.VERCEL) {
  bootstrap();
}
