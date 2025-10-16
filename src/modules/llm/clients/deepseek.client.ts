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

  async generateReview(
    diff: string,
    commitMessages: string,
  ): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(diff, commitMessages);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl()}/chat/completions`,
          {
            model: this.getModel(),
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `
                你是一个专业的代码审查专家，请对代码进行详细审查并提供建设性建议，返回JSON格式数据, 格式如下：
                  {
                    "summary": "总结",
                    "detail": "详细建议",
                      "inlineComments": [
                        {
                          "file": "请填写实际文件路径",
                          "line": 请填写实际修改行号,
                          "comment": "请填写针对该行的具体评论"
                        }
                      ]
                  }
                  要求：
                  1. summary 尽量简洁明了，适合发送通知，要用 \n 实现正确的换行，不要超过5点建议 
                  2. detail 是详细的Review 意见，可用 markdown 格式
                  3. 状态可为：✅ 可合并（Minor）、⚠️ 可合并（存在优化）、❌ 不可合并（有严重问题）
                  4. inlineComments 必须是数组；如果没有行级评论，请返回空数组 []。
                  5. 每条 inlineComments 必须包含 file、line、comment,不要输出其他字段、示例值或多余文字。

                  示例输出：
                  {
                    "summary": "状态：❌ 不可合并 \n 1.存在 2 处命名不规范问题，建议修改变量名。 \n 2.存在 1 处严重缺陷",
                    "detail": "1. 代码结构清晰，逻辑正确。\n2. 存在 2 处命名不规范问题，建议修改变量名。\n3. 无潜在安全或性能问题。",
                    "inlineComments": [
                      {
                        "file": "/src/index.ts",
                        "line": 10,
                        "comment": "变量名应使用驼峰命名法"
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
