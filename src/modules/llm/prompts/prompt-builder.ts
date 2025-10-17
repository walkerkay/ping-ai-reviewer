import { systemPrompt } from './base/system';
import { outroPrompt } from './base/outro';
import { lightPrompt } from './modes/light';
import { strictPrompt } from './modes/strict';

type PromptMessage = { role: 'system' | 'user'; content: string };

export class PromptBuilder {
  static buildReviewPrompt(
    payload: {
      language: string;
      mode: 'light' | 'strict';
      diff?: string;
      commitMessages?: string;
    } = {
      language: '中文',
      mode: 'light',
    },
  ): PromptMessage[] {
    const promptMessages = [{ role: 'system', content: systemPrompt() }];

    if (payload.mode === 'strict') {
      promptMessages.push({
        role: 'user',
        content: strictPrompt({
          commitMessages: payload.commitMessages,
          diff: payload.diff,
        }),
      });
    } else {
      promptMessages.push({
        role: 'user',
        content: lightPrompt({
          commitMessages: payload.commitMessages,
          diff: payload.diff,
        }),
      });
    }

    promptMessages.push({
      role: 'user',
      content: outroPrompt(payload.language),
    });

    return promptMessages as PromptMessage[];
  }
}
