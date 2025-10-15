import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import serverless from 'serverless-http';
import express from 'express';

const expressApp = express();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  app.enableCors();
  app.use(expressApp);
  await app.init();
}

bootstrap();

export const handler = serverless(expressApp);
