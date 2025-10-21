import { ProjectConfig } from '../../core/config';
import { outputExample } from '../prompts/base/outro';

export type LLMReviewResult = typeof outputExample;

export interface LLMClient {
  generateReview(
    diff: string,
    commitMessages: string,
    config: ProjectConfig,
    codeStandards?: string,
  ): Promise<LLMReviewResult>;
  generateReport(commits: any[]): Promise<string>;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
