import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseLLMClient } from './base-llm.client';
import { LLMConfig } from '../interfaces/llm-client.interface';

@Injectable()
export class OpenAIClient extends BaseLLMClient {
  constructor(
    configService: ConfigService,
    private httpService: HttpService,
  ) {
    super(configService, 'openai');
  }

  protected getConfig(): LLMConfig {
    return {
      apiKey: this.getApiKey(),
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
    };
  }

  async generateReview(diff: string, commitMessages: string): Promise<string> {
    const prompt = this.buildReviewPrompt(diff, commitMessages);
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl()}/chat/completions`,
          {
            model: this.getModel(),
            messages: [
              {
                role: 'system',
                content: 'You are a professional code review expert. Please review the code changes and provide constructive suggestions.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: this.getTemperature(),
            max_tokens: this.getMaxTokens(),
          },
          {
            headers: {
              'Authorization': `Bearer ${this.getApiKey()}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async generateReport(commits: any[]): Promise<string> {
    const prompt = this.buildReportPrompt(commits);
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl()}/chat/completions`,
          {
            model: this.getModel(),
            messages: [
              {
                role: 'system',
                content: 'You are a project report generator. Please generate a concise daily report based on commit records.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: this.getTemperature(),
            max_tokens: this.getMaxTokens(),
          },
          {
            headers: {
              'Authorization': `Bearer ${this.getApiKey()}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  private buildReviewPrompt(diff: string, commitMessages: string): string {
    return `
Please review the following code changes:

Commit messages: ${commitMessages}

Code changes:
\`\`\`
${diff}
\`\`\`

Please review from the following perspectives:
1. Code quality and standards
2. Potential security issues
3. Performance optimization suggestions
4. Maintainability and readability
5. Best practices recommendations

Please provide specific improvement suggestions and code examples.
    `.trim();
  }

  private buildReportPrompt(commits: any[]): string {
    return `
Please generate a project daily report based on the following commit records:

Commit records:
${JSON.stringify(commits, null, 2)}

Please generate a report including:
1. Today's commit overview
2. Main feature development
3. Code quality statistics
4. Developer contribution status
5. Issues that need attention

Please use concise and clear language suitable for team sharing.
    `.trim();
  }
}
