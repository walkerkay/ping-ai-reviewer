import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { MergeRequestReview, MergeRequestReviewDocument } from './schemas/merge-request-review.schema';
import { PushReview, PushReviewDocument } from './schemas/push-review.schema';

export interface ReviewQuery {
  authors?: string[];
  projectNames?: string[];
  updatedAtGte?: number;
  updatedAtLte?: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(
    @InjectModel(MergeRequestReview.name)
    private mergeRequestReviewModel: Model<MergeRequestReviewDocument>,
    @InjectModel(PushReview.name)
    private pushReviewModel: Model<PushReviewDocument>,
    @InjectConnection()
    private connection: Connection,
  ) {}

  async onModuleInit() {
    console.log('=== DATABASE SERVICE INITIALIZATION ===');
    await this.checkDatabaseConnection();
  }

  /**
   * 检查数据库连接状态
   */
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      console.log('Checking database connection...');
      console.log('Connection state:', this.connection.readyState);
      console.log('Connection host:', this.connection.host);
      console.log('Connection port:', this.connection.port);
      console.log('Connection name:', this.connection.name);
      
      // 检查连接状态
      if (this.connection.readyState !== 1) {
        console.error('Database connection is not ready. State:', this.connection.readyState);
        return false;
      }

      // 执行一个简单的查询来验证连接
      await this.connection.db.admin().ping();
      console.log('✅ Database connection is healthy');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('Connection state:', this.connection.readyState);
      return false;
    }
  }

  /**
   * 验证数据库连接并在操作前检查
   */
  private async validateConnection(): Promise<void> {
    const isConnected = await this.checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection is not available');
    }
  }

  // Merge Request Review 相关方法
  async createMergeRequestReview(reviewData: Partial<MergeRequestReview>): Promise<MergeRequestReview> {
    console.log('=== DATABASE SERVICE - createMergeRequestReview ===');
    
    // 验证数据库连接
    await this.validateConnection();
    
    console.log('Review data received:', JSON.stringify(reviewData, null, 2));
    console.log('Branch fields validation:', {
      sourceBranch: reviewData.sourceBranch,
      targetBranch: reviewData.targetBranch,
      sourceBranchType: typeof reviewData.sourceBranch,
      targetBranchType: typeof reviewData.targetBranch,
      isSourceBranchEmpty: !reviewData.sourceBranch || reviewData.sourceBranch.trim() === '',
      isTargetBranchEmpty: !reviewData.targetBranch || reviewData.targetBranch.trim() === ''
    });
    
    try {
      const review = new this.mergeRequestReviewModel(reviewData);
      console.log('Mongoose model created successfully');
      const savedReview = await review.save();
      console.log('Merge request review saved successfully with ID:', savedReview._id);
      return savedReview;
    } catch (error) {
      console.error('Database save failed:', error.message);
      console.error('Validation errors:', error.errors);
      console.error('Full error:', error);
      throw error;
    }
  }

  async getMergeRequestReviews(query: ReviewQuery = {}): Promise<MergeRequestReview[]> {
    // 验证数据库连接
    await this.validateConnection();
    
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
    // 验证数据库连接
    await this.validateConnection();
    
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

  async checkMergeRequestFilesHashExists(
    projectName: string,
    sourceBranch: string,
    targetBranch: string,
    filesHash: string,
  ): Promise<boolean> {
    // 验证数据库连接
    await this.validateConnection();
    
    const count = await this.mergeRequestReviewModel
      .countDocuments({
        projectName,
        sourceBranch,
        targetBranch,
        lastChangeHash: filesHash,
      })
      .exec();
    return count > 0;
  }

  // Push Review 相关方法
  async createPushReview(reviewData: Partial<PushReview>): Promise<PushReview> {
    console.log('=== DATABASE SERVICE - createPushReview ===');
    
    // 验证数据库连接
    await this.validateConnection();
    
    console.log('Review data received:', JSON.stringify(reviewData, null, 2));
    console.log('Branch field validation:', {
      branch: reviewData.branch,
      branchType: typeof reviewData.branch,
      branchLength: reviewData.branch?.length,
      isBranchEmpty: !reviewData.branch || reviewData.branch.trim() === ''
    });
    
    try {
      const review = new this.pushReviewModel(reviewData);
      console.log('Mongoose model created successfully');
      const savedReview = await review.save();
      console.log('Push review saved successfully with ID:', savedReview._id);
      return savedReview;
    } catch (error) {
      console.error('Database save failed:', error.message);
      console.error('Validation errors:', error.errors);
      console.error('Full error:', error);
      throw error;
    }
  }

  async getPushReviews(query: ReviewQuery = {}): Promise<PushReview[]> {
    // 验证数据库连接
    await this.validateConnection();
    
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

