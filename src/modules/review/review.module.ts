import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { NotificationModule } from '../notification/notification.module';
import { HttpModule } from '@nestjs/axios';
import { GitLabService } from '../webhook/services/gitlab.service';
import { GitHubService } from '../webhook/services/github.service';

@Module({
  imports: [DatabaseModule, LlmModule, NotificationModule, HttpModule],
  providers: [ReviewService, GitLabService, GitHubService],
  exports: [ReviewService],
})
export class ReviewModule {}
