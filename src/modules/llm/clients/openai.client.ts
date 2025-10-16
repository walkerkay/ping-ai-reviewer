import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseLLMClient } from './base-llm.client';
import { LLMConfig, ReviewResult } from '../interfaces/llm-client.interface';

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

  async generateReview(diff: string, commitMessages: string): Promise<ReviewResult> {
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

      return this.parseReviewResult(response.data.choices[0].message.content);
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
You are an experienced code reviewer. Please conduct a professional review of the following code changes.

Commit messages:
${commitMessages}

Code changes (standard Git diff format):
\`\`\`diff
${diff}
\`\`\`

Please review the changes from the following aspects:
1. Code quality and conventions
2. Potential security issues
3. Performance optimization
4. Maintainability and readability
5. Best practices

Output requirements:
- Return only a JSON object, without any additional explanation or Markdown.
- JSON format:
{
  "overall": "Write a comprehensive code review report, including multiple improvement suggestions, analysis, Markdown-formatted lists, and code examples if needed.",
  "inlineComments": [
    {
      "file": "Provide the actual file path",
      "line": Provide the actual line number,
      "comment": "Provide a specific comment for that line"
    }
  ]
}
- The overall field should contain a detailed review report, which may include:
  - Multiple specific improvement suggestions
  - Markdown formatting (lists, headings, emphasis)
  - Code examples (enclosed in \`\`\` blocks)
- inlineComments must be an array; if there are no line-level comments, return an empty array [].
- Each inlineComments item must include file, line, and comment.
- Do not output any other fields, example values, or extra text.
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

