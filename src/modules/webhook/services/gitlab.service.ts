import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GitLabWebhookDto } from '../dto/webhook.dto';

@Injectable()
export class GitLabService {
  private gitlabToken: string;
  private gitlabUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.gitlabToken = this.configService.get<string>('GITLAB_ACCESS_TOKEN');
    this.gitlabUrl = this.configService.get<string>('GITLAB_URL', 'https://gitlab.com');
  }

  async getMergeRequestChanges(projectId: string, mergeRequestIid: string): Promise<any[]> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/changes?access_raw_diffs=true`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Private-Token': this.gitlabToken,
          },
        }),
      );

      return response.data.changes || [];
    } catch (error) {
      console.error('Failed to get merge request changes:', error.message);
      return [];
    }
  }

  async getMergeRequestCommits(projectId: string, mergeRequestIid: string): Promise<any[]> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/commits`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Private-Token': this.gitlabToken,
          },
        }),
      );

      return response.data || [];
    } catch (error) {
      console.error('Failed to get merge request commits:', error.message);
      return [];
    }
  }

  async getMergeRequest(projectId: string, mergeRequestIid: string): Promise<any[]> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Private-Token': this.gitlabToken,
          },
        }),
      );

      return response.data || [];
    } catch (error) {
      console.error('Failed to get merge request detail:', error.message);
      return [];
    }
  }

  async addMergeRequestNote(projectId: string, mergeRequestIid: string, body: string): Promise<boolean> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { body },
          {
            headers: {
              'Private-Token': this.gitlabToken,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.status === 201;
    } catch (error) {
      console.error('Failed to add merge request note:', error.message);
      return false;
    }
  }

  async addMergeRequestDiscussions(projectId: string, mergeRequestIid: string, body: string, position: {
    baseSha: string;
    headSha: string;
    startSha: string;
    filePath: string;
    line: number;
  }): Promise<boolean> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            body, position: {
              position_type: "text",
              base_sha: position.baseSha,
              head_sha: position.headSha,
              start_sha: position.startSha,
              old_path: position.filePath,
              new_path: position.filePath,
              new_line: position.line,
            }
          },
          {
            headers: {
              'Private-Token': this.gitlabToken,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.status === 201;
    } catch (error) {
      console.error('Failed to add merge request discussions:', error.message);
      return false;
    }
  }

  async addCommitComment(projectId: string, commitId: string, note: string): Promise<boolean> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/repository/commits/${commitId}/comments`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { note },
          {
            headers: {
              'Private-Token': this.gitlabToken,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.status === 201;
    } catch (error) {
      console.error('Failed to add commit comment:', error.message);
      return false;
    }
  }

  async getRepositoryCompare(projectId: string, before: string, after: string): Promise<any[]> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/repository/compare?from=${before}&to=${after}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Private-Token': this.gitlabToken,
          },
        }),
      );

      return response.data.diffs || [];
    } catch (error) {
      console.error('Failed to get repository compare:', error.message);
      return [];
    }
  }

  async isTargetBranchProtected(projectId: string, targetBranch: string): Promise<boolean> {
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/protected_branches`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Private-Token': this.gitlabToken,
          },
        }),
      );

      const protectedBranches = response.data || [];
      return protectedBranches.some((branch: any) =>
        this.matchesBranchPattern(targetBranch, branch.name)
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

  parseWebhookData(webhookData: GitLabWebhookDto): any {
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
      author: objectAttributes.author?.name || objectAttributes.last_commit?.author?.name,
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
}

