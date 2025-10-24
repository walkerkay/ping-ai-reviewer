import { GitClientType } from "./git-client.interface";

interface ReviewLLMOption {
    llmProvider?: string;
    llmProviderApiKey?: string;
}

export interface ParsedPushReviewData extends ReviewLLMOption {
    repo: string;
    owner: string;
    commitSha: string;
    branch: string;
    projectName: string;
    eventType: string;
}

export interface ParsedPullRequestReviewData extends ReviewLLMOption {
    repo: string;
    owner: string;
    mrNumber: number;
    mrState: string;
    commitSha?: string;
    sourceBranch: string;
    targetBranch: string;
    projectName: string;
    eventType: string;
}