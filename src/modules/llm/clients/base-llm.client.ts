import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMClient,
  LLMConfig,
  LLMReviewResult,
} from '../interfaces/llm-client.interface';
import { ProjectConfig } from '../../core/config';

@Injectable()
export abstract class BaseLLMClient implements LLMClient {
  protected config: LLMConfig;

  constructor(
    protected configService: ConfigService,
    protected provider: string,
  ) {
    this.config = this.getConfig();
  }

  protected abstract getConfig(): LLMConfig;

  abstract generateReview(
    diff: string,
    commitMessages: string,
    config: ProjectConfig,
  ): Promise<LLMReviewResult>;

  abstract generateReport(commits: any[]): Promise<string>;

  protected getApiKey(): string {
    return this.configService.get<string>(
      `${this.provider.toUpperCase()}_API_KEY`,
    );
  }

  protected getBaseUrl(): string {
    return (
      this.configService.get<string>(
        `${this.provider.toUpperCase()}_BASE_URL`,
      ) || this.config.baseUrl
    );
  }

  protected getModel(): string {
    return (
      this.configService.get<string>(`${this.provider.toUpperCase()}_MODEL`) ||
      this.config.model
    );
  }

  protected getTemperature(): number {
    return (
      this.configService.get<number>(
        `${this.provider.toUpperCase()}_TEMPERATURE`,
      ) ||
      this.config.temperature ||
      0.7
    );
  }

  protected getMaxTokens(): number {
    return (
      this.configService.get<number>(
        `${this.provider.toUpperCase()}_MAX_TOKENS`,
      ) ||
      this.config.maxTokens ||
      2000
    );
  }
}
