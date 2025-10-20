import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [DatabaseModule, LlmModule, IntegrationModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}

