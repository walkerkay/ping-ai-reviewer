import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GitClientInterface,
  GitClientConfig,
  PullRequestInfo,
  PushInfo, 
} from '../interfaces/git-client.interface'; 

@Injectable()
export abstract class BaseGitClient implements GitClientInterface {
  protected config: GitClientConfig;

  constructor(
    protected configService: ConfigService,
  ) {
    this.config = this.initializeConfig();
  }

  protected abstract initializeConfig(): GitClientConfig;

 
  abstract getPullRequestInfo(
    owner: string,
    repo: string,
    pullNumber: number, 
  ): Promise<PullRequestInfo>;

  abstract getPushInfo(
    owner: string,
    repo: string,
    commitSha: string, 
  ): Promise<PushInfo>;

  abstract createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<boolean>;

  abstract createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
  ): Promise<boolean>;

  abstract getContentAsText(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;

  abstract parseWebhookData(webhookData: any, eventType?: string): any;
}
