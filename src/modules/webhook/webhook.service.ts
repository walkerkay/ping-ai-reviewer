import { Injectable } from '@nestjs/common';
import { GitFactory } from '../git/git.factory';
import { GitClientType } from '../git/interfaces/git-client.interface';
import { ReviewService } from '../review/review.service';

@Injectable()
export class WebhookService {
  constructor(
    private gitFactory: GitFactory,
    private reviewService: ReviewService,
  ) {}

  async handleGitLabWebhook(webhookData: any): Promise<{ message: string }> {
    try {
      const gitlabClient = this.gitFactory.createGitClient(
        GitClientType.GITLAB,
      );
      const parsedData = gitlabClient.parseWebhookData(webhookData);

      if (!parsedData) {
        return { message: 'Unsupported GitLab event type' };
      }

      if (
        parsedData.eventType === 'pull_request' &&
        ['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(
          parsedData.state,
        )
      ) {
        await this.reviewService.handlePullRequest(parsedData);
        return {
          message: 'GitLab merge request event processed asynchronously',
        };
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

  async handleGitHubWebhook(
    webhookData: any,
    eventType: string,
  ): Promise<{ message: string }> {
    try {
      const githubClient = this.gitFactory.createGitClient(
        GitClientType.GITHUB,
      );
      const parsedData = githubClient.parseWebhookData(webhookData, eventType);

      if (!parsedData) {
        return { message: 'Unsupported GitHub event type' };
      }

      if (
        parsedData.eventType === 'pull_request' &&
        ['open', 'update', 'reopen', 'unmarked_as_draft'].includes(
          parsedData.state,
        )
      ) {
        await this.reviewService.handlePullRequest(parsedData);
        return {
          message: 'GitHub pull request event processed asynchronously',
        };
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
