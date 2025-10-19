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
import { LLMReviewResult } from '../llm/interfaces/llm-client.interface';
import { ProjectConfig } from '../config/interfaces/config.interface';
import { parseConfig } from '../config';
import {
  filterReviewableFiles,
  shouldTriggerReview,
  generateFilesHash,
  calculateAdditions,
  calculateDeletions,
  slugifyUrl,
  shouldSkipReview,
} from './review.utils';

@Injectable()
export class ReviewService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private notificationService: NotificationService,
    private gitFactory: GitFactory,
  ) {}

  async handlePullRequest(parsedData: ParsedWebhookData): Promise<void> {
    try {
      const gitClient = this.getGitClient(parsedData);

      const pullRequestInfo = await gitClient.getPullRequestInfo(
        parsedData.owner,
        parsedData.repo,
        parsedData.pullNumber || parsedData.mergeRequestIid,
      );

      const projectConfig = await this.getProjectConfig(
        gitClient,
        parsedData.owner,
        parsedData.repo,
        parsedData.sourceBranch,
      );

      if (!projectConfig.review.enabled) {
        return;
      }

      pullRequestInfo.files = filterReviewableFiles(
        pullRequestInfo.files,
        projectConfig.files,
      );

      const shouldSkip = await shouldSkipReview(projectConfig, {
        eventType: 'pull_request',
        branchName: parsedData.targetBranch,
        files: pullRequestInfo.files,
        title: pullRequestInfo.title,
        isDraft: pullRequestInfo.isDraft,
      });

      if (shouldSkip) {
        return;
      }

      const filesHash = generateFilesHash(pullRequestInfo.files);

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
        projectConfig,
      );

      // 保存到数据库
      const additions = calculateAdditions(pullRequestInfo.files);
      const deletions = calculateDeletions(pullRequestInfo.files);

      await this.databaseService.createMergeRequestReview({
        projectName: parsedData.projectName,
        author: pullRequestInfo.author,
        sourceBranch: pullRequestInfo.sourceBranch,
        targetBranch: pullRequestInfo.targetBranch,
        updatedAt: Date.now(),
        commitMessages,
        url: pullRequestInfo.url,
        reviewResult: reviewResult.detailComment,
        urlSlug: slugifyUrl(pullRequestInfo.url),
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

  async handlePush(parsedData: ParsedWebhookData): Promise<void> {
    try {
      const pushReviewEnabled =
        this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';

      if (!pushReviewEnabled) {
        console.log('Push review is disabled');
        return;
      }

      const gitClient = this.getGitClient(parsedData);

      const projectConfig = await this.getProjectConfig(
        gitClient,
        parsedData.owner,
        parsedData.repo,
        parsedData.branchName,
      );

      if (!projectConfig.review.enabled) {
        return;
      }

      // 检查是否需要触发审查
      const shouldTrigger = shouldTriggerReview(
        projectConfig.trigger,
        'push',
        parsedData.branchName,
      );

      if (!shouldTrigger) {
        console.log('Review trigger check failed, skipping review');
        return;
      }
      const lastCommit = parsedData.commits[parsedData.commits.length - 1];

      const pushInfo = await gitClient.getPushInfo(
        parsedData.owner,
        parsedData.repo,
        lastCommit.id,
      );

      pushInfo.files = filterReviewableFiles(
        pushInfo.files,
        projectConfig.files,
      );

      const shouldSkip = await shouldSkipReview(projectConfig, {
        eventType: 'push',
        branchName: parsedData.branchName,
        files: pushInfo.files,
      });

      if (shouldSkip) {
        return;
      }

      // 生成代码审查
      const commitMessages = pushInfo.commits
        .map((commit) => commit.message)
        .join('; ');
      const reviewResult = await this.generateCodeReview(
        pushInfo.files,
        commitMessages,
        projectConfig,
      );

      // 保存到数据库
      const additions = calculateAdditions(pushInfo.files);
      const deletions = calculateDeletions(pushInfo.files);

      await this.databaseService.createPushReview({
        projectName: parsedData.projectName,
        author: pushInfo.author,
        branch: pushInfo.branch,
        updatedAt: Date.now(),
        commitMessages,
        reviewResult: reviewResult.detailComment,
        urlSlug: slugifyUrl(pushInfo.url),
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

  private getGitClient(parsedData: ParsedWebhookData): GitClientInterface {
    return this.gitFactory.createGitClient(parsedData.clientType);
  }

  private async getProjectConfig(
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<ProjectConfig> {
    const [yamlConfig, ymlConfig] = await Promise.all([
      gitClient.getContentAsText(owner, repo, '.codereview.yaml', ref),
      gitClient.getContentAsText(owner, repo, '.codereview.yml', ref),
    ]);
    const configContent = yamlConfig || ymlConfig;
    const config = parseConfig(configContent);
    return config;
  }


  private async generateCodeReview(
    changes: FileChange[],
    commitMessages: string,
    config: ProjectConfig,
  ): Promise<LLMReviewResult> {
    const llmClient = this.llmFactory.getClient();
    const combinedDiff = changes
      .map((change) => `文件: ${change.filename}\n${change.patch}`)
      .join('\n\n');
    return await llmClient.generateReview(combinedDiff, commitMessages, config);
  }



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

}
