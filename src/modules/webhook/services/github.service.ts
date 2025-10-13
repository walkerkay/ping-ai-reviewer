import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GitHubWebhookDto } from '../dto/webhook.dto';

@Injectable()
export class GitHubService {
  private githubToken: string;
  private githubUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.githubToken = this.configService.get<string>('GITHUB_ACCESS_TOKEN');
    this.githubUrl = this.configService.get<string>('GITHUB_URL', 'https://api.github.com');
  }

  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    const url = `${this.githubUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/files`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }),
      );

      return response.data || [];
    } catch (error) {
      console.error('Failed to get pull request files:', error.message);
      console.error('Request URL:', url);
      console.error('Error details:', error.response?.data || error);
      return [];
    }
  }

  async getPullRequestCommits(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    const url = `${this.githubUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/commits`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }),
      );

      return response.data || [];
    } catch (error) {
      console.error('Failed to get pull request commits:', error.message);
      console.error('Request URL:', url);
      console.error('Error details:', error.response?.data || error);
      return [];
    }
  }

  async createPullRequestComment(owner: string, repo: string, pullNumber: number, body: string): Promise<boolean> {
    const url = `${this.githubUrl}/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { body },
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.status === 201;
    } catch (error) {
      console.error('Failed to create pull request comment:', error.message);
      return false;
    }
  }

  async createCommitComment(owner: string, repo: string, commitSha: string, body: string): Promise<boolean> {
    const url = `${this.githubUrl}/repos/${owner}/${repo}/commits/${commitSha}/comments`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { body },
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.status === 201;
    } catch (error) {
      console.error('Failed to create commit comment:', error.message);
      return false;
    }
  }

  async getCommitFiles(owner: string, repo: string, commitSha: string): Promise<any[]> {
    const url = `${this.githubUrl}/repos/${owner}/${repo}/commits/${commitSha}`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }),
      );

      return response.data.files || [];
    } catch (error) {
      console.error('Failed to get commit files:', error.message);
      console.error('Request URL:', url);
      console.error('Error details:', error.response?.data || error);
      return [];
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

