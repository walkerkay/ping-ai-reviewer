import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitClientInterface, GitClientType } from './interfaces/git-client.interface';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';

/**
 * Git 客户端工厂
 */
@Injectable()
export class GitFactory {
  constructor(
    private configService: ConfigService,
  ) {}

  /**
   * 创建 Git 客户端实例
   * @param type Git 客户端类型
   * @returns Git 客户端实例
   */
  createGitClient(type: GitClientType): GitClientInterface {
    switch (type) {
      case GitClientType.GITHUB:
        return new GitHubClient(this.configService);
      case GitClientType.GITLAB:
        return new GitLabClient(this.configService);
      default:
        throw new Error(`Unsupported Git client type: ${type}`);
    }
  }

  /**
   * 根据配置自动创建 Git 客户端实例
   * @param clientType 客户端类型字符串
   * @returns Git 客户端实例
   */
  createGitClientByType(clientType: string): GitClientInterface {
    const type = clientType.toLowerCase();
    
    switch (type) {
      case 'github':
        return this.createGitClient(GitClientType.GITHUB);
      case 'gitlab':
        return this.createGitClient(GitClientType.GITLAB);
      default:
        throw new Error(`Unsupported Git client type: ${clientType}`);
    }
  }

  /**
   * 获取所有支持的 Git 客户端类型
   */
  getSupportedTypes(): GitClientType[] {
    return Object.values(GitClientType);
  }

  /**
   * 检查客户端类型是否支持
   */
  isSupportedType(type: string): boolean {
    return Object.values(GitClientType).includes(type as GitClientType);
  }
}
