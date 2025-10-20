import { ConfigService } from '@nestjs/config';
import { BaseIntegrationClient } from './base-client';
import { HttpService } from '@nestjs/axios';
import { ProjectIntegrationConfig } from '../../core/config';
import { NotificationMessage } from '../interfaces/integration-client.interface';
import { firstValueFrom } from 'rxjs';
import { logger } from '../../core/logger';

export class FeishuClient extends BaseIntegrationClient<ProjectIntegrationConfig> {
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
        msg_type: 'interactive',
        card: {
          elements: [
            {
              tag: 'div',
              text: {
                content: `**${message.title || '代码审查通知'}**\n\n${message.content}`,
                tag: 'lark_md',
              },
            },
          ],
        },
      };
    }

    return {
      msg_type: 'text',
      content: {
        text: `${message.title ? `**${message.title}**\n\n` : ''}${message.content}`,
      },
    };
  }

  async sendNotification(message: NotificationMessage): Promise<boolean> {
    if (!this.config.notification.webhookUrl) {
      logger.info('Feishu webhook URL is not configured');
      return false;
    }

    try {
      const payload = this.formatMessage(message);

      const response = await firstValueFrom(
        this.httpService.post(this.config.notification.webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return response.data.code === 0;
    } catch (error) {
      logger.error(
        'Feishu notification failed:',
        'FeishuClient',
        error.message,
      );
      return false;
    }
  }
}

