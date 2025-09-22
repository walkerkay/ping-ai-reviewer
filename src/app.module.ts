import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import { WebhookModule } from './modules/webhook/webhook.module';
import { LlmModule } from './modules/llm/llm.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ReviewModule } from './modules/review/review.module';
import { DatabaseModule } from './modules/database/database.module';
import { ReportModule } from './modules/report/report.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/ping-codereview'),
    ScheduleModule.forRoot(),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    WebhookModule,
    LlmModule,
    NotificationModule,
    ReviewModule,
    DatabaseModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
