import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GitClientInterface,
  GitClientConfig,
  PullRequestInfo,
  PushInfo,
  FileChange,
} from '../interfaces/git-client.interface';

@Injectable()
export abstract class BaseGitClient implements GitClientInterface {
  protected config: GitClientConfig;

  constructor(protected configService: ConfigService) {
    this.config = this.initializeConfig();
  }

  protected abstract initializeConfig(): GitClientConfig;

 
  abstract getPullRequestInfo(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestInfo>;

  abstract getPushInfo(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<PushInfo>;

  abstract getCommitFiles(
    owner: string,
    repo: string,
    commitSha: string | string[],
  ): Promise<FileChange[]>;

  abstract createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<boolean>;

  abstract commentOnLines(
    owner: string,
    repo: string,
    pullNumber: number,
    comments: Array<{
      path: string;
      line: number;
      body: string;
    }>): Promise<boolean>;

  abstract createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
  ): Promise<boolean>;

  abstract getContentAsText(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;

  abstract parseWebhookData(webhookData: any, eventType?: string): any;

  /**
   * 合并相同文件的修改
   */
  protected mergeFileChanges(files: FileChange[]): FileChange[] {
    const fileMap = new Map<string, FileChange>();

    files.forEach((file) => {
      const key = file.filename;
      if (fileMap.has(key)) {
        // 合并同一文件的修改
        const existing = fileMap.get(key);
        fileMap.set(key, {
          filename: file.filename,
          additions: existing.additions + file.additions,
          deletions: existing.deletions + file.deletions,
          changes: existing.changes + file.changes,
          patch: file.patch, // 使用最新的 patch
          status: file.status, // 使用最新的状态
        });
      } else {
        fileMap.set(key, file);
      }
    });

    return Array.from(fileMap.values());
  }
}
