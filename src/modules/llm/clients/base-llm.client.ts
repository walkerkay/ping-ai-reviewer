import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InlineComment,
  LLMClient,
  LLMConfig,
  ReviewResult,
} from '../interfaces/llm-client.interface';

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
  ): Promise<ReviewResult>;

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

  /**
 * 解析 AI 生成的代码审查 JSON
 * @param aiOutput AI 输出的字符串
 * @returns ReviewResult 对象，包含整体报告和行级评论
 */
  protected parseReviewResult(aiOutput: string): ReviewResult {
    try {
      // 去掉多余空格和可能的 Markdown 代码块
      const cleaned = aiOutput
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '');

      const parsed = JSON.parse(cleaned);

      // 提取 summary
      const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
      // 提取 detail
      const detail = typeof parsed.detail === 'string' ? parsed.detail : '';

      // 提取 inlineComments 并过滤非法条目
      const inlineComments: InlineComment[] = Array.isArray(parsed.inlineComments)
        ? parsed.inlineComments
          .filter(c => c && c.file && typeof c.line === 'number' && c.comment)
          .map(c => ({
            file: c.file,
            line: c.line,
            comment: c.comment,
          }))
        : [];

      return { summary, detail: detail, inlineComments };
    } catch (error) {
      console.error('parse review result error:', error.message);
      // 返回默认空结构，避免程序中断
      return { summary: '', detail: '', inlineComments: [] };
    }
  }
}

