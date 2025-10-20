import { ProjectIntegrationConfig } from '../../core/config';
import { IntegrationClientType } from '../interfaces/integration-client.interface';
import { BaseIntegrationClient } from './base-client';
import { DingTalkClient } from './dingtalk.client';
import { PingCodeClient } from './pingcode.client';
import { WeComClient } from './wecom.client';
import { FeishuClient } from './feishu.client';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

const integrationClientClassMap = {
  [IntegrationClientType.PingCode]: PingCodeClient,
  [IntegrationClientType.DingTalk]: DingTalkClient,
  [IntegrationClientType.WeCom]: WeComClient,
  [IntegrationClientType.Feishu]: FeishuClient,
};

export function getIntegrationClientClass(
  type: IntegrationClientType,
): new (
  configService: ConfigService,
  httpService: HttpService,
  config: ProjectIntegrationConfig,
) => BaseIntegrationClient<ProjectIntegrationConfig> {
  return integrationClientClassMap[type];
}
