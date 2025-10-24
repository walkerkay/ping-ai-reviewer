import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ProjectIntegrationConfig } from '../../core/config';
import { logger } from '../../core/logger';
import { NotificationMessage } from '../interfaces/integration-client.interface';
import { BaseIntegrationClient } from './base-client';

const workItemCache: Map<
  string,
  { id: string; title: string; description: string }
> = new Map();

const tokenCache: Map<string, string> = new Map();

@Injectable()
export class PingCodeClient extends BaseIntegrationClient<ProjectIntegrationConfig> {
  private accessToken: string | null = null;

  private apiUrl: string;

  private clientId: string;

  private clientSecret: string;

  constructor(
    configService: ConfigService,
    httpService: HttpService,
    config: ProjectIntegrationConfig,
  ) {
    super(configService, httpService, config);
    this.apiUrl =
      configService.get('PINGCODE_API') ?? 'https://open.pingcode.com';
    this.clientId = configService.get('PINGCODE_CLIENT_ID');
    this.clientSecret = configService.get('PINGCODE_CLIENT_SECRET');
  }

  validateConfig(): boolean {
    return !!this.apiUrl && !!this.clientId && !!this.clientSecret;
  }

  async pushSummary(
    prTitle: string,
    field: string,
    summary: string,
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      const workItemIdentifier = this.extractIdentifier(prTitle);

      if (!workItemIdentifier) {
        logger.info(
          'No work item identifier found in message content',
          'PingCodeClient',
        );
        return false;
      }

      const workItemId = await this.getWorkItemId(workItemIdentifier, token);

      if (workItemId) {
        summary = `🤖 ${summary}`;
        const response = await firstValueFrom(
          this.httpService.patch(
            `${this.apiUrl}/v1/project/work_items/${workItemId}`,
            {
              [field]: summary,
              [`properties.${field}`]: summary,
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
      }
    } catch (error) {
      logger.error(
        'PingCode push summary failed:',
        'PingCodeClient',
        error.message,
      );
    }
  }

  async sendNotification(message: NotificationMessage): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      const formatedMessage = this.formatMessage(message);

      const workItemIdentifier = this.extractIdentifier(
        message.additions?.pullRequest?.title,
      );

      if (!workItemIdentifier) {
        logger.info(
          'No work item identifier found in message content',
          'PingCodeClient',
        );
        return false;
      }

      const workItemId = await this.getWorkItemId(workItemIdentifier, token);

      if (!workItemId) {
        logger.info(
          `Work item not found for identifier: ${workItemIdentifier}`,
          'PingCodeClient',
        );
        return false;
      }

      // 调用 PingCode API 创建评论
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/v1/comments`,
          {
            content: formatedMessage,
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
      logger.error(
        'PingCode notification failed:',
        'PingCodeClient',
        error.message,
      );
      return false;
    }
  }

  private formatMessage(message: NotificationMessage): string {
    let content = '';

    if (message.additions?.pullRequest?.title) {
      content += `🤖 代码审查完成\nURL: ${message.additions?.pullRequest?.url}\n`;
    }
    content += message.content;

    return content;
  }

  private extractIdentifier(title: string): string | null {
    if (!title) {
      return null;
    }
    // 尝试从标题中提取工作项标识符，例如 #xxx-01 格式
    const identifierMatch = title.match(/#([a-zA-Z0-9]+-\d+)/);
    return identifierMatch ? identifierMatch[1] : null;
  }

  private async getAccessToken(): Promise<string | null> {
    const cached = tokenCache.get(this.clientId);
    if (cached) {
      return cached;
    }
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
        tokenCache.set(this.clientId, response.data.access_token);
        return response.data.access_token;
      }
      logger.error('Failed to get PingCode access token', 'PingCodeClient');
      return null;
    } catch (error) {
      logger.error(
        'Failed to get PingCode access token',
        'PingCodeClient',
        error.message,
      );
      return null;
    }
  }

  private async fetchWorkItemFromAPI(
    identifier: string,
    token: string,
  ): Promise<{ id: string; title: string; description: string } | null> {
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

      if (
        response.data &&
        response.data.values &&
        response.data.values.length > 0
      ) {
        const workItem = response.data.values[0];
        const workItemData = {
          id: workItem.id,
          title: workItem.title || '',
          description: workItem.description || '',
        };

        // 缓存工作项详情
        workItemCache.set(identifier, workItemData);

        return workItemData;
      }

      return null;
    } catch (error) {
      logger.error(
        `Failed to fetch work item for identifier ${identifier}:`,
        'PingCodeClient',
        error.message,
      );
      return null;
    }
  }

  private async getWorkItemId(
    identifier: string,
    token: string,
  ): Promise<string | null> {
    try {
      const cached = workItemCache.get(identifier);
      if (cached) {
        return cached.id;
      }

      const workItemData = await this.fetchWorkItemFromAPI(identifier, token);
      return workItemData?.id || null;
    } catch (error) {
      logger.error(
        `Failed to get work item ID for identifier ${identifier}:`,
        'PingCodeClient',
        error.message,
      );
      return null;
    }
  }

  async getWorkItemDetails(identifier: string): Promise<{
    title: string;
    description: string;
  } | null> {
    try {
      const cached = workItemCache.get(identifier);
      if (cached) {
        return {
          title: cached.title,
          description: cached.description,
        };
      }

      const token = await this.getAccessToken();
      if (!token) {
        return null;
      }

      const workItemData = await this.fetchWorkItemFromAPI(identifier, token);
      if (!workItemData) {
        return null;
      }

      return {
        title: workItemData.title,
        description: workItemData.description,
      };
    } catch (error) {
      logger.error(
        `Failed to get work item details for identifier ${identifier}:`,
        'PingCodeClient',
        error.message,
      );
      return null;
    }
  }

  async getWorkItemDetailsFromTitle(prTitle: string): Promise<string | null> {
    const identifier = this.extractIdentifier(prTitle);
    if (!identifier) {
      return null;
    }

    const details = await this.getWorkItemDetails(identifier);
    if (!details) {
      return null;
    }

    const infoParts: string[] = [];
    if (details.title) {
      infoParts.push(`标题：${details.title}`);
    }
    if (details.description) {
      infoParts.push(`描述：${details.description}`);
    }

    return infoParts.length > 0 ? infoParts.join('\n') : null;
  }
}
