import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LLMFactory } from '../llm/llm.factory';
import { IntegrationService } from '../integration/integration.service';
import {
  GitClientInterface,
  PullRequestInfo,
  FileChange,
  ParsedWebhookData,
  GitClientType,
  EVENT_CONFIG,
} from '../git/interfaces/git-client.interface';
import { GitFactory } from '../git/git.factory';
import { LLMReviewResult } from '../llm/interfaces/llm-client.interface';
import { ProjectConfig } from '../core/config/interfaces/config.interface';
import { parseConfig } from '../core/config';
import { logger } from '../core/logger';
import {
  filterReviewableFiles,
  shouldTriggerReview,
  calculateAdditions,
  calculateDeletions,
  slugifyUrl,
  shouldSkipReview
} from './review.utils';
import { last } from 'lodash';
import { MergeRequestReview } from '../database/schemas/merge-request-review.schema';
import { ReviewRequestDto } from './dto/review.dto';
import { formatDiffs, validateAndCorrectLineNumbers } from './line-number.utils';

@Injectable()
export class ReviewService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private integrationService: IntegrationService,
    private gitFactory: GitFactory,
  ) { }

  private isPullRequestChanged(
    pullRequestInfo: PullRequestInfo,
    existingReview: MergeRequestReview,
  ): boolean {
    if (this.configService.get<boolean>('DEBUG')) {
      return true;
    }
    const currentCommits = pullRequestInfo.commits.map((commit) => commit.id);
    const lastReviewedCommit = last(existingReview?.reviewRecords)?.lastCommitId;
    return last(currentCommits) !== lastReviewedCommit;
  }

  async handlePullRequestFromWebHooks(gitClient: GitClientInterface, parsedData: ParsedWebhookData): Promise<void> {
    await this.handlePullRequest(gitClient, {
      repo: parsedData.repo,
      owner: parsedData.owner,
      mrNumber: parsedData.pullNumber || parsedData.mergeRequestIid,
      mrState: parsedData.state,
      sourceBranch: parsedData.sourceBranch,
      targetBranch: parsedData.targetBranch,
      projectName: parsedData.projectName,
    });
  }

  async handlePushFromWebHooks(gitClient: GitClientInterface, parsedData: ParsedWebhookData): Promise<void> {
    await this.handlePush(gitClient, {
      repo: parsedData.repo,
      owner: parsedData.owner,
      commitSha: parsedData.commits[parsedData.commits.length - 1].id,
      targetBranch: parsedData.targetBranch,
    });
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
    references: string[],
    config: ProjectConfig,
    options?: {
      llmProvider?: string;
      llmProviderApiKey?: string;
    }
  ): Promise<LLMReviewResult> {
    const llmClient = this.llmFactory.getClient(options?.llmProvider, options?.llmProviderApiKey);

    const diff = formatDiffs(changes);

    return await llmClient.generateReview(diff, commitMessages, references, config);
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


  async handlePullRequest(
    gitClient: GitClientInterface,
    requestDto: Pick<ReviewRequestDto, 'owner' | 'repo' | 'mrNumber' | 'mrState' | 'sourceBranch' | 'targetBranch' | 'projectName'>,
    options?: {
      llmProvider?: string;
      llmProviderApiKey?: string;
    }): Promise<void> {
    try {
      const pullRequestInfo = await gitClient.getPullRequestInfo(
        requestDto.owner,
        requestDto.repo,
        +requestDto.mrNumber,
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

      const reviewResult = await this.generateCodeReview(
        changeFiles,
        changeCommits.map((commit) => commit.message).join('; '),
        references,
        projectConfig,
        options
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
        changeFiles
      ).map(comment => ({
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
    requestDto: Pick<ReviewRequestDto, 'owner' | 'repo' | 'commitSha' | 'targetBranch' | 'projectName'>,
    options?: {
      llmProvider?: string;
      llmProviderApiKey?: string;
    }): Promise<void> {
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
        requestDto.targetBranch,
      );

      if (!projectConfig.review.enabled) {
        return;
      }

      // 检查是否需要触发审查
      const shouldTrigger = shouldTriggerReview(
        projectConfig.trigger,
        'push',
        requestDto.targetBranch,
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
        branchName: requestDto.targetBranch,
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
        [],
        projectConfig,
        options
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

  // ==============================
  // 辅助方法：事件匹配与平台工具
  // ==============================
  /**
   * 匹配事件处理器（根据事件类型+状态）
   */
  private matchEventHandler(
    eventType: string,
    mrState: string,
    clientType: GitClientType,
    platformConfig: typeof EVENT_CONFIG[GitClientType],
    gitClient: GitClientInterface,
    requestDto: ReviewRequestDto
  ) {
    const options = {
      llmProvider: requestDto.llmProvider,
      llmProviderApiKey: requestDto.llmProviderApiKey,
    }
    switch (eventType) {
      case 'pull_request':
        const allowedStates = platformConfig.pull_request;
        if (!allowedStates.includes(mrState)) {
          throw new Error(`${clientType} PR状态不匹配（当前: ${mrState}，允许: ${allowedStates.join(', ')}）`);
        }
        return {
          handler: () => this.handlePullRequest(gitClient, requestDto, options),
          eventLabel: 'PR'
        };

      case 'push':
        return {
          handler: () => this.handlePush(gitClient, requestDto, options),
          eventLabel: 'Push'
        };

      default:
        throw new Error(`${clientType} 不支持的事件类型: ${eventType}`);
    }
  }

  // ==============================
  // 公共入口方法（对外暴露的API）
  // ==============================
  public async ReviewCode(clientType: GitClientType, reviewRequestDto: ReviewRequestDto) {
    try {
      const { eventType, mrState } = reviewRequestDto;
      const platformConfig = EVENT_CONFIG[clientType];

      // 1. 校验客户端类型
      if (!platformConfig) {
        throw new Error(`不支持的代码平台：${clientType}`);
      }

      // 2. 创建Git客户端（校验后实例化，避免无效资源）
      const gitClient = this.gitFactory.createGitClient(clientType, reviewRequestDto.token);

      // 3. 匹配事件类型并执行对应逻辑
      const { handler, eventLabel } = this.matchEventHandler(
        eventType,
        mrState,
        clientType,
        platformConfig,
        gitClient,
        reviewRequestDto
      );

      // 4. 执行处理逻辑
      await handler();
      return { message: `${clientType} ${eventLabel} 事件已异步处理` };

    } catch (error) {
      logger.error(`代码审查入口失败:`, 'ReviewService', error.message);
      throw error; // 抛出错误让上层统一处理
    }
  }

}
