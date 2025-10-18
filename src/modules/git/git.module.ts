import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GitFactory } from './git.factory';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';

@Module({
  imports: [HttpModule],
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
