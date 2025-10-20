import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BaseIntegrationClient } from './clients/base-client';
import {
  IntegrationClientType,
  NotificationMessage,
} from './interfaces/integration-client.interface';
import { ProjectConfig, ProjectIntegrationConfig } from '../core/config';
import { logger } from '../core/logger';
import { getIntegrationClientClass } from './clients';

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

  async sendNotification(
    message: NotificationMessage,
    config: ProjectConfig['integrations'],
  ): Promise<void> {
    await Promise.all(
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
}
