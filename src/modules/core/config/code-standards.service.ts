import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { GitClientInterface } from '../../git/interfaces/git-client.interface';
import { logger } from '../logger';
import {
  CodeStandardsConfig,
  CodeStandardsRule,
  CodeStandardsSource,
} from './interfaces/config.interface';

@Injectable()
export class CodeStandardsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 加载并合并所有代码规范配置
   */
  async loadCodeStandards(
    sources: CodeStandardsSource[],
    gitClient?: GitClientInterface,
    owner?: string,
    repo?: string,
    ref?: string,
  ): Promise<CodeStandardsConfig> {
    if (!sources || sources.length === 0) {
      return { rules: [] };
    }

    // 按优先级排序
    const sortedSources = sources.sort(
      (a, b) => (a.priority || 100) - (b.priority || 100),
    );

    const allRules: CodeStandardsRule[] = [];
    const allCategories: {
      [key: string]: { name: string; description: string };
    } = {};

    for (const source of sortedSources) {
      try {
        const config = await this.loadSource(
          source,
          gitClient,
          owner,
          repo,
          ref,
        );
        if (config.rules) {
          allRules.push(...config.rules);
        }
        if (config.categories) {
          Object.assign(allCategories, config.categories);
        }
      } catch (error) {
        logger.warn(
          `Failed to load code standards from source: ${JSON.stringify(source)}, error: ${error.message}`,
          'CodeStandardsService',
        );
      }
    }

    return {
      rules: allRules,
      categories:
        Object.keys(allCategories).length > 0 ? allCategories : undefined,
    };
  }

  /**
   * 加载单个配置源
   */
  private async loadSource(
    source: CodeStandardsSource,
    gitClient?: GitClientInterface,
    owner?: string,
    repo?: string,
    ref?: string,
  ): Promise<CodeStandardsConfig> {
    let content: string;

    switch (source.type) {
      case 'inline':
        content = source.content || '';
        break;

      case 'file':
        content = await this.loadFromFile(
          source.path!,
          gitClient,
          owner,
          repo,
          ref,
        );
        break;

      case 'url':
        content = await this.loadFromUrl(source.url!);
        break;

      default:
        throw new Error(
          `Unsupported code standards source type: ${source.type}`,
        );
    }

    return this.parseContent(content, source.format || 'yaml');
  }

  /**
   * 从文件加载配置
   */
  private async loadFromFile(
    filePath: string,
    gitClient?: GitClientInterface,
    owner?: string,
    repo?: string,
    ref?: string,
  ): Promise<string> {
    if (gitClient && owner && repo && ref) {
      // 从 Git 仓库加载
      try {
        const content = await gitClient.getContentAsText(
          owner,
          repo,
          filePath,
          ref,
        );
        if (!content) {
          throw new Error(`File not found: ${filePath}`);
        }
        return content;
      } catch (error) {
        throw new Error(
          `Failed to load file from Git repository: ${error.message}`,
        );
      }
    } else {
      // 从本地文件系统加载
      try {
        const fullPath = path.resolve(filePath);
        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${fullPath}`);
        }
        return fs.readFileSync(fullPath, 'utf-8');
      } catch (error) {
        throw new Error(
          `Failed to load file from filesystem: ${error.message}`,
        );
      }
    }
  }

  /**
   * 从 URL 加载配置
   */
  private async loadFromUrl(url: string): Promise<string> {
    try {
      const response = await this.httpService.axiosRef.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Ping-AI-Reviewer/1.0',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to load from URL: ${error.message}`);
    }
  }

  /**
   * 解析配置内容
   */
  private parseContent(content: string, format: string): CodeStandardsConfig {
    if (!content.trim()) {
      return { rules: [] };
    }

    try {
      switch (format.toLowerCase()) {
        case 'yaml':
        case 'yml':
          return yaml.load(content) as CodeStandardsConfig;

        case 'json':
          return JSON.parse(content) as CodeStandardsConfig;

        case 'markdown':
        case 'text':
          return this.parseMarkdownContent(content);

        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse content as ${format}: ${error.message}`);
    }
  }

  /**
   * 解析 Markdown 格式的配置
   */
  private parseMarkdownContent(content: string): CodeStandardsConfig {
    const rules: CodeStandardsRule[] = [];
    const lines = content.split('\n');
    let currentRule: Partial<CodeStandardsRule> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测规则标题 (## 或 ###)
      if (line.match(/^#{2,3}\s+(.+)$/)) {
        if (currentRule && currentRule.id) {
          rules.push(currentRule as CodeStandardsRule);
        }

        const title = line.replace(/^#{2,3}\s+/, '');
        currentRule = {
          id: title.toLowerCase().replace(/\s+/g, '-'),
          name: title,
          description: '',
          severity: 'info',
          category: 'general',
        };
      }
      // 检测描述
      else if (currentRule && line && !line.startsWith('#')) {
        if (!currentRule.description) {
          currentRule.description = line;
        } else {
          currentRule.description += '\n' + line;
        }
      }
    }

    // 添加最后一个规则
    if (currentRule && currentRule.id) {
      rules.push(currentRule as CodeStandardsRule);
    }

    return { rules };
  }

  /**
   * 将代码规范配置转换为 LLM 可用的格式
   */
  formatForLLM(config: CodeStandardsConfig): string {
    if (!config.rules || config.rules.length === 0) {
      return '';
    }

    let formatted = '## 代码规范要求\n\n';

    // 按分类组织规则
    const rulesByCategory = config.rules.reduce(
      (acc, rule) => {
        if (!acc[rule.category]) {
          acc[rule.category] = [];
        }
        acc[rule.category].push(rule);
        return acc;
      },
      {} as { [key: string]: CodeStandardsRule[] },
    );

    for (const [category, rules] of Object.entries(rulesByCategory)) {
      const categoryInfo = config.categories?.[category];
      formatted += `### ${categoryInfo?.name || category}\n`;
      if (categoryInfo?.description) {
        formatted += `${categoryInfo.description}\n\n`;
      }

      for (const rule of rules) {
        formatted += `- **${rule.name}** (${rule.severity}): ${rule.description}\n`;

        if (rule.examples && rule.examples.length > 0) {
          formatted += `  - 示例：\n`;
          for (const example of rule.examples) {
            formatted += `    - ❌ 错误: \`${example.bad}\`\n`;
            formatted += `    - ✅ 正确: \`${example.good}\`\n`;
          }
        }
        formatted += '\n';
      }
    }

    return formatted;
  }
}
