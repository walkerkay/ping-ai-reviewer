import { Injectable } from '@nestjs/common';
import { logger } from '../../core/logger';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Notifier, NotificationMessage } from '../interfaces/notifier.interface';

@Injectable()
export class FeishuNotifier implements Notifier {
  private webhookUrl: string;
  private enabled: boolean;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.enabled = this.configService.get<string>('FEISHU_ENABLED') === '1';
    this.webhookUrl = this.configService.get<string>('FEISHU_WEBHOOK_URL');
  }

  isEnabled(): boolean {
    return this.enabled && !!this.webhookUrl;
  }

  async sendNotification(message: NotificationMessage): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const payload = this.buildPayload(message);
      
      const response = await firstValueFrom(
        this.httpService.post(this.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data.code === 0;
    } catch (error) {
      logger.error('Feishu notification failed:', 'FeishuNotifier', error.message);
      return false;
    }
  }

  private buildPayload(message: NotificationMessage): any {
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
}

