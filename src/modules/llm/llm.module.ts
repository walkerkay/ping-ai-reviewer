import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMFactory } from './llm.factory';
import { DeepSeekClient } from './clients/deepseek.client';
import { OpenAIClient } from './clients/openai.client';

@Module({
  imports: [HttpModule],
  providers: [LLMFactory, DeepSeekClient, OpenAIClient],
  exports: [LLMFactory],
})
export class LlmModule {}

