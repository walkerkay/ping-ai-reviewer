import { ProjectConfig } from './interfaces/config.interface';

export const getConfigFilePath = (ext: string = 'yaml') => {
  return `.codereview.${ext}`;
};

export const defaultConfig: ProjectConfig = {
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
    include: ['src/**/*', 'app/**/*'],
    exclude: ['dist/**/*', 'node_modules/**/*', 'test/**/*', '**/*.min.js'],
  },
  trigger: {
    auto: true,
    events: ['pull_request', 'push'],
    branches: ['develop'],
    include_draft: false,
    ignore_rules: {
      title_contains: ['WIP', 'Draft', 'DO NOT REVIEW'],
      branch_matches: [
        'feature/*',
        'hotfix/*',
        'release/*',
        'master',
        'main',
        'develop',
      ],
    },
  },
  integrations: {
    dingtalk: {
      notification: {
        enabled: true,
        message_template:
          '🚀 代码审查完成\n状态: {{ status }}\n问题数: {{ issues }}\n严重问题: {{ critical }}\n审查人: AI CodeReviewer',
      },
    },
    pingcode: {
      notification: {
        enabled: true,
        message_template:
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
