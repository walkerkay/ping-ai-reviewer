import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { last } from 'lodash';
import { parseConfig } from '../core/config';
import { ProjectConfig } from '../core/config/interfaces/config.interface';
import { logger } from '../core/logger';
import { AssetsLoaderService } from '../core/utils/assets-loader.service';
import { DatabaseService } from '../database/database.service';
import { MergeRequestReview } from '../database/schemas/merge-request-review.schema';
import {
  FileChange,
  GitClientInterface,
  PullRequestInfo,
} from '../git/interfaces/git-client.interface';
import {
  ParsedPullRequestReviewData,
  ParsedPushReviewData,
} from '../git/interfaces/review.interface';
import { IntegrationService } from '../integration/integration.service';
import { LLMReviewResult } from '../llm/interfaces/llm-client.interface';
import { LLMFactory } from '../llm/llm.factory';
import {
  formatDiffs,
  validateAndCorrectLineNumbers,
} from './line-number.utils';
import {
  calculateAdditions,
  calculateDeletions,
  filterReviewableFiles,
  shouldSkipReview,
  shouldTriggerReview,
  slugifyUrl,
} from './review.utils';

@Injectable()
export class ReviewService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private integrationService: IntegrationService,
    private assetsLoaderService: AssetsLoaderService,
  ) {}

  private isPullRequestChanged(
    pullRequestInfo: PullRequestInfo,
    existingReview: MergeRequestReview,
  ): boolean {
    if (this.configService.get<boolean>('DEBUG')) {
      return true;
    }
    const currentCommits = pullRequestInfo.commits.map((commit) => commit.id);
    const lastReviewedCommit = last(
      existingReview?.reviewRecords,
    )?.lastCommitId;
    return last(currentCommits) !== lastReviewedCommit;
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

  async handlePullRequest(
    gitClient: GitClientInterface,
    requestDto: ParsedPullRequestReviewData,
  ): Promise<void> {
    try {
      const pullRequestInfo = await gitClient.getPullRequestInfo(
        requestDto.owner,
        requestDto.repo,
        requestDto.mrNumber,
      );

      const projectConfig = await this.getProjectConfig(
        gitClient,
        requestDto.owner,
        requestDto.repo,
        requestDto.sourceBranch,
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
        branchName: requestDto.targetBranch,
        files: pullRequestInfo.files,
        title: pullRequestInfo.title,
        isDraft: pullRequestInfo.isDraft,
      });

      if (shouldSkip) {
        return;
      }

      const identifier = slugifyUrl(pullRequestInfo.url);

      const existingReview =
        await this.databaseService.getMergeRequestReviewByIdentifier(
          identifier,
        );

      if (!this.isPullRequestChanged(pullRequestInfo, existingReview)) {
        logger.info(
          'No new commits to review, skipping review',
          'ReviewService',
        );
        return;
      }

      // 生成代码审查
      let changeCommits = pullRequestInfo.commits;
      let changeFiles: FileChange[] = pullRequestInfo.files;
      let references: string[] = [];

      if (existingReview && existingReview.reviewRecords.length > 0) {
        const lastReviewedCommit = last(
          existingReview.reviewRecords,
        )?.lastCommitId;
        const lastReviewedIndex = pullRequestInfo.commits.findIndex(
          (commit) => commit.id === lastReviewedCommit,
        );
        changeCommits = pullRequestInfo.commits.slice(lastReviewedIndex + 1);
        changeFiles = await gitClient.getCommitFiles(
          requestDto.owner,
          requestDto.repo,
          changeCommits.map((commit) => commit.id),
        );
        references = [
          `上一次审查结果：${last(existingReview?.reviewRecords)?.llmResult || ''} \n \n`,
        ];
      }

      // 加载项目参考文档
      const loadedReferences = await this.loadProjectReferences(
        projectConfig,
        gitClient,
        requestDto.owner,
        requestDto.repo,
        requestDto.sourceBranch,
      );

      // 合并历史references和配置的references
      const allReferences = [...references, ...loadedReferences];

      const reviewResult = await this.generateCodeReview(
        changeFiles,
        changeCommits.map((commit) => commit.message).join('; '),
        allReferences,
        projectConfig,
        pullRequestInfo,
        {
          llmProvider: requestDto.llmProvider,
          llmProviderApiKey: requestDto.llmProviderApiKey,
        },
      );

      // 创建或更新review记录
      const additions = calculateAdditions(pullRequestInfo.files);
      const deletions = calculateDeletions(pullRequestInfo.files);

      // 生成review记录
      const reviewRecord = {
        lastCommitId: last(changeCommits)?.id || '',
        createdAt: Date.now(),
        llmResult: [
          reviewResult.lineComments
            ?.map((comment) => comment.comment)
            .join('; '),
          reviewResult.detailComment,
        ].join('\n\n'),
        summary: reviewResult.overview,
      };

      // 如果是首次review，创建新记录；否则添加review记录
      if (!existingReview) {
        await this.databaseService.createMergeRequestReview({
          projectName: requestDto.projectName,
          author: pullRequestInfo.author,
          sourceBranch: pullRequestInfo.sourceBranch,
          targetBranch: pullRequestInfo.targetBranch,
          url: pullRequestInfo.url,
          identifier: identifier,
          webhookData: pullRequestInfo.webhookData,
          additions,
          deletions,
          commits: changeCommits.map((commit) => ({
            id: commit.id,
            message: commit.message,
          })),
          reviewRecords: [reviewRecord],
        });
      } else {
        // 更新 review 记录
        this.databaseService.updateMergeRequestReview(identifier, {
          additions,
          deletions,
          commits: pullRequestInfo.commits.map((commit) => ({
            id: commit.id,
            message: commit.message,
          })),
          reviewRecords: [...existingReview.reviewRecords, reviewRecord],
        });
      }
      // 添加行内评论

      const lineComments = validateAndCorrectLineNumbers(
        reviewResult.lineComments,
        changeFiles,
      ).map((comment) => ({
        path: comment.file,
        line: comment.line,
        body: comment.comment,
      }));

      if (lineComments.length > 0) {
        await gitClient.createPullRequestLineComments(
          requestDto.owner,
          requestDto.repo,
          pullRequestInfo.number,
          lineComments,
        );
      }

      // 添加评论
      await gitClient.createPullRequestComment(
        requestDto.owner,
        requestDto.repo,
        pullRequestInfo.number,
        reviewResult.detailComment,
      );

      // 发送通知
      await this.sendReviewNotification(
        reviewResult,
        requestDto.projectName,
        pullRequestInfo,
        projectConfig,
      );

      const summary = [...(existingReview?.reviewRecords ?? []), reviewRecord]
        .filter((record) => record.summary)
        .map((record) => `${record.summary}`)
        .join('\n');

      // 推送总结到集成
      await this.pushSummaryToIntegration(
        pullRequestInfo,
        summary,
        projectConfig,
      );
    } catch (error) {
      logger.error(
        'Pull request review failed:',
        'ReviewService',
        error.message,
      );
    }
  }

  async handlePush(
    gitClient: GitClientInterface,
    requestDto: ParsedPushReviewData,
  ): Promise<void> {
    try {
      const pushReviewEnabled =
        this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';

      if (!pushReviewEnabled) {
        logger.info('Push review is disabled', 'ReviewService');
        return;
      }

      const projectConfig = await this.getProjectConfig(
        gitClient,
        requestDto.owner,
        requestDto.repo,
        requestDto.branch,
      );

      if (!projectConfig.review.enabled) {
        return;
      }

      // 检查是否需要触发审查
      const shouldTrigger = shouldTriggerReview(
        projectConfig.trigger,
        'push',
        requestDto.branch,
      );

      if (!shouldTrigger) {
        logger.info(
          'Review trigger check failed, skipping review',
          'ReviewService',
        );
        return;
      }
      const commitSha = requestDto.commitSha;

      const pushInfo = await gitClient.getPushInfo(
        requestDto.owner,
        requestDto.repo,
        commitSha,
      );

      pushInfo.files = filterReviewableFiles(
        pushInfo.files,
        projectConfig.files,
      );

      const shouldSkip = await shouldSkipReview(projectConfig, {
        eventType: 'push',
        branchName: requestDto.branch,
        files: pushInfo.files,
      });

      if (shouldSkip) {
        return;
      }

      // 加载项目参考文档
      const loadedReferences = await this.loadProjectReferences(
        projectConfig,
        gitClient,
        requestDto.owner,
        requestDto.repo,
        requestDto.branch,
      );

      // 生成代码审查
      const commitMessages = pushInfo.commits
        .map((commit) => commit.message)
        .join('; ');
      const reviewResult = await this.generateCodeReview(
        pushInfo.files,
        commitMessages,
        loadedReferences,
        projectConfig,
        null,
        {
          llmProvider: requestDto.llmProvider,
          llmProviderApiKey: requestDto.llmProviderApiKey,
        },
      );

      // 保存到数据库
      const additions = calculateAdditions(pushInfo.files);
      const deletions = calculateDeletions(pushInfo.files);

      await this.databaseService.createPushReview({
        projectName: requestDto.projectName,
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
        requestDto.owner,
        requestDto.repo,
        pushLastCommit.id,
        reviewResult.detailComment,
      );

      // 发送通知
      await this.sendReviewNotification(
        reviewResult,
        requestDto.projectName,
        null,
        projectConfig,
      );
    } catch (error) {
      logger.error('Push review failed:', 'ReviewService', error.message);
    }
  }

  /**
   * 加载项目参考文档
   */
  private async loadProjectReferences(
    projectConfig: ProjectConfig,
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<string[]> {
    // 加载配置的references内容
    return await this.assetsLoaderService.loadReferences(
      projectConfig.references || [],
      gitClient,
      owner,
      repo,
      ref,
    );
  }

  private async generateCodeReview(
    changes: FileChange[],
    commitMessages: string,
    references: string[],
    config: ProjectConfig,
    pullRequestInfo?: PullRequestInfo,
    options?: {
      llmProvider?: string;
      llmProviderApiKey?: string;
    },
  ): Promise<LLMReviewResult> {
    const llmClient = this.llmFactory.getClient(
      options?.llmProvider,
      options?.llmProviderApiKey,
    );

    const diff = formatDiffs(changes);

    let allReferences = [...references];

    if (pullRequestInfo?.title) {
      try {
        const prompt = await this.integrationService.getCustomPrompt(
          pullRequestInfo.title,
          config.integrations,
        );
        if (prompt) {
          allReferences.push(`${prompt}`);
        }
      } catch (error) {
        logger.warn(
          'Failed to get pingcode work item details:',
          'ReviewService',
          error.message,
        );
      }
    }

    return await llmClient.generateReview(
      diff,
      commitMessages,
      allReferences,
      config,
    );
  }

  private async sendReviewNotification(
    reviewResult: LLMReviewResult,
    projectName: string,
    pullRequestInfo: PullRequestInfo | null,
    projectConfig: ProjectConfig,
  ): Promise<void> {
    if (!reviewResult.notification) {
      return;
    }
    await this.integrationService.sendNotification(
      {
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
      },
      projectConfig.integrations,
    );
  }

  private async pushSummaryToIntegration(
    pullRequestInfo: PullRequestInfo | null,
    summary: string,
    projectConfig: ProjectConfig,
  ): Promise<void> {
    if (!summary) {
      return;
    }
    await this.integrationService.pushSummary(
      pullRequestInfo?.title,
      summary,
      projectConfig.integrations,
    );
  }
}
