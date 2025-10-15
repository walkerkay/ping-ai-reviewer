import { Injectable } from '@nestjs/common';
import { GitLabService } from './services/gitlab.service';
import { GitHubService } from './services/github.service';
import { ReviewService } from '../review/review.service';

@Injectable()
export class WebhookService {
  constructor(
    private gitlabService: GitLabService,
    private githubService: GitHubService,
    private reviewService: ReviewService,
  ) {}

  async handleGitLabWebhook(webhookData: any): Promise<{ message: string }> {
    try {
      const parsedData = this.gitlabService.parseWebhookData(webhookData);
      
      if (!parsedData) {
        return { message: 'Unsupported GitLab event type' };
      }

      if (parsedData.eventType === 'merge_request') {
        await this.reviewService.handleMergeRequest(parsedData);
        return { message: 'GitLab merge request event processed asynchronously' };
      } else if (parsedData.eventType === 'push') {
        await this.reviewService.handlePush(parsedData);
        return { message: 'GitLab push event processed asynchronously' };
      }

      return { message: 'GitLab event processed' };
    } catch (error) {
      console.error('GitLab webhook processing failed:', error.message);
      return { message: 'GitLab webhook processing failed' };
    }
  }

  async handleGitHubWebhook(webhookData: any, eventType: string): Promise<{ message: string }> {
    try {
      const parsedData = this.githubService.parseWebhookData(webhookData, eventType);
      
      if (!parsedData) {
        return { message: 'Unsupported GitHub event type' };
      }

      if (parsedData.eventType === 'pull_request') {
        await this.reviewService.handlePullRequest(parsedData);
        return { message: 'GitHub pull request event processed asynchronously' };
      } else if (parsedData.eventType === 'push') {
        await this.reviewService.handlePush(parsedData);
        return { message: 'GitHub push event processed asynchronously' };
      }

      return { message: 'GitHub event processed' };
    } catch (error) {
      console.error('GitHub webhook processing failed:', error.message);
      return { message: 'GitHub webhook processing failed' };
    }
  }
}

