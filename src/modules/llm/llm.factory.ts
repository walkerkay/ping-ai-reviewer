import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { LLMClient } from './interfaces/llm-client.interface';
import { DeepSeekClient } from './clients/deepseek.client';
import { OpenAIClient } from './clients/openai.client';

@Injectable()
export class LLMFactory {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  getClient(provider?: string, providerApiKey?: string): LLMClient {
    const llmProvider = provider || this.configService.get<string>('LLM_PROVIDER', 'deepseek');
    
    switch (llmProvider.toLowerCase()) {
      case 'deepseek':
        return new DeepSeekClient(this.configService, this.httpService, providerApiKey);
      case 'openai':
        return new OpenAIClient(this.configService, this.httpService, providerApiKey);
      default:
        throw new Error(`Unknown LLM provider: ${llmProvider}`);
    }
  }
}

