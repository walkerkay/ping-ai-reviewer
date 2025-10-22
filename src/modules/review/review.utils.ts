import { HttpService } from '@nestjs/axios';
import { minimatch } from 'minimatch';
import { firstValueFrom } from 'rxjs';
import {
  ProjectConfig,
  ProjectFilesConfig,
  ProjectReviewConfig,
  ProjectTriggerConfig,
} from '../core/config/interfaces/config.interface';
import { logger } from '../core/logger';
import {
  FileChange,
  GitClientInterface,
} from '../git/interfaces/git-client.interface';

/**
 * 判断是否应该触发代码审查
 */
export function shouldTriggerReview(
  trigger: ProjectTriggerConfig,
  eventType: 'pull_request' | 'push',
  branchName: string,
  title?: string,
  isDraft?: boolean,
): boolean {
  if (!trigger.events.includes(eventType)) {
    return false;
  }

  if (
    trigger.branches.length > 0 &&
    !trigger.branches
      .map((branch) => branch.toLowerCase())
      .includes(branchName.toLowerCase())
  ) {
    return false;
  }

  // 对于 pull_request 事件，检查是否包含 Draft PR
  if (eventType === 'pull_request') {
    if (isDraft && !trigger.include_draft) {
      return false;
    }

    // 检查标题是否包含忽略规则
    if (title && trigger.ignore_rules.title_contains.length > 0) {
      const shouldIgnore = trigger.ignore_rules.title_contains.some((rule) =>
        title.toLowerCase().includes(rule.toLowerCase()),
      );
      if (shouldIgnore) {
        return false;
      }
    }
  }

  // 检查分支是否匹配忽略规则
  if (trigger.ignore_rules.branch_matches.length > 0) {
    const shouldIgnore = trigger.ignore_rules.branch_matches.some((rule) => {
      // 支持通配符匹配
      if (rule.includes('*')) {
        const pattern = rule.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(branchName);
      }
      return branchName === rule;
    });

    if (shouldIgnore) {
      return false;
    }
  }

  return true;
}

/**
 * 过滤可审查的文件
 */
export function filterReviewableFiles<T extends { filename: string }>(
  files: T[],
  filesConfig: ProjectFilesConfig,
): T[] {
  if (!files || files.length === 0) {
    return [];
  }

  return files.filter((file) => {
    if (filesConfig.extensions && filesConfig.extensions.length > 0) {
      const fileExtension = file.filename
        .substring(file.filename.lastIndexOf('.'))
        .toLowerCase();
      const normalizedExtensions = filesConfig.extensions.map((ext) =>
        ext.toLowerCase(),
      );
      if (!normalizedExtensions.includes(fileExtension)) {
        return false;
      }
    }

    if (filesConfig.include && filesConfig.include.length > 0) {
      const matchesInclude = filesConfig.include.some((pattern) =>
        minimatch(file.filename, pattern),
      );
      if (!matchesInclude) {
        return false;
      }
    }

    if (filesConfig.exclude && filesConfig.exclude.length > 0) {
      const matchesExclude = filesConfig.exclude.some((pattern) =>
        minimatch(file.filename, pattern),
      );
      if (matchesExclude) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 检查审查限制
 */
export function checkReviewLimits<
  T extends { filename: string; patch?: string },
>(files: T[], config: ProjectReviewConfig): boolean {
  if (files.length > config.max_files) {
    logger.warn(
      `File count (${files.length}) exceeds limit (${config.max_files})`,
      'ReviewUtils',
    );
    return true;
  }
  let totalContentLength: number = 0;
  for (const file of files) {
    totalContentLength += (file.patch || '').length;
  }
  return totalContentLength > config.max_content_length;
}

/**
 * 判断是否应该跳过审查
 */
export async function shouldSkipReview(
  config: ProjectConfig,
  params: {
    eventType: 'pull_request' | 'push';
    branchName: string;
    title?: string;
    isDraft?: boolean;
    files: FileChange[];
  },
): Promise<boolean> {
  if (params.files.length === 0) {
    logger.info('No supported file changes found', 'ReviewUtils');
    return true;
  }
  if (checkReviewLimits(params.files, config.review)) {
    logger.warn('File count or size exceeds limit', 'ReviewUtils');
    return true;
  }

  const shouldTrigger = shouldTriggerReview(
    config.trigger,
    params.eventType,
    params.branchName,
    params.title,
    params.isDraft,
  );

  if (!shouldTrigger) {
    logger.info('Review trigger check failed, skipping review', 'ReviewUtils');
    return true;
  }

  return false;
}

/**
 * 计算文件变更的添加行数
 */
export function calculateAdditions(changes: FileChange[]): number {
  return changes.reduce((sum, change) => sum + change.additions, 0);
}

/**
 * 计算文件变更的删除行数
 */
export function calculateDeletions(changes: FileChange[]): number {
  return changes.reduce((sum, change) => sum + change.deletions, 0);
}

/**
 * 将URL转换为slug格式
 */
export function slugifyUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * 验证 URL 是否在白名单中，防止 SSRF 攻击
 */
export function isAllowedUrl(
  url: string,
  customAllowedDomains?: string[],
): boolean {
  try {
    const urlObj = new URL(url);

    // 只允许 HTTPS 协议
    if (urlObj.protocol !== 'https:') {
      logger.warn(
        `URL protocol not allowed: ${urlObj.protocol}`,
        'ReviewUtils',
      );
      return false;
    }

    const defaultAllowedDomains = ['github.com'];

    const allowedDomains = [
      ...defaultAllowedDomains,
      ...(customAllowedDomains || []),
    ];

    // 检查域名是否在白名单中
    const isAllowed = allowedDomains.some(
      (domain) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`),
    );

    if (!isAllowed) {
      logger.warn(
        `URL domain not in whitelist: ${urlObj.hostname}`,
        'ReviewUtils',
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.warn(`Invalid URL format: ${url}`, 'ReviewUtils');
    return false;
  }
}

/**
 * 加载文件内容
 */
export async function loadFileContent(
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
        'ReviewUtils',
      );
      return '';
    }
    return content;
  } catch (error) {
    logger.warn(
      `Failed to load file content: ${path} in ${owner}/${repo}@${ref}`,
      'ReviewUtils',
      error.message,
    );
    return '';
  }
}

export async function loadUrlContent(
  httpService: HttpService,
  url: string,
  customAllowedDomains?: string[],
): Promise<string> {
  try {
    // 验证 URL 是否在白名单中，防止 SSRF 攻击
    if (!isAllowedUrl(url, customAllowedDomains)) {
      throw new Error(`URL not allowed: ${url}`);
    }

    const response = await firstValueFrom(
      httpService.get(url, {
        timeout: 10000,
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
    logger.warn(
      `Failed to load URL content: ${url}`,
      'ReviewUtils',
      error.message,
    );
    return '';
  }
}

export async function loadReferences(
  references: ProjectConfig['references'],
  gitClient: GitClientInterface,
  owner: string,
  repo: string,
  ref: string,
  httpService: HttpService,
  customAllowedDomains?: string[],
): Promise<Array<{ content: string; source: string; description?: string }>> {
  if (!references || references.length === 0) {
    return [];
  }

  const items = await Promise.all(
    references.map(async (reference) => {
      try {
        let content: string;
        let source: string;

        if (reference.path) {
          content = await loadFileContent(
            reference.path,
            gitClient,
            owner,
            repo,
            ref,
          );
          source = `文件: ${reference.path}`;
        } else if (reference.url) {
          content = await loadUrlContent(
            httpService,
            reference.url,
            customAllowedDomains,
          );
          source = `URL: ${reference.url}`;
        } else {
          logger.warn(
            `Reference item has neither path nor url: ${JSON.stringify(reference)}`,
            'ReviewUtils',
          );
          return undefined;
        }

        if (content) {
          return { content, source, description: reference.description };
        }
        return undefined;
      } catch (error) {
        logger.error(
          `Failed to load reference: ${JSON.stringify(reference)}`,
          'ReviewUtils',
          error.message,
        );
        return undefined;
      }
    }),
  );

  return items.filter((item) => item !== undefined);
}
