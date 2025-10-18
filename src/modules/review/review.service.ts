import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LLMFactory } from '../llm/llm.factory';
import { NotificationService } from '../notification/notification.service';
import {
  GitClientInterface,
  PullRequestInfo,
  FileChange,
  ParsedWebhookData,
} from '../git/interfaces/git-client.interface';
import { GitFactory } from '../git/git.factory';
import * as crypto from 'crypto';
import { LLMReviewResult } from '../llm/interfaces/llm-client.interface';

@Injectable()
export class ReviewService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private notificationService: NotificationService,
    private gitFactory: GitFactory,
  ) {}

  /**
   * 处理Pull Request/Merge Request
   */
  async handlePullRequest(parsedData: ParsedWebhookData): Promise<void> {
    try {
      const gitClient = this.getGitClient(parsedData);
      const pullRequestInfo = await gitClient.getPullRequestInfo(
        parsedData.owner,
        parsedData.repo,
        parsedData.pullNumber || parsedData.mergeRequestIid,
      );

      // 文件已经在 Git 客户端中过滤过了
      if (pullRequestInfo.files.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 检查重复审查
      const filesHash = this.generateFilesHash(pullRequestInfo.files);
      const hasExistingReview =
        await this.databaseService.checkMergeRequestFilesHashExists(
          parsedData.projectName,
          pullRequestInfo.sourceBranch,
          pullRequestInfo.targetBranch,
          filesHash,
        );

      if (hasExistingReview) {
        console.log('Files have not changed, skipping review generation');
        return;
      }

      // 生成代码审查
      const commitMessages = pullRequestInfo.commits
        .map((commit) => commit.message)
        .join('; ');
      const reviewResult = await this.generateCodeReview(
        pullRequestInfo.files,
        commitMessages,
      );

      // 保存到数据库
      const additions = this.calculateAdditions(pullRequestInfo.files);
      const deletions = this.calculateDeletions(pullRequestInfo.files);

      await this.databaseService.createMergeRequestReview({
        projectName: parsedData.projectName,
        author: pullRequestInfo.author,
        sourceBranch: pullRequestInfo.sourceBranch,
        targetBranch: pullRequestInfo.targetBranch,
        updatedAt: Date.now(),
        commitMessages,
        url: pullRequestInfo.url,
        reviewResult: reviewResult.detailComment,
        urlSlug: this.slugifyUrl(pullRequestInfo.url),
        webhookData: pullRequestInfo.webhookData,
        additions,
        deletions,
        lastCommitId:
          pullRequestInfo.commits[pullRequestInfo.commits.length - 1]?.id || '',
        lastChangeHash: filesHash,
      });

      // 添加评论
      await gitClient.createPullRequestComment(
        parsedData.owner,
        parsedData.repo,
        pullRequestInfo.number,
        reviewResult.detailComment,
      );

      // 发送通知
      await this.sendReviewNotification(
        reviewResult,
        parsedData.projectName,
        pullRequestInfo,
      );
    } catch (error) {
      console.error('Pull request review failed:', error.message);
    }
  }

  /**
   * 处理Push事件
   */
  async handlePush(parsedData: ParsedWebhookData): Promise<void> {
    try {
      const pushReviewEnabled =
        this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';

      if (!pushReviewEnabled) {
        console.log('Push review is disabled');
        return;
      }

      const gitClient = this.getGitClient(parsedData);
      const lastCommit = parsedData.commits[parsedData.commits.length - 1];

      const pushInfo = await gitClient.getPushInfo(
        parsedData.owner,
        parsedData.repo,
        lastCommit.id,
      );

      // 文件已经在 Git 客户端中过滤过了
      if (pushInfo.files.length === 0) {
        console.log('No supported file changes found');
        return;
      }

      // 生成代码审查
      const commitMessages = pushInfo.commits
        .map((commit) => commit.message)
        .join('; ');
      const reviewResult = await this.generateCodeReview(
        pushInfo.files,
        commitMessages,
      );

      // 保存到数据库
      const additions = this.calculateAdditions(pushInfo.files);
      const deletions = this.calculateDeletions(pushInfo.files);

      await this.databaseService.createPushReview({
        projectName: parsedData.projectName,
        author: pushInfo.author,
        branch: pushInfo.branch,
        updatedAt: Date.now(),
        commitMessages,
        reviewResult: reviewResult.detailComment,
        urlSlug: this.slugifyUrl(pushInfo.url),
        webhookData: pushInfo.webhookData,
        additions,
        deletions,
      });

      // 添加评论
      const pushLastCommit = pushInfo.commits[pushInfo.commits.length - 1];
      await gitClient.createCommitComment(
        parsedData.owner,
        parsedData.repo,
        pushLastCommit.id,
        reviewResult.detailComment,
      );

      // 发送通知
      await this.sendReviewNotification(
        reviewResult,
        parsedData.projectName,
        null,
      );
    } catch (error) {
      console.error('Push review failed:', error.message);
    }
  }

  /**
   * 根据解析数据获取对应的Git客户端
   */
  private getGitClient(parsedData: ParsedWebhookData): GitClientInterface {
    return this.gitFactory.createGitClient(parsedData.clientType);
  }


  /**
   * 生成代码审查
   */
  private async generateCodeReview(
    changes: FileChange[],
    commitMessages: string,
  ): Promise<LLMReviewResult> {
    const llmClient = this.llmFactory.getClient();
    const combinedDiff = changes
      .map((change) => `文件: ${change.filename}\n${change.patch}`)
      .join('\n\n');
    return await llmClient.generateReview(combinedDiff, commitMessages);
  }

  /**
   * 生成URL slug
   */
  private slugifyUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * 计算文件变更的添加行数
   */
  private calculateAdditions(changes: FileChange[]): number {
    return changes.reduce((sum, change) => sum + change.additions, 0);
  }

  /**
   * 计算文件变更的删除行数
   */
  private calculateDeletions(changes: FileChange[]): number {
    return changes.reduce((sum, change) => sum + change.deletions, 0);
  }

  /**
   * 发送审查通知
   */
  private async sendReviewNotification(
    reviewResult: LLMReviewResult,
    projectName: string,
    pullRequestInfo: PullRequestInfo | null,
  ): Promise<void> {
    if (!reviewResult.notification) {
      return;
    }

    await this.notificationService.sendNotification({
      content: reviewResult.notification,
      title: `PingReviewer - ${projectName}`,
      msgType: 'text',
      additions: pullRequestInfo
        ? {
            pullRequest: {
              title: pullRequestInfo.title,
              url: pullRequestInfo.url,
            },
          }
        : undefined,
    });
  }

  /**
   * 生成文件变更哈希
   */
  private generateFilesHash(changes: FileChange[]): string {
    const changeContent = changes
      .map((change) => ({
        path: change.filename,
        additions: change.additions,
        deletions: change.deletions,
        patch: change.patch,
      }))
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(
        (change) =>
          `${change.path}:${change.additions}:${change.deletions}:${change.patch}`,
      )
      .join('|');

    return crypto.createHash('sha256').update(changeContent).digest('hex');
  }
}
