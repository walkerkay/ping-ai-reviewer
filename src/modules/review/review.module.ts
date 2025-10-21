import { Module } from '@nestjs/common';
import { ConfigModule } from '../core/config/config.module';
import { DatabaseModule } from '../database/database.module';
import { GitModule } from '../git/git.module';
import { IntegrationModule } from '../integration/integration.module';
import { LlmModule } from '../llm/llm.module';
import { ReviewService } from './review.service';

@Module({
  imports: [
    DatabaseModule,
    LlmModule,
    IntegrationModule,
    GitModule,
    ConfigModule,
  ],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
