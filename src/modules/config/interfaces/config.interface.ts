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
    auto: boolean;
    events: ('pull_request' | 'push')[];
    branches: string[];
    include_draft: boolean;
    ignore_rules: {
      title_contains: string[];
      branch_matches: string[];
    };
  };
  integrations: {
    dingtalk?: IntegrationConfig;
    pingcode?: IntegrationConfig;
  };
  references?: {
    path?: string;
    url?: string;
  }[];
}

export interface IntegrationConfig {
  notification: {
    enabled: boolean;
    message_template: string;
  };
  push_summary?: {
    enabled: boolean;
    summary_field: string;
    template: string;
  };
}
