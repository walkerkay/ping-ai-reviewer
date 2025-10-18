import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { NotificationModule } from '../notification/notification.module';
import { HttpModule } from '@nestjs/axios';
import { GitLabClient } from '../git/clients/gitlab.client';
import { GitHubClient } from '../git/clients/github.client';

@Module({
  imports: [DatabaseModule, LlmModule, NotificationModule, HttpModule],
  providers: [ReviewService, GitLabClient, GitHubClient],
  exports: [ReviewService],
})
export class ReviewModule {}
