import { Controller, Get, Query } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('review')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('daily_report')
  async getDailyReport(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ): Promise<string> {
    const start = startTime ? parseInt(startTime) : undefined;
    const end = endTime ? parseInt(endTime) : undefined;
    
    return this.reportService.generateManualReport(start, end);
  }
}

