export function strictPrompt(content: {
  commitMessages: string;
  diff: string;
  references?: string[];
}): string {
  return `
    请对以下代码变更进行严格审查：
    1. 代码质量和规范性
    2. 潜在安全问题
    3. 潜在的性能问题（死循环、内存泄漏、性能瓶颈等）
    4. 性能优化建议
    5. 可维护性和可读性
    6. 最佳实践建议

    参考信息：
    ${content.references?.map((reference) => `- ${reference}`).join('\n')}
    \n\n  

    提交信息：
    ${content.commitMessages}
    \n\n
    代码变更：
    \`\`\`
    ${content.diff}
    \`\`\`

    请提供详细改进建议和代码示例。
    `;
}
