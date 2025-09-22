import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Notifier, NotificationMessage } from '../interfaces/notifier.interface';

@Injectable()
export class DingTalkNotifier implements Notifier {
  private webhookUrl: string;
  private enabled: boolean;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.enabled = this.configService.get<string>('DINGTALK_ENABLED') === '1';
    this.webhookUrl = this.configService.get<string>('DINGTALK_WEBHOOK_URL');
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

      return response.data.errcode === 0;
    } catch (error) {
      console.error('DingTalk notification failed:', error.message);
      return false;
    }
  }

  private buildPayload(message: NotificationMessage): any {
    if (message.msgType === 'markdown') {
      return {
        msgtype: 'markdown',
        markdown: {
          title: message.title || '代码审查通知',
          text: message.content,
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
}
