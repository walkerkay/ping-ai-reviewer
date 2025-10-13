import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // 启用CORS
  app.enableCors();

  const port = process.env.PORT || 5001;
  await app.listen(port);
  
  console.log(`🚀 Ping Code Review API is running on: http://localhost:${port}`);
}

bootstrap();

