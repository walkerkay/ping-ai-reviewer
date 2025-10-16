import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PushReviewDocument = PushReview & Document;

@Schema({ timestamps: true, collection: 'push_reviews' })
export class PushReview {
  @Prop({ required: true })
  projectName: string;

  @Prop({ required: true })
  author: string;

  @Prop({ required: true })
  branch: string;

  @Prop({ required: true })
  updatedAt: number;

  @Prop({ required: true })
  commitMessages: string;

  @Prop({ required: true })
  score: number;

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
}

export const PushReviewSchema = SchemaFactory.createForClass(PushReview);

// 创建索引
PushReviewSchema.index({ updatedAt: -1 });
PushReviewSchema.index({ projectName: 1 });
PushReviewSchema.index({ author: 1 });

