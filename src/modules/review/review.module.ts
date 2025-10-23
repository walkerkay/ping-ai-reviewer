import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AssetsLoaderService } from '../core/utils/assets-loader.service';
import { DatabaseModule } from '../database/database.module';
import { GitModule } from '../git/git.module';
import { IntegrationModule } from '../integration/integration.module';
import { LlmModule } from '../llm/llm.module';
import { ReviewService } from './review.service';
import { ConfigModule } from '@nestjs/config';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    LlmModule,
    IntegrationModule,
    GitModule,
    ConfigModule],
  controllers: [ReviewController],
  providers: [ReviewService, AssetsLoaderService],
  exports: [ReviewService],
})
export class ReviewModule {}
