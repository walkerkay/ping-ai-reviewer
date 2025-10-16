import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseLLMClient } from './base-llm.client';
import { LLMConfig, ReviewResult } from '../interfaces/llm-client.interface';

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

      return this.parseReviewResult(response.data.choices[0].message.content);
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
你是一名资深代码审查专家，请对以下代码变更进行专业审查。

提交信息：
${commitMessages}

代码变更（标准 Git diff 格式）：
\`\`\`diff
${diff}
\`\`\`

请从以下角度进行审查：
1. 代码质量与规范性
2. 潜在的安全问题
3. 性能优化
4. 可维护性与可读性
5. 最佳实践

输出要求：
- 仅返回一个 JSON 对象，不要输出任何额外说明或 Markdown。
- JSON 格式如下：
{
  "overall": "请写一条综合性代码审查报告，可以包含多条改进建议、分析说明、Markdown 格式列表以及代码段示例。",
  "inlineComments": [
    {
      "file": "请填写实际文件路径",
      "line": 请填写实际修改行号,
      "comment": "请填写针对该行的具体评论"
    }
  ]
}
- overall 字段应包含详细审查报告，可包含：
  - 多条具体改进建议
  - Markdown 格式（如列表、标题、强调）
  - 代码段示例（用 \`\`\` 包裹）
- inlineComments 必须是数组；如果没有行级评论，请返回空数组 []。
- 每条 inlineComments 必须包含 file、line、comment。
- 不要输出其他字段、示例值或多余文字。
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

