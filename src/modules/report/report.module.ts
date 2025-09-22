import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [DatabaseModule, LlmModule, NotificationModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
