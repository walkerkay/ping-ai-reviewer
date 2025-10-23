import { Controller, Post, Body, Param } from '@nestjs/common';
import { ReviewRequestDto } from './dto/review.dto';
import { ReviewService } from './review.service';
import { GitClientType } from '@/modules/git/interfaces/git-client.interface';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) { }

  @Post('/:clientType/review')
  async ReviewCode(@Param() params: { clientType: GitClientType; }, @Body() body: ReviewRequestDto) {
    await this.reviewService.ReviewCode(params.clientType, body);
    return { success: true };
  }
}

