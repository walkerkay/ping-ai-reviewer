import { outroPrompt } from './base/outro';
import { systemPrompt } from './base/system';
import { lightPrompt } from './modes/light';
import { strictPrompt } from './modes/strict';

type PromptMessage = { role: 'system' | 'user'; content: string };

export class PromptBuilder {
  static buildReviewPrompt(payload: {
    diff?: string;
    commitMessages?: string;
    language: 'zh' | 'en';
    mode: 'light' | 'strict';
    max_review_length: number;
    codeStandards?: string;
  }): PromptMessage[] {
    const promptMessages = [{ role: 'system', content: systemPrompt() }];

    if (payload.mode === 'strict') {
      promptMessages.push({
        role: 'user',
        content: strictPrompt({
          commitMessages: payload.commitMessages,
          diff: payload.diff,
          codeStandards: payload.codeStandards,
        }),
      });
    } else {
      promptMessages.push({
        role: 'user',
        content: lightPrompt({
          commitMessages: payload.commitMessages,
          diff: payload.diff,
          codeStandards: payload.codeStandards,
        }),
      });
    }

    promptMessages.push({
      role: 'user',
      content: outroPrompt(payload.language, payload.max_review_length),
    });

    return promptMessages as PromptMessage[];
  }
}
