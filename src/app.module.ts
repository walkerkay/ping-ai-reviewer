import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as CoreConfigModule } from './modules/core/config/config.module';
import { DatabaseModule } from './modules/database/database.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { LlmModule } from './modules/llm/llm.module';
import { ReportModule } from './modules/report/report.module';
import { ReviewModule } from './modules/review/review.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ping-codereview',
    ),
    ScheduleModule.forRoot(),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    WebhookModule,
    LlmModule,
    IntegrationModule,
    ReviewModule,
    DatabaseModule,
    ReportModule,
    CoreConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
