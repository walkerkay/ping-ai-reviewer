import { systemPrompt } from './base/system';
import { outroPrompt } from './base/outro';
import { lightPrompt } from './modes/light';
import { strictPrompt } from './modes/strict';
import { LLMTokenCalculator } from '../utils/llm-token-calculator';

type PromptMessage = { role: 'system' | 'user'; content: string };

export class PromptBuilder {
  static buildReviewPrompt(payload: {
    diff?: string;
    commitMessages?: string;
    references?: string[];
    language: 'zh' | 'en'; 
    mode: 'light' | 'strict';
    max_output_tokens: number;
    max_input_tokens: number;
  }): { messages: PromptMessage[] | null, inputTokens: number } {
    const optimizedDiff = LLMTokenCalculator.optimizeText(payload.diff || '');
    const optimizedCommitMessages = LLMTokenCalculator.optimizeText(payload.commitMessages || '');
    const optimizedReferences = LLMTokenCalculator.optimizeReferences(payload.references || []);
    
    const promptMessages = [{ role: 'system', content: systemPrompt() }];

    if (payload.mode === 'strict') {
      promptMessages.push({
        role: 'user',
        content: strictPrompt({
          commitMessages: optimizedCommitMessages,
          diff: optimizedDiff,
          references: optimizedReferences,
        }),
      });
    } else {
      promptMessages.push({
        role: 'user',
        content: lightPrompt({
          commitMessages: optimizedCommitMessages,
          diff: optimizedDiff,
          references: optimizedReferences,
        }),
      });
    }

    promptMessages.push({
      role: 'user',
      content: outroPrompt(
        payload.language,
        payload.max_output_tokens, 
      ),
    });

    const inputTokens = LLMTokenCalculator.calculatePromptTokens(promptMessages);
    
    if (inputTokens > payload.max_input_tokens) {
      console.log(`Input tokens (${inputTokens}) exceeds limit (${payload.max_input_tokens}), skipping review`);
      return { messages: null, inputTokens };
    }

    return { messages: promptMessages as PromptMessage[], inputTokens };
  }
}
