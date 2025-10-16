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
                content: `You are a professional code review expert. Please perform a detailed review of the given code and provide constructive suggestions.
                  Return the result strictly in JSON format as shown below:
                  {
                    "summary": "Summary",
                    "detail": "Detailed suggestions",
                    "inlineComments": [
                      {
                        "file": "Actual file path",
                        "line": Actual modified line number,
                        "comment": "Specific comment for this line"
                      }
                    ]
                  }
                  Requirements:

                  summary should be concise and suitable for a notification message.

                  Use \n for proper line breaks.

                  Limit to no more than 5 key points.

                  detail should include a comprehensive review, formatted in Markdown for readability.

                  The review status in the summary should be one of the following:

                  ✅ Mergeable (Minor)

                  ⚠️ Mergeable (With Improvements)

                  ❌ Not Mergeable (Severe Issues)

                  inlineComments must always be an array.

                  If there are no inline comments, return an empty array [].

                  Each item in inlineComments must include exactly these three fields: file, line, and comment.

                  Do not include extra fields, example values, or explanatory text.

                  Example Output:
                  {
                    "summary": "Status: ❌ Not Mergeable \n 1. Two naming issues found, please revise variable names. \n 2. One critical bug detected.",
                    "detail": "1. The code structure is generally clear and logical.\n2. Two variables use inconsistent naming conventions — consider switching to camelCase.\n3. One critical logic flaw may cause runtime errors.",
                    "inlineComments": [
                      {
                        "file": "/src/index.ts",
                        "line": 10,
                        "comment": "Variable names should follow camelCase convention."
                      }
                    ]
                  }
                `,
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
              Authorization: `Bearer ${this.getApiKey()}`,
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
                content:
                  'You are a project report generator. Please generate a concise daily report based on commit records.',
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
              Authorization: `Bearer ${this.getApiKey()}`,
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
