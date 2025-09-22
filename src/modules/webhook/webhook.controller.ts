import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { GitLabWebhookDto, GitHubWebhookDto } from './dto/webhook.dto';
import { WebhookService } from './webhook.service';

@Controller('review')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ message: string }> {
    const githubEvent = headers['x-github-event'];
    
    if (githubEvent) {
      // GitHub webhook
      return this.webhookService.handleGitHubWebhook(body, githubEvent);
    } else {
      // GitLab webhook
      return this.webhookService.handleGitLabWebhook(body);
    }
  }
}
