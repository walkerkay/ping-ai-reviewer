import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GitClientInterface,
  GitClientConfig,
  PullRequestInfo,
  PushInfo,
  FileChange,
} from '../interfaces/git-client.interface';

@Injectable()
export abstract class BaseGitClient implements GitClientInterface {
  protected config: GitClientConfig;

  constructor(
    protected configService: ConfigService,
    protected httpService: HttpService,
  ) {
    this.config = this.initializeConfig();
  }

  protected abstract initializeConfig(): GitClientConfig;

  protected abstract getAuthHeaders(): Record<string, string>;

  protected abstract getApiBaseUrl(): string;

  protected buildApiUrl(endpoint: string): string {
    return `${this.getApiBaseUrl()}${endpoint}`;
  }

  protected async makeGetRequest(
    url: string,
    params?: Record<string, any>,
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getAuthHeaders(),
          params,
        }),
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to make GET request to ${url}:`, error.message);
      console.error('Error details:', error.response?.data || error);
      throw error;
    }
  }

  protected async makePostRequest(url: string, data: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, data, {
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to make POST request to ${url}:`, error.message);
      console.error('Error details:', error.response?.data || error);
      throw error;
    }
  }

  protected filterReviewableFiles(files: FileChange[]): FileChange[] {
    const supportedExtensions = this.configService
      .get<string>(
        'SUPPORTED_EXTENSIONS',
        '.java,.py,.php,.js,.ts,.vue,.yml,.json,.md,.sql',
      )
      .split(',');

    return files.filter((file) =>
      supportedExtensions.some((ext) => file.filename.endsWith(ext)),
    );
  }

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
