import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BaseGitClient } from './base-git.client';
import { GitClientConfig, GitClientType } from '../interfaces/git-client.interface';
import { GitHubWebhookDto } from '../../webhook/dto/webhook.dto';

@Injectable()
export class GitHubClient extends BaseGitClient {
  protected initializeConfig(): GitClientConfig {
    return {
      token: this.configService.get<string>('GITHUB_ACCESS_TOKEN'),
      url: this.configService.get<string>('GITHUB_URL', 'https://api.github.com'),
      type: GitClientType.GITHUB,
    };
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
    };
  }

  protected getApiBaseUrl(): string {
    return this.config.url;
  }

  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
    
    try {
      const data = await this.makeGetRequest(url);
      return data || [];
    } catch (error) {
      console.error('Failed to get pull request files:', error.message);
      return [];
    }
  }

  async getPullRequestCommits(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/pulls/${pullNumber}/commits`);
    
    try {
      const data = await this.makeGetRequest(url);
      return data || [];
    } catch (error) {
      console.error('Failed to get pull request commits:', error.message);
      return [];
    }
  }

  async createPullRequestComment(owner: string, repo: string, pullNumber: number, body: string): Promise<boolean> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`);
    
    try {
      await this.makePostRequest(url, { body });
      return true;
    } catch (error) {
      console.error('Failed to create pull request comment:', error.message);
      return false;
    }
  }

  async createCommitComment(owner: string, repo: string, commitSha: string, body: string): Promise<boolean> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/commits/${commitSha}/comments`);
    
    try {
      await this.makePostRequest(url, { body });
      return true;
    } catch (error) {
      console.error('Failed to create commit comment:', error.message);
      return false;
    }
  }

  async getCommitFiles(owner: string, repo: string, commitSha: string): Promise<any[]> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/commits/${commitSha}`);
    
    try {
      const data = await this.makeGetRequest(url);
      return data.files || [];
    } catch (error) {
      console.error('Failed to get commit files:', error.message);
      return [];
    }
  }

  /**
   * 获取指定路径的文件内容
   */
  async getContent(owner: string, repo: string, path: string, ref: string = 'main'): Promise<any> {
    const url = this.buildApiUrl(`/repos/${owner}/${repo}/contents/${path}`);
    
    try {
      const data = await this.makeGetRequest(url, { ref });
      return data;
    } catch (error) {
      console.error('Failed to get content:', error.message);
      return null;
    }
  }

  /**
   * 获取指定路径的文件内容（解码后的文本）
   */
  async getContentAsText(owner: string, repo: string, path: string, ref: string = 'main'): Promise<string | null> {
    try {
      const content = await this.getContent(owner, repo, path, ref);
      
      if (!content || !content.content) {
        return null;
      }

      // 解码 base64 内容
      const decodedContent = Buffer.from(content.content, 'base64').toString('utf-8');
      return decodedContent;
    } catch (error) {
      console.error('Failed to get content as text:', error.message);
      return null;
    }
  }

  parseWebhookData(webhookData: GitHubWebhookDto, eventType: string): any {
    if (eventType === 'pull_request') {
      return this.parsePullRequestEvent(webhookData);
    } else if (eventType === 'push') {
      return this.parsePushEvent(webhookData);
    }
    
    return null;
  }

  private parsePullRequestEvent(webhookData: GitHubWebhookDto): any {
    const pullRequest = webhookData.pull_request || {};
    const repository = webhookData.repository || {};
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';
    
    return {
      eventType: 'pull_request',
      action: webhookData.action,
      pullNumber: pullRequest.number,
      owner,
      repo,
      sourceBranch: pullRequest.head?.ref,
      targetBranch: pullRequest.base?.ref,
      projectName: repository.full_name,
      projectUrl: repository.html_url,
      author: pullRequest.user?.login,
      url: pullRequest.html_url,
      webhookData,
    };
  }

  private parsePushEvent(webhookData: GitHubWebhookDto): any {
    const repository = webhookData.repository || {};
    const ref = webhookData.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const commits = webhookData.commits || [];
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';
    
    return {
      eventType: 'push',
      owner,
      repo,
      branchName,
      projectName: repository.full_name,
      projectUrl: repository.html_url,
      commits,
      before: webhookData.before,
      after: webhookData.after,
      webhookData,
    };
  }
}
