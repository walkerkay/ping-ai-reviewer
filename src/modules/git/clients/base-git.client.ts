import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GitClientInterface,
  GitClientConfig,
} from '../interfaces/git-client.interface';

/**
 * 基础 Git 客户端抽象类
 */
@Injectable()
export abstract class BaseGitClient implements GitClientInterface {
  protected config: GitClientConfig;

  constructor(
    protected configService: ConfigService,
    protected httpService: HttpService,
  ) {
    this.config = this.initializeConfig();
  }

  /**
   * 初始化配置（子类需要实现）
   */
  protected abstract initializeConfig(): GitClientConfig;

  /**
   * 获取认证头信息（子类需要实现）
   */
  protected abstract getAuthHeaders(): Record<string, string>;

  /**
   * 获取 API 基础 URL（子类需要实现）
   */
  protected abstract getApiBaseUrl(): string;

  /**
   * 构建 API 请求 URL
   */
  protected buildApiUrl(endpoint: string): string {
    return `${this.getApiBaseUrl()}${endpoint}`;
  }

  /**
   * 执行 HTTP GET 请求
   */
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

  /**
   * 执行 HTTP POST 请求
   */
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

  abstract getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any[]>;

  abstract getPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any[]>;

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

  abstract getCommitFiles(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<any[]>;

  abstract getContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<any>;

  abstract getContentAsText(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;

  abstract parseWebhookData(webhookData: any, eventType?: string): any;
}
