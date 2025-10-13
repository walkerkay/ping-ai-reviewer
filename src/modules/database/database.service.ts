import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MergeRequestReview, MergeRequestReviewDocument } from './schemas/merge-request-review.schema';
import { PushReview, PushReviewDocument } from './schemas/push-review.schema';

export interface ReviewQuery {
  authors?: string[];
  projectNames?: string[];
  updatedAtGte?: number;
  updatedAtLte?: number;
}

@Injectable()
export class DatabaseService {
  constructor(
    @InjectModel(MergeRequestReview.name)
    private mergeRequestReviewModel: Model<MergeRequestReviewDocument>,
    @InjectModel(PushReview.name)
    private pushReviewModel: Model<PushReviewDocument>,
  ) {}

  // Merge Request Review 相关方法
  async createMergeRequestReview(reviewData: Partial<MergeRequestReview>): Promise<MergeRequestReview> {
    const review = new this.mergeRequestReviewModel(reviewData);
    return review.save();
  }

  async getMergeRequestReviews(query: ReviewQuery = {}): Promise<MergeRequestReview[]> {
    const filter: any = {};

    if (query.authors && query.authors.length > 0) {
      filter.author = { $in: query.authors };
    }

    if (query.projectNames && query.projectNames.length > 0) {
      filter.projectName = { $in: query.projectNames };
    }

    if (query.updatedAtGte !== undefined) {
      filter.updatedAt = { ...filter.updatedAt, $gte: query.updatedAtGte };
    }

    if (query.updatedAtLte !== undefined) {
      filter.updatedAt = { ...filter.updatedAt, $lte: query.updatedAtLte };
    }

    return this.mergeRequestReviewModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .exec();
  }

  async checkMergeRequestLastCommitIdExists(
    projectName: string,
    sourceBranch: string,
    targetBranch: string,
    lastCommitId: string,
  ): Promise<boolean> {
    const count = await this.mergeRequestReviewModel
      .countDocuments({
        projectName,
        sourceBranch,
        targetBranch,
        lastCommitId,
      })
      .exec();
    return count > 0;
  }

  // Push Review 相关方法
  async createPushReview(reviewData: Partial<PushReview>): Promise<PushReview> {
    const review = new this.pushReviewModel(reviewData);
    return review.save();
  }

  async getPushReviews(query: ReviewQuery = {}): Promise<PushReview[]> {
    const filter: any = {};

    if (query.authors && query.authors.length > 0) {
      filter.author = { $in: query.authors };
    }

    if (query.projectNames && query.projectNames.length > 0) {
      filter.projectName = { $in: query.projectNames };
    }

    if (query.updatedAtGte !== undefined) {
      filter.updatedAt = { ...filter.updatedAt, $gte: query.updatedAtGte };
    }

    if (query.updatedAtLte !== undefined) {
      filter.updatedAt = { ...filter.updatedAt, $lte: query.updatedAtLte };
    }

    return this.pushReviewModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .exec();
  }
}

