import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { NotificationModule } from '../notification/notification.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [DatabaseModule, LlmModule, NotificationModule, GitModule],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
