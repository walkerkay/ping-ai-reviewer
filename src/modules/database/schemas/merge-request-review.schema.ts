import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MergeRequestReviewDocument = MergeRequestReview & Document;

@Schema({ timestamps: true, collection: 'merge_request_reviews' })
export class MergeRequestReview {
  @Prop({ required: true })
  identifier: string;

  @Prop({ required: true })
  projectName: string;

  @Prop({ required: true })
  author: string;

  @Prop({ required: true })
  sourceBranch: string;

  @Prop({ required: true })
  targetBranch: string;

  @Prop({ required: false })
  score: number;

  @Prop({ required: true })
  url: string;

  @Prop({ type: Object })
  webhookData: Record<string, any>;

  @Prop({ default: 0 })
  additions: number;

  @Prop({ default: 0 })
  deletions: number;

  @Prop({ type: [Object], required: true })
  commits: {
    id: string;
    message: string;
  }[];

  @Prop({ type: [Object], required: true })
  reviewRecords: {
    lastCommitId: string;
    createdAt: number;
    llmResult: string;
  }[];

  @Prop({ default: () => Date.now() })
  createdAt: number;

  @Prop({ default: () => Date.now() })
  updatedAt: number;
}

export const MergeRequestReviewSchema =
  SchemaFactory.createForClass(MergeRequestReview);

// 创建索引
MergeRequestReviewSchema.index({ identifier: 1 });
MergeRequestReviewSchema.index({ updatedAt: -1 });
MergeRequestReviewSchema.index({ projectName: 1 });
MergeRequestReviewSchema.index({ author: 1 });
