/**
 * Git 客户端统一接口
 */
export interface GitClientInterface {
  /**
   * 获取 Pull Request/Merge Request 文件列表
   */
  getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<any[]>;

  /**
   * 获取 Pull Request/Merge Request 提交列表
   */
  getPullRequestCommits(owner: string, repo: string, pullNumber: number): Promise<any[]>;

  /**
   * 创建 Pull Request/Merge Request 评论
   */
  createPullRequestComment(owner: string, repo: string, pullNumber: number, body: string): Promise<boolean>;

  /**
   * 创建提交评论
   */
  createCommitComment(owner: string, repo: string, commitSha: string, body: string): Promise<boolean>;

  /**
   * 获取提交文件列表
   */
  getCommitFiles(owner: string, repo: string, commitSha: string): Promise<any[]>;

  /**
   * 获取指定路径的文件内容
   */
  getContent(owner: string, repo: string, path: string, ref?: string): Promise<any>;

  /**
   * 获取指定路径的文件内容（文本格式）
   */
  getContentAsText(owner: string, repo: string, path: string, ref?: string): Promise<string | null>;

  /**
   * 解析 Webhook 数据
   */
  parseWebhookData(webhookData: any, eventType?: string): any;
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
