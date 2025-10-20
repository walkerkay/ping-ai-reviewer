import { merge } from 'lodash';
import { ProjectConfig } from './interfaces/config.interface';
import * as yaml from 'js-yaml';
import { logger } from '../logger';
export * from './interfaces/config.interface';

const defaultConfig: ProjectConfig = {
  version: '1.0',
  review: {
    enabled: true,
    language: 'zh',
    mode: 'strict',
    max_review_length: 4000,
    max_files: 50,
    max_content_length: 20000,
  },
  files: {
    extensions: [
      '.js',
      '.ts',
      '.vue',
      '.py',
      '.java',
      '.yml',
      '.json',
      '.md',
      '.sql',
    ],
    include: ['**/*'],
    exclude: [
      'dist/**/*',
      'node_modules/**/*',
      'test/**/*',
      '**/*.min.js',
      '**/*.min.css',
    ],
  },
  trigger: {
    events: ['pull_request', 'push'],
    branches: ['master', 'develop'],
    include_draft: false,
    ignore_rules: {
      title_contains: ['WIP', 'Draft', 'DO NOT REVIEW'],
      branch_matches: ['release/*'],
    },
  },
  integrations: {
    dingtalk: {
      notification: {
        enabled: true,
        template:
          '🚀 代码审查完成\n状态: {{ status }}\n问题数: {{ issues }}\n严重问题: {{ critical }}\n审查人: AI CodeReviewer',
      },
    },
    pingcode: {
      notification: {
        enabled: true,
        template:
          '🚀 代码审查完成\n状态: {{ status }}\n问题数: {{ issues }}\n严重问题: {{ critical }}\n审查人: AI CodeReviewer',
      },
      push_summary: {
        enabled: true,
        summary_field: 'ai_review_summary',
        template:
          '🚀 代码审查完成\n状态: {{ status }}\n问题数: {{ issues }}\n严重问题: {{ critical }}\n审查人: AI CodeReviewer',
      },
    },
  },
  references: [
    { path: './docs/code-style.md' },
    { url: 'https://example.com/security-guidelines' },
    { url: 'https://example.com/performance-checklist' },
  ],
};

export function parseConfig(yamlString: string): ProjectConfig {
  try {
    if (!yamlString) {
      return defaultConfig;
    }
    const parsedConfig = yaml.load(yamlString) as any;

    if (!parsedConfig || typeof parsedConfig !== 'object') {
      throw new Error(`Invalid YAML format: configuration must be an object`);
    }
    const mergedConfig = { ...defaultConfig, ...parsedConfig };
    return mergedConfig as ProjectConfig;
  } catch (error) {
    logger.warn(
      `Invalid YAML format: ${error.message}, use default config`,
      'ConfigParser',
    );
    return defaultConfig;
  }
}
