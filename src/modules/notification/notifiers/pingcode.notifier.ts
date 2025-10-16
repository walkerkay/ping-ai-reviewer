import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  Notifier,
  NotificationMessage,
} from '../interfaces/notifier.interface';

@Injectable()
export class PingCodeNotifier implements Notifier {
  private apiUrl: string;
  private clientId: string;
  private clientSecret: string;
  private enabled: boolean;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.enabled = this.configService.get<string>('PINGCODE_ENABLED') === '1';
    this.apiUrl = this.configService.get<string>('PINGCODE_API_URL');
    this.clientId = this.configService.get<string>('PINGCODE_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'PINGCODE_CLIENT_SECRET',
    );
  }

  isEnabled(): boolean {
    return (
      this.enabled && !!this.apiUrl && !!this.clientId && !!this.clientSecret
    );
  }

  async sendNotification(message: NotificationMessage): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      // 确保有有效的访问令牌
      const token = await this.getValidAccessToken();
      if (!token) {
        console.error('Failed to obtain valid access token');
        return false;
      }

      // 创建评论内容
      const commentContent = this.buildCommentContent(message);

      // 从消息内容中提取工作项标识符
      const workItemIdentifier = this.extractWorkItemIdentifier(
        message.additions?.pullRequest?.title,
      );

      if (!workItemIdentifier) {
        console.log('No work item identifier found in message content');
        return false;
      }

      // 获取工作项 ID
      const workItemId = await this.getWorkItemId(workItemIdentifier, token);

      if (!workItemId) {
        console.log(
          `Work item not found for identifier: ${workItemIdentifier}`,
        );
        return false;
      }

      // 调用 PingCode API 创建评论
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/v1/comments`,
          {
            content: commentContent,
            principal_type: 'work_item',
            principal_id: workItemId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.status === 200 || response.status === 201;
    } catch (error) {
      console.error('PingCode notification failed:', error.message);
      return false;
    }
  }

  private buildCommentContent(message: NotificationMessage): string {
    let content = '';

    if (message.additions?.pullRequest?.title) {
      content += `🔗 URL: ${message.additions?.pullRequest?.url}\n`;
    }
    content += message.content;

    return content;
  }

  private extractWorkItemIdentifier(content: string): string | null {
    // 尝试从内容中提取工作项标识符，例如 #xxx-01 格式
    const workItemMatch = content.match(/#([a-zA-Z0-9]+-\d+)/);
    return workItemMatch ? workItemMatch[1] : null;
  }

  private async getValidAccessToken(): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);

    // 如果令牌不存在或即将过期（提前5分钟刷新），则获取新令牌
    if (!this.accessToken || this.tokenExpiresAt <= now + 300) {
      return await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/v1/auth/token`, {
          params: {
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // 设置令牌过期时间（提前1小时过期以确保安全）
        this.tokenExpiresAt =
          Math.floor(Date.now() / 1000) +
          (response.data.expires_in || 3600) -
          3600;
        console.log('PingCode access token refreshed successfully');
        return this.accessToken;
      }

      return null;
    } catch (error) {
      console.error('Failed to refresh PingCode access token:', error.message);
      return null;
    }
  }

  private async getWorkItemId(
    identifier: string,
    token: string,
  ): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/v1/project/work_items`, {
          params: {
            identifier: identifier,
          },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      // 假设 API 返回的工作项数据中包含 id 字段
      if (
        response.data &&
        response.data.values &&
        response.data.values.length > 0
      ) {
        return response.data.values[0].id;
      }

      return null;
    } catch (error) {
      console.error(
        `Failed to get work item ID for identifier ${identifier}:`,
        error.message,
      );
      return null;
    }
  }
}
