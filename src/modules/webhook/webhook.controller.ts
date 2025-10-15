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
    console.log('=== WEBHOOK CONTROLLER START ===');
    console.log('Headers received:', JSON.stringify(headers, null, 2));
    console.log('Body received:', JSON.stringify(body, null, 2));
    
    const githubEvent = headers['x-github-event'];
    console.log('GitHub event type:', githubEvent);
    
    if (githubEvent) {
      // GitHub webhook
      console.log('Processing GitHub webhook...');
      return this.webhookService.handleGitHubWebhook(body, githubEvent);
    } else {
      // GitLab webhook
      console.log('Processing GitLab webhook...');
      return this.webhookService.handleGitLabWebhook(body);
    }
  }
}

