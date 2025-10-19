import { outputExample } from '../prompts/base/outro';
import { ProjectConfig } from '../../core/config';

export type LLMReviewResult = typeof outputExample;

export interface LLMClient {
  generateReview(diff: string, commitMessages: string, config: ProjectConfig): Promise<LLMReviewResult>;
  generateReport(commits: any[]): Promise<string>;
} 

export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
