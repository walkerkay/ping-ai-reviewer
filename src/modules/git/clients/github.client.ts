import { Injectable } from '@nestjs/common';
import { BaseGitClient } from './base-git.client';
import {
  GitClientConfig,
  GitClientType,
  PullRequestInfo,
  PushInfo,
  FileChange,
  CommitInfo,
} from '../interfaces/git-client.interface';
import { GitHubWebhookDto } from '../../webhook/dto/webhook.dto';
import { Octokit } from '@octokit/rest';
import { logger } from '../../core/logger';
import { ParsedPullRequestReviewData, ParsedPushReviewData } from '../interfaces/review.interface';

@Injectable()
export class GitHubClient extends BaseGitClient {
  private octokit: Octokit;

  protected initializeConfig(accessToken?: string): GitClientConfig {
    const config = {
      type: GitClientType.GITHUB,
      token: accessToken ?? this.configService.get<string>('GITHUB_ACCESS_TOKEN'),
      url: this.configService.get<string>(
        'GITHUB_URL',
        'https://api.github.com',
      ),
    };

    // 初始化 Octokit 实例
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.url,
    });

    return config;
  }

  private transformFiles(files: any[]): FileChange[] {
    return files.map((file) => ({
      filename: file.filename,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      patch: file.patch || '',
      status: this.getFileStatus(file.status),
    }));
  }

  private transformCommits(commits: any[]): CommitInfo[] {
    return commits.map((commit) => this.transformCommit(commit));
  }

  private transformCommit(commit: any): CommitInfo {
    return {
      id: commit.sha || commit.id,
      message: commit.commit?.message || commit.message,
      author: commit.commit?.author?.name || commit.author?.login || 'unknown',
      timestamp:
        commit.commit?.author?.date ||
        commit.timestamp ||
        new Date().toISOString(),
    };
  }

  private getFileStatus(
    status: string,
  ): 'added' | 'modified' | 'removed' | 'renamed' {
    switch (status) {
      case 'added':
        return 'added';
      case 'modified':
        return 'modified';
      case 'removed':
        return 'removed';
      case 'renamed':
        return 'renamed';
      default:
        return 'modified';
    }
  }


  private async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<FileChange[]> {
    try {
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });
      return this.transformFiles(files || []);
    } catch (error) {
      logger.error(
        'Failed to get pull request files:',
        'GitHubClient',
        error.message,
      );
      return [];
    }
  }

  private async getPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any[]> {
    try {
      const { data: commits } = await this.octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
      });
      return commits || [];
    } catch (error) {
      logger.error(
        'Failed to get pull request commits:',
        'GitHubClient',
        error.message,
      );
      return [];
    }
  }

  private async getPullRequestData(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any> {
    try {
      const { data: prData } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });
      return prData;
    } catch (error) {
      logger.error(
        'Failed to get pull request data:',
        'GitHubClient',
        error.message,
      );
      throw error;
    }
  }

  async getPullRequestInfo(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestInfo> {
    const [prData, files, commits] = await Promise.all([
      this.getPullRequestData(owner, repo, pullNumber),
      this.getPullRequestFiles(owner, repo, pullNumber),
      this.getPullRequestCommits(owner, repo, pullNumber),
    ]);

    return {
      id: prData.id.toString(),
      number: prData.number,
      title: prData.title,
      author: prData.user.login,
      sourceBranch: prData.head.ref,
      targetBranch: prData.base.ref,
      url: prData.html_url,
      files,
      commits: this.transformCommits(commits),
      webhookData: prData,
      isDraft: prData.draft || false,
    };
  }

  async getCommitFiles(
    owner: string,
    repo: string,
    commitSha: string | string[],
  ): Promise<FileChange[]> {
    try {
      // 支持单个或多个 commitSha
      const commitShas = Array.isArray(commitSha) ? commitSha : [commitSha];

      // 并行获取所有 commit 的文件修改
      const commitFilesPromises = commitShas.map(async (sha) => {
        try {
          const { data: commitData } = await this.octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: sha,
          });
          const files = commitData.files || [];
          return this.transformFiles(files);
        } catch (error) {
          logger.error(
            `Failed to get commit files for ${sha}:`,
            'GitHubClient',
            error.message,
          );
          return [];
        }
      });

      const allCommitFiles = await Promise.all(commitFilesPromises);

      // 合并所有文件修改
      return this.mergeFileChanges(allCommitFiles.flat());
    } catch (error) {
      logger.error(
        'Failed to get commit files:',
        'GitHubClient',
        error.message,
      );
      return [];
    }
  }

  private async getCommitData(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<any> {
    try {
      const { data: commitData } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });
      return commitData;
    } catch (error) {
      logger.error('Failed to get commit data:', 'GitHubClient', error.message);
      throw error;
    }
  }

  async getPushInfo(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<PushInfo> {
    const [commitData, files] = await Promise.all([
      this.getCommitData(owner, repo, commitSha),
      this.getCommitFiles(owner, repo, commitSha),
    ]);

    return {
      id: commitSha,
      author: commitData.author.login,
      branch: commitData.branch || 'unknown',
      url: commitData.html_url,
      files,
      commits: [this.transformCommit(commitData)],
      webhookData: commitData,
    };
  }

  private parsePullRequestEvent(
    webhookData: GitHubWebhookDto,
  ): ParsedPullRequestReviewData {
    const pullRequest = webhookData.pull_request || {};
    const repository = webhookData.repository || {};
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';
    const commits = webhookData.commits || [];
    const commitId = commits.length > 0 ? commits[commits.length - 1].id : "";
    return {
      owner,
      repo,
      mrNumber: pullRequest.number,
      projectName: repository.full_name,
      sourceBranch: pullRequest.head?.ref,
      targetBranch: pullRequest.base?.ref,
      mrState: pullRequest.state,
      commitId: commitId,
      eventType: 'pull_request'
    };
  }

  private parsePushEvent(webhookData: GitHubWebhookDto): ParsedPushReviewData {
    const repository = webhookData.repository || {};
    const ref = webhookData.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const commits = webhookData.commits || [];
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';
    const commitId = commits.length > 0 ? commits[commits.length - 1].id : "";

    return {
      owner,
      repo,
      projectName: repository.full_name,
      branch: branchName,
      commitId: commitId,
      eventType: 'push'
    };
  }

  parseWebhookData(
    webhookData: GitHubWebhookDto,
    eventType: string,
  ): ParsedPullRequestReviewData | ParsedPushReviewData | null{
    if (eventType === 'pull_request') {
      return this.parsePullRequestEvent(webhookData);
    } else if (eventType === 'push') {
      return this.parsePushEvent(webhookData);
    }

    return null;
  }

  async createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<boolean> {
    try {
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
      return true;
    } catch (error) {
      logger.error(
        'Failed to create pull request comment:',
        'GitHubClient',
        error.message,
      );
      return false;
    }
  }

  async createPullRequestLineComments(
    owner: string,
    repo: string,
    pullNumber: number,
    comments: Array<{
      path: string;
      line: number;
      body: string;
    }>
  ): Promise<boolean> {
    try {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        comments,
        event: "COMMENT",
      });
      return true;
    }
    catch (error) {
      logger.error('Failed to create pull review comment:', 'GitHubClient', error.message);
      return false;
    }
  }

  async createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
  ): Promise<boolean> {
    try {
      await this.octokit.rest.repos.createCommitComment({
        owner,
        repo,
        commit_sha: commitSha,
        body,
      });
      return true;
    } catch (error) {
      logger.error(
        'Failed to create commit comment:',
        'GitHubClient',
        error.message,
      );
      return false;
    }
  }

  private async getContent(
    owner: string,
    repo: string,
    path: string,
    ref: string = 'main',
  ): Promise<any> {
    try {
      const { data: content } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      return content;
    } catch (error) {
      logger.error('Failed to get content:', 'GitHubClient', error.message);
      return null;
    }
  }

  async getContentAsText(
    owner: string,
    repo: string,
    path: string,
    ref: string = 'main',
  ): Promise<string | null> {
    try {
      const content = await this.getContent(owner, repo, path, ref);

      if (!content || !content.content) {
        return null;
      }

      const decodedContent = Buffer.from(content.content, 'base64').toString(
        'utf-8',
      );
      return decodedContent;
    } catch (error) {
      logger.error(
        'Failed to get content as text:',
        'GitHubClient',
        error.message,
      );
      return null;
    }
  }
}
