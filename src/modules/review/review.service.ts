import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LLMFactory } from '../llm/llm.factory';
import { NotificationService } from '../notification/notification.service';
import { GitLabService } from '../webhook/services/gitlab.service';
import { GitHubService } from '../webhook/services/github.service';
import * as crypto from 'crypto';

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
      console.log('=== REVIEW SERVICE - handlePullRequest ===');
      console.log('Parsed data received:', JSON.stringify(parsedData, null, 2));
      
      const { action, pullNumber, owner, repo, projectName, author, sourceBranch, targetBranch, url, webhookData } = parsedData;
      console.log('Extracted values:', {
        action,
        pullNumber,
        owner,
        repo,
        projectName,
        author,
        sourceBranch,
        targetBranch,
        url,
        hasWebhookData: !!webhookData
      });

      if(action === 'closed') {
        console.log('Pull request is closed, skipping review');
        return;
      }

      // 获取变更文件
      console.log('Getting pull request files...');
      console.log('Request parameters:', { owner, repo, pullNumber });
      
      const files = await this.githubService.getPullRequestFiles(owner, repo, pullNumber);
      console.log('Raw files from GitHub:', files.length, 'files');
      console.log('Files details:', files.map(f => ({ filename: f.filename, additions: f.additions, deletions: f.deletions })));
      
      const filteredChanges = this.filterGitHubChanges(files);
      console.log('Filtered changes:', filteredChanges.length, 'files');

      if (filteredChanges.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 生成文件变更哈希
      console.log('Generating files hash...');
      const filesHash = this.generateFilesHash(filteredChanges);
      console.log('Files hash:', filesHash);

      // 检查是否已经存在相同的文件变更
      console.log('Checking for existing review...');
      const hasExistingReview = await this.databaseService.checkMergeRequestFilesHashExists(
        projectName,
        sourceBranch,
        targetBranch,
        filesHash
      );
      console.log('Has existing review:', hasExistingReview);

      if (hasExistingReview) {
        console.log('Files have not changed, skipping review generation');
        return;
      }

      // 获取提交信息
      console.log('Getting pull request commits...');
      const commits = await this.githubService.getPullRequestCommits(owner, repo, pullNumber);
      console.log('Commits count:', commits.length);
      const commitMessages = commits.map(commit => commit.commit.message).join('; ');
      console.log('Commit messages:', commitMessages);

      // 生成代码审查
      console.log('Generating code review...');
      const reviewResult = await this.generateCodeReview(filteredChanges, commitMessages);
      console.log('Review result generated, length:', reviewResult.length);

      // 保存到数据库
      console.log('Preparing database save...');
      const additions = filteredChanges.reduce((sum, change) => sum + (change.additions || 0), 0);
      const deletions = filteredChanges.reduce((sum, change) => sum + (change.deletions || 0), 0);
      
      const reviewData = {
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
        lastChangeHash: filesHash,
      };
      
      console.log('Review data to save:', JSON.stringify(reviewData, null, 2));
      console.log('Branch values being saved:', {
        sourceBranch: reviewData.sourceBranch,
        targetBranch: reviewData.targetBranch,
        sourceBranchType: typeof reviewData.sourceBranch,
        targetBranchType: typeof reviewData.targetBranch
      });
      
      await this.databaseService.createMergeRequestReview(reviewData);
      console.log('Merge request review saved to database successfully');

      // 添加评论到Pull Request
      await this.githubService.createPullRequestComment(owner, repo, pullNumber, reviewResult);

      // 发送通知
      await this.notificationService.sendNotification({
        content: reviewResult,
        title: `代码审查 - ${projectName}`,
        prTitle: webhookData?.pull_request?.title,
        msgType: 'markdown',
      });

    } catch (error) {
      console.error('Pull request review failed:', error.message);
    }
  }

  async handlePush(parsedData: any): Promise<void> {
    try {
      console.log('=== REVIEW SERVICE - handlePush ===');
      console.log('Parsed data received:', JSON.stringify(parsedData, null, 2));
      
      const pushReviewEnabled = this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';
      console.log('Push review enabled:', pushReviewEnabled);
      
      if (!pushReviewEnabled) {
        console.log('Push review is disabled');
        return;
      }

      const { projectName, author, branchName, commits, webhookData } = parsedData;
      console.log('Extracted values:', {
        projectName,
        author,
        branchName,
        commitsCount: commits?.length || 0,
        hasWebhookData: !!webhookData
      });

      // 添加 branchName 验证
      if (!branchName || branchName.trim() === '') {
        console.log('ERROR: Branch name is missing or empty, skipping push review');
        console.log('Branch name value:', branchName);
        return;
      }

      if (!commits || commits.length === 0) {
        console.log('No commits found in push event');
        return;
      }

      // 获取变更文件
      console.log('Getting file changes...');
      let changes = [];
      if (parsedData.eventType === 'push' && parsedData.owner && parsedData.repo) {
        // GitHub push
        console.log('Processing GitHub push event');
        const lastCommit = commits[commits.length - 1];
        console.log('Last commit:', lastCommit);
        console.log('Getting commit files for:', {
          owner: parsedData.owner,
          repo: parsedData.repo,
          commitId: lastCommit.id
        });
        
        changes = await this.githubService.getCommitFiles(parsedData.owner, parsedData.repo, lastCommit.id);
        console.log('Raw changes from GitHub:', changes.length, 'files');
        changes = this.filterGitHubChanges(changes);
        console.log('Filtered changes:', changes.length, 'files');
      } else if (parsedData.eventType === 'push' && parsedData.projectId) {
        // GitLab push
        console.log('Processing GitLab push event');
        changes = await this.gitlabService.getRepositoryCompare(
          parsedData.projectId,
          parsedData.before,
          parsedData.after
        );
        console.log('Raw changes from GitLab:', changes.length, 'files');
        changes = this.filterChanges(changes);
        console.log('Filtered changes:', changes.length, 'files');
      }

      if (changes.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 生成代码审查
      console.log('Generating code review...');
      const commitMessages = commits.map(commit => commit.message).join('; ');
      console.log('Commit messages:', commitMessages);
      const reviewResult = await this.generateCodeReview(changes, commitMessages);
      console.log('Review result generated, length:', reviewResult.length);

      // 保存到数据库
      console.log('Preparing database save...');
      const additions = changes.reduce((sum, change) => sum + (change.additions || 0), 0);
      const deletions = changes.reduce((sum, change) => sum + (change.deletions || 0), 0);
      
      const reviewData = {
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
      };
      
      console.log('Review data to save:', JSON.stringify(reviewData, null, 2));
      console.log('Branch value being saved:', reviewData.branch);
      console.log('Branch type:', typeof reviewData.branch);
      console.log('Branch length:', reviewData.branch?.length);
      
      await this.databaseService.createPushReview(reviewData);
      console.log('Push review saved to database successfully');

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

  /**
   * 生成文件变更的哈希值
   * @param changes 文件变更列表
   * @returns 哈希值
   */
  private generateFilesHash(changes: any[]): string {
    // 使用文件变更内容的哈希，而不是文件本身的SHA
    // 这样可以检测到相同的文件变更，避免重复生成Review
    const changeContent = changes
      .map(change => ({
        path: change.filename || change.new_path,
        additions: change.additions || 0,
        deletions: change.deletions || 0,
        patch: change.patch || change.diff || '',
      }))
      .sort((a, b) => a.path.localeCompare(b.path)) // 按路径排序确保一致性
      .map(change => `${change.path}:${change.additions}:${change.deletions}:${change.patch}`)
      .join('|');

    // 生成SHA256哈希
    return crypto.createHash('sha256').update(changeContent).digest('hex');
  }
}

