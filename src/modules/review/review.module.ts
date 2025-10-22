import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GitModule } from '../git/git.module';
import { IntegrationModule } from '../integration/integration.module';
import { LlmModule } from '../llm/llm.module';
import { ReviewService } from './review.service';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    LlmModule,
    IntegrationModule,
    GitModule,
  ],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
