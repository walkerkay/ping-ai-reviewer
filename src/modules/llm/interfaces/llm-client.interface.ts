export interface LLMClient {
  generateReview(diff: string, commitMessages: string): Promise<string>;
  generateReport(commits: any[]): Promise<string>;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
