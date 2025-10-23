
export interface FileChange {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
}

export interface CommitInfo {
  id: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface PullRequestInfo {
  id: string;
  number: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  files: FileChange[];
  commits: CommitInfo[];
  webhookData: any;
  isDraft?: boolean;

}

export interface PushInfo {
  id: string;
  author: string;
  branch: string;
  url: string;
  files: FileChange[];
  commits: CommitInfo[];
  webhookData: any;
}

export interface ParsedWebhookData {
  clientType: GitClientType;
  eventType: 'pull_request' | 'push';
  owner: string;
  repo: string;
  pullNumber?: number;
  mergeRequestIid?: number;
  projectId?: string;
  projectName: string;
  author: string;
  sourceBranch?: string;
  targetBranch?: string;
  branchName?: string;
  url: string;
  state?: string;
  commits: CommitInfo[];
  webhookData: any;

}

export interface GitClientInterface {

  createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<boolean>;

  createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
  ): Promise<boolean>;

  createPullRequestLineComments(
    owner: string,
    repo: string,
    pullNumber: number,
    comments: Array<{
      path: string;
      line: number;
      body: string;
    }>): Promise<boolean>;

  getContentAsText(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;

  parseWebhookData(
    webhookData: any,
    eventType?: string,
  ): ParsedWebhookData | null;

  getPullRequestInfo(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<PullRequestInfo>;

  getPushInfo(
    owner: string,
    repo: string,
    commitSha: string
  ): Promise<PushInfo>;

  getCommitFiles(
    owner: string,
    repo: string,
    commitSha: string | string[],
  ): Promise<FileChange[]>;

}

/**
 * Git 客户端类型枚举
 */
export enum GitClientType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
}

/**
 * Git 客户端配置接口
 */
export interface GitClientConfig {
  token: string;
  url: string;
  type: GitClientType;
}

// 定义事件配置映射，集中管理不同平台的事件与状态规则
export const EVENT_CONFIG = {
  [GitClientType.GITLAB]: {
    pull_request: ['opened', 'reopened', 'synchronize', 'ready_for_review', 'open'],
    push: [] // push事件无需状态过滤
  },
  [GitClientType.GITHUB]: {
    pull_request: ['open', 'update', 'reopen', 'unmarked_as_draft'],
    push: [] // push事件无需状态过滤
  }
};
