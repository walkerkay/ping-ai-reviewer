import { IsString, IsOptional, IsObject } from 'class-validator';

export class GitLabWebhookDto {
  @IsString()
  object_kind: string;

  @IsObject()
  @IsOptional()
  object_attributes?: any;

  @IsObject()
  @IsOptional()
  project?: any;

  @IsString()
  @IsOptional()
  ref?: string;

  @IsObject()
  @IsOptional()
  commits?: any[];

  @IsString()
  @IsOptional()
  before?: string;

  @IsString()
  @IsOptional()
  after?: string;
}

export class GitHubWebhookDto {
  @IsString()
  @IsOptional()
  action?: string;

  @IsObject()
  @IsOptional()
  pull_request?: any;

  @IsObject()
  @IsOptional()
  repository?: any;

  @IsObject()
  @IsOptional()
  commits?: any[];

  @IsString()
  @IsOptional()
  ref?: string;

  @IsString()
  @IsOptional()
  before?: string;

  @IsString()
  @IsOptional()
  after?: string;
}
