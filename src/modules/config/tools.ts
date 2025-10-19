import { minimatch } from 'minimatch';
import {
  ProjectFilesConfig,
  ProjectTriggerConfig,
  ProjectReviewConfig,
} from './interfaces/config.interface';

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

export function checkReviewLimits<
  T extends { filename: string; patch?: string },
>(files: T[], config: ProjectReviewConfig): boolean {
  if (files.length > config.max_files) {
    console.log(
      `File count (${files.length}) exceeds limit (${config.max_files})`,
    );
    return true;
  }
  let totalContentLength: number = 0;
  for (const file of files) {
    totalContentLength += (file.patch || '').length;
  }
  return totalContentLength > config.max_content_length;
}
