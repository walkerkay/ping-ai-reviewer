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
import { GitHubWebhookDto } from '../../webhook/dto/webhook.dto';

@Injectable()
export class GitHubClient extends BaseGitClient {
  protected initializeConfig(): GitClientConfig {
    return {
      type: GitClientType.GITHUB,
      token: this.configService.get<string>('GITHUB_ACCESS_TOKEN'),
      url: this.configService.get<string>(
        'GITHUB_URL',
        'https://api.github.com',
      ),
    };
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github.v3+json',
    };
  }

  protected getApiBaseUrl(): string {
    return this.config.url;
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
    const url = this.buildApiUrl(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    );

    try {
      const data = await this.makeGetRequest(url);
      const files = data || [];
      return this.transformFiles(files);
    } catch (error) {
      console.error('Failed to get pull request files:', error.message);
      return [];
    }
  }

  private async getPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any[]> {
    const url = this.buildApiUrl(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/commits`,
    );

    try {
      const data = await this.makeGetRequest(url);
      return data || [];
    } catch (error) {
      console.error('Failed to get pull request commits:', error.message);
      return [];
    }
  }

  private async getPullRequestData(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    return await this.makeGetRequest(url);
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

  private async getCommitFiles(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<FileChange[]> {
    const url = this.buildApiUrl(
      `/repos/${owner}/${repo}/commits/${commitSha}`,
    );

    try {
      const data = await this.makeGetRequest(url);
      const files = data.files || [];
      return this.transformFiles(files);
    } catch (error) {
      console.error('Failed to get commit files:', error.message);
      return [];
    }
  }

  private async getCommitData(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<any> {
    const url = this.buildApiUrl(
      `/repos/${owner}/${repo}/commits/${commitSha}`,
    );
    return await this.makeGetRequest(url);
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
  ): ParsedWebhookData {
    const pullRequest = webhookData.pull_request || {};
    const repository = webhookData.repository || {};
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';

    return {
      clientType: GitClientType.GITHUB,
      eventType: 'pull_request',
      owner,
      repo,
      pullNumber: pullRequest.number,
      projectName: repository.full_name,
      author: pullRequest.user?.login || '',
      sourceBranch: pullRequest.head?.ref,
      targetBranch: pullRequest.base?.ref,
      url: pullRequest.html_url,
      commits: [], // 将在后续获取
      webhookData,
      state: pullRequest.state,
    };
  }

  private parsePushEvent(webhookData: GitHubWebhookDto): ParsedWebhookData {
    const repository = webhookData.repository || {};
    const ref = webhookData.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const commits = webhookData.commits || [];
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';

    return {
      clientType: GitClientType.GITHUB,
      eventType: 'push',
      owner,
      repo,
      projectName: repository.full_name,
      author:
        (webhookData as any).pusher?.name ||
        commits[0]?.author?.name ||
        'unknown',
      branchName,
      url: repository.html_url,
      commits: commits.map((commit) => ({
        id: commit.id,
        message: commit.message,
        author: commit.author?.name || 'unknown',
        timestamp: commit.timestamp,
      })),
      webhookData,
    };
  }

  parseWebhookData(
    webhookData: GitHubWebhookDto,
    eventType: string,
  ): ParsedWebhookData | null {
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
    const url = this.buildApiUrl(
      `/repos/${owner}/${repo}/issues/${pullNumber}/comments`,
    );

    try {
      await this.makePostRequest(url, { body });
      return true;
    } catch (error) {
      console.error('Failed to create pull request comment:', error.message);
      return false;
    }
  }

  async createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
  ): Promise<boolean> {
    const url = this.buildApiUrl(
      `/repos/${owner}/${repo}/commits/${commitSha}/comments`,
    );

    try {
      await this.makePostRequest(url, { body });
      return true;
    } catch (error) {
      console.error('Failed to create commit comment:', error.message);
      return false;
    }
  }

  private async getContent(
    owner: string,
    repo: string,
    path: string,
    ref: string = 'main',
  ): Promise<any> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/contents/${path}`);

    try {
      const data = await this.makeGetRequest(url, { ref });
      return data;
    } catch (error) {
      console.error('Failed to get content:', error.message);
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
      console.error('Failed to get content as text:', error.message);
      return null;
    }
  }
}
