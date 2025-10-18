import { Injectable } from '@nestjs/common';
import { BaseGitClient } from './base-git.client';
import {
  GitClientConfig,
  GitClientType,
} from '../interfaces/git-client.interface';
import { GitLabWebhookDto } from '../../webhook/dto/webhook.dto';

@Injectable()
export class GitLabClient extends BaseGitClient {
  protected initializeConfig(): GitClientConfig {
    return {
      token: this.configService.get<string>('GITLAB_ACCESS_TOKEN'),
      url: this.configService.get<string>('GITLAB_URL', 'https://gitlab.com'),
      type: GitClientType.GITLAB,
    };
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Private-Token': this.config.token,
    };
  }

  protected getApiBaseUrl(): string {
    return `${this.config.url}/api/v4`;
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any[]> {
    // GitLab 使用项目 ID 和 Merge Request IID
    const url = this.buildApiUrl(
      `/projects/${repo}/merge_requests/${pullNumber}/changes?access_raw_diffs=true`,
    );

    try {
      const data = await this.makeGetRequest(url);
      return data.changes || [];
    } catch (error) {
      console.error('Failed to get merge request changes:', error.message);
      return [];
    }
  }

  async getPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any[]> {
    const url = this.buildApiUrl(
      `/projects/${repo}/merge_requests/${pullNumber}/commits`,
    );

    try {
      const data = await this.makeGetRequest(url);
      return data || [];
    } catch (error) {
      console.error('Failed to get merge request commits:', error.message);
      return [];
    }
  }

  async createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<boolean> {
    const url = this.buildApiUrl(
      `/projects/${repo}/merge_requests/${pullNumber}/notes`,
    );

    try {
      await this.makePostRequest(url, { body });
      return true;
    } catch (error) {
      console.error('Failed to add merge request note:', error.message);
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
      `/projects/${repo}/repository/commits/${commitSha}/comments`,
    );

    try {
      await this.makePostRequest(url, { note: body });
      return true;
    } catch (error) {
      console.error('Failed to add commit comment:', error.message);
      return false;
    }
  }

  async getCommitFiles(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<any[]> {
    const url = this.buildApiUrl(
      `/projects/${repo}/repository/commits/${commitSha}`,
    );

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
  async getContent(
    owner: string,
    repo: string,
    path: string,
    ref: string = 'main',
  ): Promise<any> {
    const url = this.buildApiUrl(
      `/projects/${repo}/repository/files/${encodeURIComponent(path)}`,
    );

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

      // GitLab 也使用 base64 编码
      const decodedContent = Buffer.from(content.content, 'base64').toString(
        'utf-8',
      );
      return decodedContent;
    } catch (error) {
      console.error('Failed to get content as text:', error.message);
      return null;
    }
  }

  parseWebhookData(webhookData: GitLabWebhookDto, eventType?: string): any {
    const objectKind = webhookData.object_kind;

    if (objectKind === 'merge_request') {
      return this.parseMergeRequestEvent(webhookData);
    } else if (objectKind === 'push') {
      return this.parsePushEvent(webhookData);
    }

    return null;
  }

  private parseMergeRequestEvent(webhookData: GitLabWebhookDto): any {
    const objectAttributes = webhookData.object_attributes || {};
    const project = webhookData.project || {};

    return {
      eventType: 'merge_request',
      mergeRequestIid: objectAttributes.iid,
      projectId: objectAttributes.target_project_id,
      action: objectAttributes.action,
      sourceBranch: objectAttributes.source_branch,
      targetBranch: objectAttributes.target_branch,
      projectName: project.name,
      projectUrl: project.web_url,
      author:
        objectAttributes.author?.name ||
        objectAttributes.last_commit?.author?.name,
      url: objectAttributes.url,
      webhookData,
    };
  }

  private parsePushEvent(webhookData: GitLabWebhookDto): any {
    const project = webhookData.project || {};
    const ref = webhookData.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const commits = webhookData.commits || [];

    return {
      eventType: 'push',
      projectId: project.id,
      branchName,
      projectName: project.name,
      projectUrl: project.web_url,
      commits,
      before: webhookData.before,
      after: webhookData.after,
      webhookData,
    };
  }

  /**
   * 比较两个提交之间的差异
   */
  async getRepositoryCompare(
    projectId: string,
    before: string,
    after: string,
  ): Promise<any[]> {
    const url = this.buildApiUrl(
      `/projects/${projectId}/repository/compare?from=${before}&to=${after}`,
    );

    try {
      const data = await this.makeGetRequest(url);
      return data.diffs || [];
    } catch (error) {
      console.error('Failed to get repository compare:', error.message);
      return [];
    }
  }

  /**
   * GitLab 特有的方法：检查目标分支是否受保护
   */
  async isTargetBranchProtected(
    projectId: string,
    targetBranch: string,
  ): Promise<boolean> {
    const url = this.buildApiUrl(`/projects/${projectId}/protected_branches`);

    try {
      const data = await this.makeGetRequest(url);
      const protectedBranches = data || [];
      return protectedBranches.some((branch: any) =>
        this.matchesBranchPattern(targetBranch, branch.name),
      );
    } catch (error) {
      console.error('Failed to check protected branches:', error.message);
      return false;
    }
  }

  private matchesBranchPattern(branch: string, pattern: string): boolean {
    // 简单的通配符匹配实现
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(branch);
  }
}
