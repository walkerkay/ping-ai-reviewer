import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MergeRequestReviewDocument = MergeRequestReview & Document;

@Schema({ timestamps: true, collection: 'merge_request_reviews' })
export class MergeRequestReview {
  @Prop({ required: true })
  projectName: string;

  @Prop({ required: true })
  author: string;

  @Prop({ required: true })
  sourceBranch: string;

  @Prop({ required: true })
  targetBranch: string;

  @Prop({ required: true })
  updatedAt: number;

  @Prop({ required: true })
  commitMessages: string;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  reviewResult: string;

  @Prop({ required: true })
  urlSlug: string;

  @Prop({ type: Object })
  webhookData: Record<string, any>;

  @Prop({ default: 0 })
  additions: number;

  @Prop({ default: 0 })
  deletions: number;

  @Prop({ default: '' })
  lastCommitId: string;

  @Prop({ default: '' })
  lastChangeHash: string;
}

export const MergeRequestReviewSchema =
  SchemaFactory.createForClass(MergeRequestReview);

// 创建索引
MergeRequestReviewSchema.index({ updatedAt: -1 });
MergeRequestReviewSchema.index({ projectName: 1 });
MergeRequestReviewSchema.index({ author: 1 });
