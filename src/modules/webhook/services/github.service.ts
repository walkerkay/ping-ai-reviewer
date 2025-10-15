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
    console.log('=== GITHUB SERVICE - parseWebhookData ===');
    console.log('Event type:', eventType);
    console.log('Webhook data structure:', {
      hasPullRequest: !!webhookData.pull_request,
      hasRepository: !!webhookData.repository,
      hasCommits: !!webhookData.commits,
      hasRef: !!webhookData.ref,
      keys: Object.keys(webhookData)
    });
    
    if (eventType === 'pull_request') {
      console.log('Parsing pull request event...');
      const result = this.parsePullRequestEvent(webhookData);
      console.log('Pull request parsed result:', JSON.stringify(result, null, 2));
      return result;
    } else if (eventType === 'push') {
      console.log('Parsing push event...');
      const result = this.parsePushEvent(webhookData);
      console.log('Push parsed result:', JSON.stringify(result, null, 2));
      return result;
    }
    
    console.log('Unsupported event type:', eventType);
    return null;
  }

  private parsePullRequestEvent(webhookData: GitHubWebhookDto): any {
    console.log('=== GITHUB SERVICE - parsePullRequestEvent ===');
    console.log('Raw webhook data:', JSON.stringify(webhookData, null, 2));
    
    const pullRequest = webhookData.pull_request || {};
    const repository = webhookData.repository || {};
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';
    
    console.log('Parsed values:', {
      action: webhookData.action,
      pullNumber: pullRequest.number,
      owner,
      repo,
      sourceBranch: pullRequest.head?.ref,
      targetBranch: pullRequest.base?.ref,
      projectName: repository.full_name,
      author: pullRequest.user?.login,
      url: pullRequest.html_url
    });
    
    const result = {
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
    
    console.log('Final parsed result:', JSON.stringify(result, null, 2));
    return result;
  }

  private parsePushEvent(webhookData: GitHubWebhookDto): any {
    console.log('=== GITHUB SERVICE - parsePushEvent ===');
    console.log('Raw webhook data:', JSON.stringify(webhookData, null, 2));
    
    const repository = webhookData.repository || {};
    const ref = webhookData.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const commits = webhookData.commits || [];
    const owner = repository.owner?.login || '';
    const repo = repository.name || '';
    
    console.log('Parsed values:', {
      ref,
      branchName,
      owner,
      repo,
      projectName: repository.full_name,
      commitsCount: commits.length,
      before: webhookData.before,
      after: webhookData.after
    });
    
    const result = {
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
    
    console.log('Final parsed result:', JSON.stringify(result, null, 2));
    return result;
  }
}

