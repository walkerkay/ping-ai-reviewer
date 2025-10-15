import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MergeRequestReview, MergeRequestReviewSchema } from './schemas/merge-request-review.schema';
import { PushReview, PushReviewSchema } from './schemas/push-review.schema';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'MergeRequestReview', schema: MergeRequestReviewSchema },
      { name: 'PushReview', schema: PushReviewSchema },
    ]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, MongooseModule],
})
export class DatabaseModule {}

