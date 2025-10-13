import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { GitLabService } from './services/gitlab.service';
import { GitHubService } from './services/github.service';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [HttpModule, ReviewModule],
  controllers: [WebhookController],
  providers: [WebhookService, GitLabService, GitHubService],
})
export class WebhookModule {}

