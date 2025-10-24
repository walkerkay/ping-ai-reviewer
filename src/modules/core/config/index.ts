import * as yaml from 'js-yaml';
import { logger } from '../logger';
import { ProjectConfig } from './interfaces/config.interface';
export * from './interfaces/config.interface';

const defaultConfig: ProjectConfig = {
  version: '1.0',
  review: {
    enabled: true,
    language: 'zh',
    mode: 'strict',
    max_output_tokens: 2000,
    max_input_tokens: 20000,
    max_files: 30,
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
    branches: ['master', 'develop', 'main'],
    include_draft: false,
    ignore_rules: {
      title_contains: ['WIP', 'Draft', 'DO NOT REVIEW'],
      branch_matches: ['release/*'],
    },
  },
  references: [],
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
