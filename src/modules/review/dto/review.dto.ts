import { IsNotEmpty, IsString, IsOptional, IsNumber } from "class-validator";

export class ReviewRequestDto {
    @IsString()
    @IsNotEmpty()
    repo: string;

    @IsString()
    @IsOptional()
    owner?: string;

    @IsNotEmpty()
    @IsNumber()
    mrNumber: number;

    @IsNotEmpty()
    @IsOptional()
    projectId?: string;

    @IsNotEmpty()
    @IsString()
    @IsOptional()
    projectName?: string;

    @IsString()
    @IsNotEmpty()
    mrState: string;

    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    eventType: string;

    @IsString()
    @IsNotEmpty()
    sourceBranch: string;

    @IsString()
    @IsNotEmpty()
    targetBranch: string;

    @IsString()
    @IsOptional()
    commitSha?: string;

    @IsString()
    @IsNotEmpty()
    llmProvider: string;

    @IsString()
    @IsNotEmpty()
    llmProviderApiKey?: string;

}