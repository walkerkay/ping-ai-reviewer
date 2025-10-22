import { Injectable } from '@nestjs/common';
import { BaseGitClient } from './base-git.client';
import {
  GitClientConfig,
  GitClientType,
  PullRequestInfo,
  PushInfo,
  FileChange,
  CommitInfo,
  ParsedWebhookData,
} from '../interfaces/git-client.interface';
import { GitLabWebhookDto } from '../../webhook/dto/webhook.dto';
import { DiffRefsSchema, Gitlab } from '@gitbeaker/rest';
import { logger } from '../../core/logger';

@Injectable()
export class GitLabClient extends BaseGitClient {

  private gitlab: InstanceType<typeof Gitlab>;

  protected initializeConfig(): GitClientConfig {
    const config = {
      token: this.configService.get<string>('GITLAB_ACCESS_TOKEN'),
      url: this.configService.get<string>('GITLAB_URL', 'https://gitlab.com'),
      type: GitClientType.GITLAB,
    };

    // 初始化 GitLab SDK 实例
    this.gitlab = new Gitlab({
      token: config.token,
      host: config.url,
    });

    return config;
  }

  private transformCommits(commits: any[]): CommitInfo[] {
    return commits.map((commit) => this.transformCommit(commit));
  }

  private transformCommit(commit: any): CommitInfo {
    return {
      id: commit.id || commit.sha,
      message: commit.message,
      author: commit.author_name || commit.author?.name || 'unknown',
      timestamp:
        commit.created_at || commit.timestamp || new Date().toISOString(),
    };
  }

  private getFileStatus(
    file: any,
  ): 'added' | 'modified' | 'removed' | 'renamed' {
    if (file.new_file) return 'added';
    if (file.deleted_file) return 'removed';
    if (file.renamed_file) return 'renamed';
    return 'modified';
  }

  private countAdditions(diff: string): number {
    return (diff.match(/^\+(?!\+\+)/gm) || []).length;
  }

  private countDeletions(diff: string): number {
    return (diff.match(/^-(?!--)/gm) || []).length;
  }

  private transformFiles(files: any[]): FileChange[] {
    return files.map((file) => ({
      filename: file.new_path || file.old_path || file.path,
      additions: file.additions ?? this.countAdditions(file.diff || ''),
      deletions: file.deletions ?? this.countDeletions(file.diff || ''),
      changes:
        this.countAdditions(file.diff || '') +
        this.countDeletions(file.diff || ''),
      patch: file.diff || '',
      status: this.getFileStatus(file),
    }));
  }


  private async getMergeRequestFiles(
    projectId: string,
    mergeRequestIid: number,
  ): Promise<FileChange[]> {
    try {
      const changes = await this.gitlab.MergeRequests.showChanges(
        projectId,
        mergeRequestIid,
      );
      const files = changes.changes || [];
      return this.transformFiles(files as any[]);
    } catch (error) {
      logger.error('Failed to get merge request changes:', 'GitLabClient', error.message);
      return [];
    }
  }

  private async getMergeRequestCommits(
    projectId: string,
    mergeRequestIid: number,
  ): Promise<any[]> {
    try {
      const commits = await this.gitlab.MergeRequests.allCommits(
        projectId,
        mergeRequestIid,
      );
      return commits || [];
    } catch (error) {
      logger.error('Failed to get merge request commits:', 'GitLabClient', error.message);
      return [];
    }
  }

  private async getMergeRequestData(
    projectId: string,
    mergeRequestIid: number,
  ): Promise<any> {
    try {
      const mergeRequest = await this.gitlab.MergeRequests.show(
        projectId,
        mergeRequestIid,
      );
      return mergeRequest;
    } catch (error) {
      logger.error('Failed to get merge request data:', 'GitLabClient', error.message);
      throw error;
    }
  }

  async getPullRequestInfo(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestInfo> {
    // GitLab 使用 projectId 作为 repo 参数
    const projectId = repo;
    const mergeRequestIid = pullNumber;
    const [mrData, files, commits] = await Promise.all([
      this.getMergeRequestData(projectId, mergeRequestIid),
      this.getMergeRequestFiles(projectId, mergeRequestIid),
      this.getMergeRequestCommits(projectId, mergeRequestIid),
    ]);

    return {
      id: mrData.id.toString(),
      number: mrData.iid,
      title: mrData.title,
      author: mrData.author.username,
      sourceBranch: mrData.source_branch,
      targetBranch: mrData.target_branch,
      url: mrData.web_url,
      files,
      commits: this.transformCommits(commits),
      webhookData: mrData,
      isDraft: false, // gitlab 没有 draft 概念
    };
  }

  private async getCommitData(
    projectId: string,
    commitSha: string,
  ): Promise<any> {
    try {
      const commit = await this.gitlab.Commits.show(projectId, commitSha);
      return commit;
    } catch (error) {
      logger.error('Failed to get commit data:', 'GitLabClient', error.message);
      throw error;
    }
  }

  async getCommitFiles(
    projectId: string,
    commitSha: string | string[],
  ): Promise<FileChange[]> {
    try {
      // 支持单个或多个 commitSha
      const commitShas = Array.isArray(commitSha) ? commitSha : [commitSha];
      
      // 并行获取所有 commit 的文件修改
      const commitFilesPromises = commitShas.map(async (sha) => {
        try {
          const changes = await this.gitlab.Commits.showDiff(projectId, sha);
          return this.transformFiles(changes);
        } catch (error) {
          logger.error(`Failed to get commit files for ${sha}:`, 'GitLabClient', error.message);
          return [];
        }
      });

      const allCommitFiles = await Promise.all(commitFilesPromises);
      
      // 合并所有文件修改
      return this.mergeFileChanges(allCommitFiles.flat());
    } catch (error) {
      logger.error('Failed to get commit files:', 'GitLabClient', error.message);
      return [];
    }
  }

  async getPushInfo(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<PushInfo> {
    // GitLab 使用 projectId 作为 repo 参数
    const projectId = repo;
    const [commitData, files] = await Promise.all([
      this.getCommitData(projectId, commitSha),
      this.getCommitFiles(projectId, commitSha),
    ]);

    return {
      id: commitSha,
      author: commitData.author_name,
      branch: commitData.branch || 'unknown',
      url: commitData.web_url,
      files, // 已经是过滤后的 FileChange[] 类型
      commits: [this.transformCommit(commitData)],
      webhookData: commitData,
    };
  }

  async createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<boolean> {
    // GitLab 使用 projectId 作为 repo 参数
    const projectId = repo;
    try {
      await this.gitlab.MergeRequestNotes.create(projectId, pullNumber, body);
      return true;
    } catch (error) {
      logger.error('Failed to add merge request note:', 'GitLabClient', error.message);
      return false;
    }
  }

  private async getDiffRefs(repo: string, pullNumber: number) {
    const mergeRequest = await this.gitlab.MergeRequests.show(repo, pullNumber);
    const { base_sha, head_sha, start_sha } = mergeRequest.diff_refs as DiffRefsSchema;
    return { base_sha, head_sha, start_sha };
  }

  async createPullRequestLineComments(
    owner: string,
    repo: string,
    pullNumber: number,
    comments: Array<{ path: string; line: number; body: string; }>
  ): Promise<boolean> {
    const projectId = repo;
    const { base_sha, head_sha, start_sha } = await this.getDiffRefs(projectId, pullNumber);
    for (const comment of comments) {
      try {
        await this.gitlab.MergeRequestDiscussions.create(
          projectId,
          pullNumber,
          comment.body,
          {
            position: {
              positionType: "text",
              baseSha: base_sha,
              startSha: head_sha,
              headSha: start_sha,
              new_path: comment.path,
              new_line: comment.line,
            },
          }
        );
      } catch (error) {
        logger.error('Failed to add merge request discussion:', 'GitLabClient', error.message);
      }
    }
    return true;

  }

  async createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
  ): Promise<boolean> {
    // GitLab 使用 projectId 作为 repo 参数
    const projectId = repo;
    try {
      await this.gitlab.Commits.createComment(projectId, commitSha, body);
      return true;
    } catch (error) {
      logger.error('Failed to add commit comment:', 'GitLabClient', error.message);
      return false;
    }
  }

  private async getContent(
    projectId: string,
    path: string,
    ref: string = 'main',
  ): Promise<any> {
    try {
      const content = await this.gitlab.RepositoryFiles.show(
        projectId,
        path,
        ref,
      );
      return content;
    } catch (error) {
      logger.error('Failed to get content:', 'GitLabClient', error.message);
      return null;
    }
  }

  async getContentAsText(
    owner: string,
    repo: string,
    path: string,
    ref: string = 'main',
  ): Promise<string | null> {
    // GitLab 使用 projectId 作为 repo 参数
    const projectId = repo;
    try {
      const content = await this.getContent(projectId, path, ref);

      if (!content || !content.content) {
        return null;
      }

      // GitLab 也使用 base64 编码
      const decodedContent = Buffer.from(content.content, 'base64').toString(
        'utf-8',
      );
      return decodedContent;
    } catch (error) {
      logger.error('Failed to get content as text:', 'GitLabClient', error.message);
      return null;
    }
  }

  parseWebhookData(
    webhookData: GitLabWebhookDto,
    eventType?: string,
  ): ParsedWebhookData | null {
    const objectKind = webhookData.object_kind;

    if (objectKind === 'merge_request') {
      return this.parseMergeRequestEvent(webhookData);
    } else if (objectKind === 'push') {
      return this.parsePushEvent(webhookData);
    }

    return null;
  }

  private parseMergeRequestEvent(
    webhookData: GitLabWebhookDto,
  ): ParsedWebhookData {
    const objectAttributes = webhookData.object_attributes || {};
    const project = webhookData.project || {};

    return {
      clientType: GitClientType.GITLAB,
      eventType: 'pull_request',
      owner: project.path_with_namespace?.split('/')[0] || '',
      projectId: project.id?.toString() || '',
      repo: project.id?.toString() || '',
      mergeRequestIid: objectAttributes.iid,
      projectName: project.name,
      author:
        objectAttributes.author?.name ||
        objectAttributes.last_commit?.author?.name ||
        '',
      sourceBranch: objectAttributes.source_branch,
      targetBranch: objectAttributes.target_branch,
      url: objectAttributes.url,
      state: objectAttributes.action,
      commits: [], // 将在后续获取
      webhookData,
    };
  }

  private parsePushEvent(webhookData: GitLabWebhookDto): ParsedWebhookData {
    const project = webhookData.project || {};
    const ref = webhookData.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const commits = webhookData.commits || [];

    return {
      clientType: GitClientType.GITLAB,
      eventType: 'push',
      owner: project.path_with_namespace?.split('/')[0] || '',
      projectId: project.id?.toString() || '',
      repo: project.id?.toString() || '',
      projectName: project.name,
      author:
        (webhookData as any).user_name || commits[0]?.author?.name || 'unknown',
      branchName,
      url: project.web_url,
      commits: commits.map((commit) => ({
        id: commit.id,
        message: commit.message,
        author: commit.author?.name || 'unknown',
        timestamp: commit.timestamp,
      })),
      webhookData,
    };
  }
}
