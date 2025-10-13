import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseLLMClient } from './base-llm.client';
import { LLMConfig } from '../interfaces/llm-client.interface';

@Injectable()
export class DeepSeekClient extends BaseLLMClient {
  constructor(
    configService: ConfigService,
    private httpService: HttpService,
  ) {
    super(configService, 'deepseek');
  }

  protected getConfig(): LLMConfig {
    return {
      apiKey: this.getApiKey(),
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-coder',
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
                content: '你是一个专业的代码审查专家，请对代码进行详细审查并提供建设性建议。',
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
      throw new Error(`DeepSeek API error: ${error.message}`);
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
                content: '你是一个项目日报生成专家，请根据提交记录生成简洁明了的日报。',
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
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
  }

  private buildReviewPrompt(diff: string, commitMessages: string): string {
    return `
请对以下代码变更进行审查：

提交信息：${commitMessages}

代码变更：
\`\`\`
${diff}
\`\`\`

请从以下角度进行审查：
1. 代码质量和规范性
2. 潜在的安全问题
3. 性能优化建议
4. 可维护性和可读性
5. 最佳实践建议

请提供具体的改进建议和代码示例。
    `.trim();
  }

  private buildReportPrompt(commits: any[]): string {
    return `
请根据以下提交记录生成项目日报：

提交记录：
${JSON.stringify(commits, null, 2)}

请生成包含以下内容的日报：
1. 今日提交概览
2. 主要功能开发
3. 代码质量统计
4. 开发者贡献情况
5. 需要关注的问题

请使用简洁明了的语言，适合团队分享。
    `.trim();
  }
}

