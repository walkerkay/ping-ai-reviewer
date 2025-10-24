export class LLMTokenCalculator {
  static estimateTokens(text: string): number {
    if (!text) return 0;
    
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    return Math.ceil(chineseChars * 1.5 + otherChars * 0.8);
  }

  static calculatePromptTokens(messages: Array<{role: string, content: string}>): number {
    return messages.reduce((total, message) => {
      return total + this.estimateTokens(message.content);
    }, 0);
  }

  static optimizeText(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .replace(/^\s+|\s+$/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[，。；：""''（）【】]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  static optimizeReferences(references: string[]): string[] {
    if (!references || references.length === 0) return references;
    
    return references.map(ref => this.optimizeText(ref));
  }
}
