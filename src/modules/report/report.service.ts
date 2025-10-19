import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LLMFactory } from '../llm/llm.factory';
import { NotificationService } from '../notification/notification.service';
import { logger } from '../core/logger';

@Injectable()
export class ReportService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async generateDailyReport(): Promise<void> {
    try {
      const pushReviewEnabled = this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';
      
      // 获取当天的时间范围
      const now = new Date();
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();

      let commits = [];
      
      if (pushReviewEnabled) {
        commits = await this.databaseService.getPushReviews({
          updatedAtGte: startTime,
          updatedAtLte: endTime,
        });
      } else {
        commits = await this.databaseService.getMergeRequestReviews({
          updatedAtGte: startTime,
          updatedAtLte: endTime,
        });
      }

      if (commits.length === 0) {
        logger.info('No data to process for daily report', 'ReportService');
        return;
      }

      // 去重：基于 (author, commitMessages) 组合
      const uniqueCommits = this.removeDuplicateCommits(commits);
      
      // 按作者排序
      const sortedCommits = uniqueCommits.sort((a, b) => a.author.localeCompare(b.author));

      // 生成日报
      const reportContent = await this.generateReportContent(sortedCommits);

      // 发送通知
      await this.notificationService.sendNotification({
        content: reportContent,
        title: '代码提交日报',
        msgType: 'markdown',
      });

      logger.info('Daily report generated and sent successfully', 'ReportService');
    } catch (error) {
      logger.error('Failed to generate daily report:', 'ReportService', error.message);
    }
  }

  async generateManualReport(startTime?: number, endTime?: number): Promise<string> {
    try {
      const pushReviewEnabled = this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';
      
      // 如果没有提供时间范围，使用当天
      if (!startTime || !endTime) {
        const now = new Date();
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
        endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
      }

      let commits = [];
      
      if (pushReviewEnabled) {
        commits = await this.databaseService.getPushReviews({
          updatedAtGte: startTime,
          updatedAtLte: endTime,
        });
      } else {
        commits = await this.databaseService.getMergeRequestReviews({
          updatedAtGte: startTime,
          updatedAtLte: endTime,
        });
      }

      if (commits.length === 0) {
        return 'No data to process for report';
      }

      // 去重和排序
      const uniqueCommits = this.removeDuplicateCommits(commits);
      const sortedCommits = uniqueCommits.sort((a, b) => a.author.localeCompare(b.author));

      // 生成报告
      return await this.generateReportContent(sortedCommits);
    } catch (error) {
      logger.error('Failed to generate manual report:', 'ReportService', error.message);
      return 'Failed to generate report';
    }
  }

  private removeDuplicateCommits(commits: any[]): any[] {
    const seen = new Set();
    return commits.filter(commit => {
      const key = `${commit.author}-${commit.commitMessages}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async generateReportContent(commits: any[]): Promise<string> {
    const llmClient = this.llmFactory.getClient();
    
    // 准备数据
    const reportData = commits.map(commit => ({
      author: commit.author,
      commitMessages: commit.commitMessages,
      projectName: commit.projectName,
      additions: commit.additions || 0,
      deletions: commit.deletions || 0,
      score: commit.score || 0,
    }));

    return await llmClient.generateReport(reportData);
  }
}

