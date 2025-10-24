import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectConfig, ProjectIntegrationConfig } from '../core/config';
import { logger } from '../core/logger';
import { getIntegrationClientClass } from './clients';
import { BaseIntegrationClient } from './clients/base-client';
import {
  IntegrationClientType,
  NotificationMessage,
} from './interfaces/integration-client.interface';

@Injectable()
export class IntegrationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  private createClient(
    type: IntegrationClientType,
    config: ProjectIntegrationConfig,
  ): BaseIntegrationClient<ProjectIntegrationConfig> {
    const ClientClass = getIntegrationClientClass(type);
    return new ClientClass(this.configService, this.httpService, config);
  }

  async getPingcodeWorkItemDetailsFromTitle(
    prTitle: string,
    config: ProjectIntegrationConfig,
  ): Promise<string | null> {
    try {
      const pingcodeClient = this.createClient(
        IntegrationClientType.PingCode,
        config,
      ) as any;

      if (
        !pingcodeClient ||
        !('getWorkItemDetailsFromTitle' in pingcodeClient)
      ) {
        return null;
      }

      return await pingcodeClient.getWorkItemDetailsFromTitle(prTitle);
    } catch (error) {
      logger.error(
        `Failed to get pingcode work item details from title "${prTitle}":`,
        'IntegrationService',
        error.message,
      );
      return null;
    }
  }

  async sendNotification(
    message: NotificationMessage,
    config: ProjectConfig['integrations'],
  ): Promise<void> {
    await Promise.allSettled(
      Object.entries(config).map(async ([type, integrationConfig]) => {
        const client = this.createClient(
          type as IntegrationClientType,
          integrationConfig,
        );
        if (client.isEnabled()) {
          await client.sendNotification(message);
          logger.info(
            `Notification sent successfully to ${type}`,
            'IntegrationService',
          );
        } else {
          logger.warn(
            `Integration client is disabled: ${type}`,
            'IntegrationService',
          );
        }
      }),
    );
  }

  async pushSummary(
    prTitle: string,
    summary: string,
    config: ProjectConfig['integrations'],
  ): Promise<void> {
    await Promise.allSettled(
      Object.entries(config).map(async ([type, integrationConfig]) => {
        const client = this.createClient(
          type as IntegrationClientType,
          integrationConfig,
        );
        if (client.isEnabled() && integrationConfig.push_summary?.summary_field) {
          await client.pushSummary?.(
            prTitle,
            integrationConfig.push_summary?.summary_field,
            summary,
          );
        }
      }),
    );
  }
}
