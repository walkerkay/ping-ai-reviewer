import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { IntegrationModule } from '../integration/integration.module';
import { GitModule } from '../git/git.module';
import { ConfigModule } from '@nestjs/config';
import { ReviewController } from './review.controller';

@Module({
  imports: [DatabaseModule, LlmModule, IntegrationModule, GitModule, ConfigModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
