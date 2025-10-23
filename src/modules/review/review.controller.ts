import { Controller, Post, Body, Param } from '@nestjs/common';
import { ReviewRequestDto } from './dto/review.dto';
import { ReviewService } from './review.service';
import { GitClientType } from '@/modules/git/interfaces/git-client.interface';
import { GitFactory } from '../git/git.factory';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService, private gitFactory: GitFactory,) { }



  @Post('/:clientType/review')
  async ReviewCode(@Param() params: { clientType: GitClientType; }, @Body() body: ReviewRequestDto) {
    const { eventType } = body;
    const gitClient = this.gitFactory.createGitClient(params.clientType, body.token);
    if (eventType === 'pull_request') {
      await this.reviewService.handlePullRequest(gitClient, {
        sourceBranch: body.sourceBranch,
        targetBranch: body.targetBranch,
        owner: body.owner,
        mrNumber: body.mrNumber,
        mrState: body.mrState,
        projectName: body.projectName,
        eventType: body.eventType,
        commitId: body.commitSha,
        repo: body.repo,
        llmProvider: body.llmProvider,
        llmProviderApiKey: body.llmProviderApiKey,
      });
    } else if (eventType === 'push') {
      await this.reviewService.handlePush(gitClient, {
        branch: body.targetBranch,
        owner: body.owner,
        projectName: body.projectName,
        eventType: body.eventType,
        commitId: body.commitSha,
        repo: body.repo,
        llmProvider: body.llmProvider,
        llmProviderApiKey: body.llmProviderApiKey,
      });
    }
    return { success: true };
  }
}

