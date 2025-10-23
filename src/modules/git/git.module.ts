import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GitFactory } from './git.factory';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';

@Module({
  imports: [ConfigModule],
  providers: [
    GitFactory,
    GitHubClient,
    GitLabClient,
  ],
  exports: [
    GitFactory,
    GitHubClient,
    GitLabClient,
  ],
})
export class GitModule {}
