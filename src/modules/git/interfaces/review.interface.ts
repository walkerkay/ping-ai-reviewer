import { GitClientType } from "./git-client.interface";

interface ReviewLLMOption {
    llmProvider?: string;
    llmProviderApiKey?: string;
}

export interface ParsedPushReviewData extends ReviewLLMOption {
    repo: string;
    owner: string;
    commitId: string;
    branch: string;
    projectName: string;
    eventType: string;
}

export interface ParsedPullRequestReviewData extends ReviewLLMOption {
    repo: string;
    owner: string;
    mrNumber: number;
    mrState: string;
    commitId?: string;
    sourceBranch: string;
    targetBranch: string;
    projectName: string;
    eventType: string;
}