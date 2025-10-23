import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseLLMClient } from './base-llm.client';
import { LLMConfig, LLMReviewResult } from '../interfaces/llm-client.interface';
import { PromptBuilder } from '../prompts/prompt-builder';
import { ProjectConfig } from '@/modules/core/config';

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

  async generateReview(
    diff: string,
    commitMessages: string,
    references: string[],
    config: ProjectConfig,
  ): Promise<LLMReviewResult> {
    const promptMessages = PromptBuilder.buildReviewPrompt({
      language: config.review.language,
      mode: config.review.mode,
      max_review_length: config.review.max_review_length,
      diff,
      references,
      commitMessages
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl()}/chat/completions`,
          {
            model: this.getModel(),
            response_format: { type: 'json_object' },
            messages: promptMessages,
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
      try {
        const reviewResult = JSON.parse(
          response.data.choices[0].message.content,
        ) as LLMReviewResult;
        return reviewResult;
      } catch (error) {
        throw new Error(`parse review result error: ${error.message}`);
      }
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
                content:
                  '你是一个项目日报生成专家，请根据提交记录生成简洁明了的日报。',
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
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
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
