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
    description?: string;
  }[];
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
