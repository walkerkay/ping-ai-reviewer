import { ConfigService } from '@nestjs/config';
import { BaseIntegrationClient } from './base-client';
import { HttpService } from '@nestjs/axios';
import { ProjectIntegrationConfig } from '../../core/config';
import { NotificationMessage } from '../interfaces/integration-client.interface';
import { firstValueFrom } from 'rxjs';
import { logger } from '../../core/logger';

export class WeComClient extends BaseIntegrationClient<ProjectIntegrationConfig> {
  constructor(
    configService: ConfigService,
    httpService: HttpService,
    config: ProjectIntegrationConfig,
  ) {
    super(configService, httpService, config);
  }

  private formatMessage(message: NotificationMessage): any {
    if (message.msgType === 'markdown') {
      return {
        msgtype: 'markdown',
        markdown: {
          content: `## ${message.title || '代码审查通知'}\n\n${message.content}`,
        },
      };
    }

    return {
      msgtype: 'text',
      text: {
        content: `${message.title ? `**${message.title}**\n\n` : ''}${message.content}`,
      },
    };
  }

  async sendNotification(message: NotificationMessage): Promise<boolean> {
    if (!this.config.notification.webhookUrl) {
      logger.info('WeCom webhook URL is not configured', 'WeComClient');
      return false;
    }

    try {
      const payload = this.formatMessage(message);

      const response = await firstValueFrom(
        this.httpService.post(this.config.notification.webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return response.data.errcode === 0;
    } catch (error) {
      logger.error(
        'WeCom notification failed:',
        'WeComClient',
        error.message,
      );
      return false;
    }
  }
}

