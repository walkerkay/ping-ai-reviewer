import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ProjectIntegrationConfig } from '../../core/config';
import {
  IntegrationClientInterface,
  NotificationMessage,
} from '../interfaces/integration-client.interface';

export abstract class BaseIntegrationClient<
  TConfig extends ProjectIntegrationConfig,
> implements IntegrationClientInterface
{
  constructor(
    protected configService: ConfigService,
    protected httpService: HttpService,
    protected config: TConfig,
  ) {}

  validateConfig(): boolean {
    return true;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.validateConfig();
  }

  abstract sendNotification(message: NotificationMessage): Promise<boolean>;

  async pushSummary(
    prTitle: string,
    field: string,
    summary: string,
  ): Promise<boolean> {
    return true;
  }

  async getCustomPrompt(prTitle: string): Promise<string | null> {
    return null;
  }
}
