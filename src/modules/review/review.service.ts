import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { last } from 'lodash';
import { firstValueFrom } from 'rxjs';
import { parseConfig } from '../core/config';
import { ProjectConfig } from '../core/config/interfaces/config.interface';
import { logger } from '../core/logger';
import { DatabaseService } from '../database/database.service';
import { MergeRequestReview } from '../database/schemas/merge-request-review.schema';
import { GitFactory } from '../git/git.factory';
import {
  FileChange,
  GitClientInterface,
  ParsedWebhookData,
  PullRequestInfo,
} from '../git/interfaces/git-client.interface';
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
  shouldSkipReview,
  slugifyUrl,
} from './review.utils';

@Injectable()
export class ReviewService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private llmFactory: LLMFactory,
    private integrationService: IntegrationService,
    private gitFactory: GitFactory,
    private httpService: HttpService,
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
          parsedData.owner,
          parsedData.repo,
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
        gitClient,
        parsedData.owner,
        parsedData.repo,
        parsedData.sourceBranch,
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
          projectName: parsedData.projectName,
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

      await gitClient.createPullRequestLineComments(
        parsedData.owner,
        parsedData.repo,
        pullRequestInfo.number,
        lineComments,
      );

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

  async handlePush(parsedData: ParsedWebhookData): Promise<void> {
    try {
      const pushReviewEnabled =
        this.configService.get<string>('PUSH_REVIEW_ENABLED') === '1';

      if (!pushReviewEnabled) {
        logger.info('Push review is disabled', 'ReviewService');
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
        logger.info(
          'Review trigger check failed, skipping review',
          'ReviewService',
        );
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
        [],
        projectConfig,
        gitClient,
        parsedData.owner,
        parsedData.repo,
        parsedData.branchName,
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
        projectConfig,
      );
    } catch (error) {
      logger.error('Push review failed:', 'ReviewService', error.message);
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
    references: string[],
    config: ProjectConfig,
    gitClient?: GitClientInterface,
    owner?: string,
    repo?: string,
    ref?: string,
  ): Promise<LLMReviewResult> {
    const llmClient = this.llmFactory.getClient();

    // 加载配置中的参考信息
    let configReferences: string[] = [];
    if (
      config.references &&
      config.references.length > 0 &&
      gitClient &&
      owner &&
      repo &&
      ref
    ) {
      try {
        const referenceContents = await this.loadReferences(
          config.references,
          gitClient,
          owner,
          repo,
          ref,
        );

        configReferences = referenceContents.map((refContent) => {
          let content = `来源: ${refContent.source}`;
          if (refContent.description) {
            content += `\n描述: ${refContent.description}`;
          }
          content += `\n内容:\n${refContent.content}`;
          return content;
        });
      } catch (error) {
        logger.error(
          'Failed to load config references',
          'ReviewService',
          error.message,
        );
      }
    }

    // 合并历史参考信息和配置参考信息
    const allReferences = [...references, ...configReferences];

    const diff = formatDiffs(changes);

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

  private async loadReferences(
    references: ProjectConfig['references'],
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<Array<{ content: string; source: string; description?: string }>> {
    if (!references || references.length === 0) {
      return [];
    }

    const results: Array<{
      content: string;
      source: string;
      description?: string;
    }> = [];

    for (const reference of references) {
      try {
        let content: string;
        let source: string;

        if (reference.path) {
          // 读取内部文件
          content = await this.loadFileContent(
            reference.path,
            gitClient,
            owner,
            repo,
            ref,
          );
          source = `文件: ${reference.path}`;
        } else if (reference.url) {
          // 读取外部URL
          content = await this.loadUrlContent(reference.url);
          source = `URL: ${reference.url}`;
        } else {
          logger.warn(
            `Reference item has neither path nor url: ${JSON.stringify(reference)}`,
            'ReviewService',
          );
          continue;
        }

        if (content) {
          results.push({
            content,
            source,
            description: reference.description,
          });
        }
      } catch (error) {
        logger.error(
          `Failed to load reference: ${JSON.stringify(reference)}`,
          'ReviewService',
          error.message,
        );
        // 继续处理其他参考信息，不中断整个流程
      }
    }

    return results;
  }

  private async loadFileContent(
    path: string,
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<string> {
    try {
      const content = await gitClient.getContentAsText(owner, repo, path, ref);
      if (!content) {
        logger.warn(
          `File content is empty or not found: ${path} in ${owner}/${repo}@${ref}`,
          'ReviewService',
        );
        return '';
      }
      return content;
    } catch (error) {
      logger.warn(
        `Failed to load file content: ${path} in ${owner}/${repo}@${ref}`,
        'ReviewService',
        error.message,
      );
      // 不抛出错误，而是返回空字符串，让程序继续执行
      return '';
    }
  }

  private async loadUrlContent(url: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 10000, // 10秒超时
          headers: {
            'User-Agent': 'PingAI-Reviewer/1.0',
          },
        }),
      );

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Failed to load URL content: ${url}`,
        'ReviewService',
        error.message,
      );
      throw error;
    }
  }
}
