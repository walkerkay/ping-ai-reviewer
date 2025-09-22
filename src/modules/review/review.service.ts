import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LLMFactory } from '../llm/llm.factory';
import { NotificationService } from '../notification/notification.service';
import { GitLabService } from '../webhook/services/gitlab.service';
import { GitHubService } from '../webhook/services/github.service';

@Injectable()
export class ReviewService {
  private supportedExtensions: string[];

  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private notificationService: NotificationService,
    private gitlabService: GitLabService,
    private githubService: GitHubService,
  ) {
    this.supportedExtensions = this.configService
      .get<string>('SUPPORTED_EXTENSIONS', '.java,.py,.php')
      .split(',');
  }

  async handleMergeRequest(parsedData: any): Promise<void> {
    try {
      const { projectId, mergeRequestIid, projectName, author, sourceBranch, targetBranch, url, webhookData } = parsedData;

      // 获取变更文件
      const changes = await this.gitlabService.getMergeRequestChanges(projectId, mergeRequestIid);
      const filteredChanges = this.filterChanges(changes);

      if (filteredChanges.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 获取提交信息
      const commits = await this.gitlabService.getMergeRequestCommits(projectId, mergeRequestIid);
      const commitMessages = commits.map(commit => commit.message).join('; ');

      // 生成代码审查
      const reviewResult = await this.generateCodeReview(filteredChanges, commitMessages);

      // 保存到数据库
      const additions = filteredChanges.reduce((sum, change) => sum + (change.additions || 0), 0);
      const deletions = filteredChanges.reduce((sum, change) => sum + (change.deletions || 0), 0);
      const lastCommitId = commits[commits.length - 1]?.id || '';

      await this.databaseService.createMergeRequestReview({
        projectName,
        author,
        sourceBranch,
        targetBranch,
        updatedAt: Date.now(),
        commitMessages,
        score: this.calculateScore(reviewResult),
        url,
        reviewResult,
        urlSlug: this.slugifyUrl(url),
        webhookData,
        additions,
        deletions,
        lastCommitId,
      });

      // 添加评论到Merge Request
      await this.gitlabService.addMergeRequestNote(projectId, mergeRequestIid, reviewResult);

      // 发送通知
      await this.notificationService.sendNotification({
        content: reviewResult,
        title: `代码审查 - ${projectName}`,
        msgType: 'markdown',
      });

    } catch (error) {
      console.error('Merge request review failed:', error.message);
    }
  }

  async handlePullRequest(parsedData: any): Promise<void> {
    try {
      const { owner, repo, pullNumber, projectName, author, sourceBranch, targetBranch, url, webhookData } = parsedData;

      // 获取变更文件
      const files = await this.githubService.getPullRequestFiles(owner, repo, pullNumber);
      const filteredChanges = this.filterGitHubChanges(files);

      if (filteredChanges.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 获取提交信息
      const commits = await this.githubService.getPullRequestCommits(owner, repo, pullNumber);
      const commitMessages = commits.map(commit => commit.commit.message).join('; ');

      // 生成代码审查
      const reviewResult = await this.generateCodeReview(filteredChanges, commitMessages);

      // 保存到数据库
      const additions = filteredChanges.reduce((sum, change) => sum + (change.additions || 0), 0);
      const deletions = filteredChanges.reduce((sum, change) => sum + (change.deletions || 0), 0);

      await this.databaseService.createMergeRequestReview({
        projectName,
        author,
        sourceBranch,
        targetBranch,
        updatedAt: Date.now(),
        commitMessages,
        score: this.calculateScore(reviewResult),
        url,
        reviewResult,
        urlSlug: this.slugifyUrl(url),
        webhookData,
        additions,
        deletions,
        lastCommitId: '',
      });

      // 添加评论到Pull Request
      await this.githubService.createPullRequestComment(owner, repo, pullNumber, reviewResult);

      // 发送通知
      await this.notificationService.sendNotification({
        content: reviewResult,
        title: `代码审查 - ${projectName}`,
        msgType: 'markdown',
      });

    } catch (error) {
      console.error('Pull request review failed:', error.message);
    }
  }

  async handlePush(parsedData: any): Promise<void> {
    try {
      const pushReviewEnabled = this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';
      
      if (!pushReviewEnabled) {
        console.log('Push review is disabled');
        return;
      }

      const { projectName, author, branchName, commits, webhookData } = parsedData;

      if (!commits || commits.length === 0) {
        console.log('No commits found in push event');
        return;
      }

      // 获取变更文件
      let changes = [];
      if (parsedData.eventType === 'push' && parsedData.owner && parsedData.repo) {
        // GitHub push
        const lastCommit = commits[commits.length - 1];
        changes = await this.githubService.getCommitFiles(parsedData.owner, parsedData.repo, lastCommit.id);
        changes = this.filterGitHubChanges(changes);
      } else if (parsedData.eventType === 'push' && parsedData.projectId) {
        // GitLab push
        changes = await this.gitlabService.getRepositoryCompare(
          parsedData.projectId,
          parsedData.before,
          parsedData.after
        );
        changes = this.filterChanges(changes);
      }

      if (changes.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 生成代码审查
      const commitMessages = commits.map(commit => commit.message).join('; ');
      const reviewResult = await this.generateCodeReview(changes, commitMessages);

      // 保存到数据库
      const additions = changes.reduce((sum, change) => sum + (change.additions || 0), 0);
      const deletions = changes.reduce((sum, change) => sum + (change.deletions || 0), 0);

      await this.databaseService.createPushReview({
        projectName,
        author,
        branch: branchName,
        updatedAt: Date.now(),
        commitMessages,
        score: this.calculateScore(reviewResult),
        reviewResult,
        urlSlug: this.slugifyUrl(parsedData.projectUrl || ''),
        webhookData,
        additions,
        deletions,
      });

      // 添加评论到提交
      if (parsedData.eventType === 'push' && parsedData.owner && parsedData.repo) {
        // GitHub
        const lastCommit = commits[commits.length - 1];
        await this.githubService.createCommitComment(parsedData.owner, parsedData.repo, lastCommit.id, reviewResult);
      } else if (parsedData.eventType === 'push' && parsedData.projectId) {
        // GitLab
        const lastCommit = commits[commits.length - 1];
        await this.gitlabService.addCommitComment(parsedData.projectId, lastCommit.id, reviewResult);
      }

      // 发送通知
      await this.notificationService.sendNotification({
        content: reviewResult,
        title: `代码审查 - ${projectName}`,
        msgType: 'markdown',
      });

    } catch (error) {
      console.error('Push review failed:', error.message);
    }
  }

  private filterChanges(changes: any[]): any[] {
    return changes
      .filter(change => !change.deleted_file)
      .filter(change => 
        this.supportedExtensions.some(ext => 
          change.new_path?.endsWith(ext)
        )
      )
      .map(change => ({
        diff: change.diff || '',
        new_path: change.new_path,
        additions: this.countAdditions(change.diff || ''),
        deletions: this.countDeletions(change.diff || ''),
      }));
  }

  private filterGitHubChanges(files: any[]): any[] {
    return files
      .filter(file => 
        this.supportedExtensions.some(ext => 
          file.filename?.endsWith(ext)
        )
      )
      .map(file => ({
        diff: file.patch || '',
        new_path: file.filename,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
      }));
  }

  private countAdditions(diff: string): number {
    return (diff.match(/^\+(?!\+\+)/gm) || []).length;
  }

  private countDeletions(diff: string): number {
    return (diff.match(/^-(?!--)/gm) || []).length;
  }

  private async generateCodeReview(changes: any[], commitMessages: string): Promise<string> {
    const llmClient = this.llmFactory.getClient();
    
    // 合并所有变更的diff
    const combinedDiff = changes
      .map(change => `文件: ${change.new_path}\n${change.diff}`)
      .join('\n\n');

    return await llmClient.generateReview(combinedDiff, commitMessages);
  }

  private calculateScore(reviewResult: string): number {
    // 简单的评分逻辑，可以根据审查结果的内容来计算
    const positiveKeywords = ['good', 'excellent', 'well', 'nice', 'great', 'perfect'];
    const negativeKeywords = ['error', 'bug', 'issue', 'problem', 'wrong', 'bad'];
    
    const positiveCount = positiveKeywords.reduce((count, keyword) => 
      count + (reviewResult.toLowerCase().match(new RegExp(keyword, 'g')) || []).length, 0
    );
    const negativeCount = negativeKeywords.reduce((count, keyword) => 
      count + (reviewResult.toLowerCase().match(new RegExp(keyword, 'g')) || []).length, 0
    );
    
    // 基础分数 70，根据关键词调整
    let score = 70;
    score += positiveCount * 5;
    score -= negativeCount * 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private slugifyUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
