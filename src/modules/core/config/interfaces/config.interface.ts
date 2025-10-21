export interface ProjectConfig {
  version: string;
  review: {
    enabled: boolean;
    language: 'zh' | 'en';
    mode: 'light' | 'strict';
    max_review_length: number;
    max_files: number;
    max_content_length: number;
  };
  files: {
    extensions: string[];
    include: string[];
    exclude: string[];
  };
  trigger: {
    events: ('pull_request' | 'push')[];
    branches: string[];
    include_draft: boolean;
    ignore_rules: {
      title_contains: string[];
      branch_matches: string[];
    };
  };
  integrations?: {
    dingtalk?: ProjectIntegrationConfig;
    pingcode?: ProjectIntegrationConfig;
    wecom?: ProjectIntegrationConfig;
    feishu?: ProjectIntegrationConfig;
  };
  references?: {
    path?: string;
    url?: string;
  }[];
  codeStandards?: {
    enabled: boolean;
    sources: CodeStandardsSource[];
  };
}

export type ProjectFilesConfig = ProjectConfig['files'];

export type ProjectTriggerConfig = ProjectConfig['trigger'];

export type ProjectReviewConfig = ProjectConfig['review'];

export interface ProjectIntegrationConfig {
  enabled: boolean;
  notification: {
    webhookUrl?: string;
    template?: string;
  };
  push_summary?: {
    enabled: boolean;
    summary_field: string;
    template?: string;
  };
}

export interface CodeStandardsSource {
  type: 'inline' | 'file' | 'url';
  content?: string;
  path?: string;
  url?: string;
  format?: 'yaml' | 'json' | 'markdown' | 'text';
  priority?: number; // 优先级，数字越小优先级越高
}

export interface CodeStandardsRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  patterns?: string[];
  examples?: {
    bad: string;
    good: string;
  }[];
}

export interface CodeStandardsConfig {
  rules: CodeStandardsRule[];
  categories?: {
    [key: string]: {
      name: string;
      description: string;
    };
  };
  metadata?: {
    version: string;
    lastUpdated: string;
    author?: string;
  };
}
