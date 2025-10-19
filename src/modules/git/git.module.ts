import { Module } from '@nestjs/common';
import { GitFactory } from './git.factory';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';

@Module({
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
