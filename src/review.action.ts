import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebhookService } from './modules/webhook/webhook.service';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const webhookService = app.get(WebhookService);

  // 自动识别运行环境
  const isGitHub = !!process.env.GITHUB_EVENT_NAME;
  const isGitLab = !!process.env.CI_PROJECT_ID;

  if (isGitHub) {
    const eventName = process.env.GITHUB_EVENT_NAME!;
    const eventPath = process.env.GITHUB_EVENT_PATH!;
    const body = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    console.log(`🔹 GitHub Action detected: ${eventName}`);

    await webhookService.handleGitHubWebhook(body, eventName);
  } else if (isGitLab) {
    const body = {
      project_id: process.env.CI_PROJECT_ID,
      merge_request: {
        iid: process.env.CI_MERGE_REQUEST_IID,
        source_branch: process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME,
        target_branch: process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME,
      },
    };
    console.log(`🔹 GitLab Action detected: project=${body.project_id}`);

    await webhookService.handleGitLabWebhook(body);
  } else {
    console.error('❌ 未检测到 GitHub 或 GitLab 环境变量');
    process.exit(1);
  }

  await app.close();
}

bootstrap();
