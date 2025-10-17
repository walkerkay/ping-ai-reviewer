export function strictPrompt(content: {
  commitMessages: string;
  diff: string;
}): string {
  return `
请对以下代码变更进行严格审查：
1. 代码质量和规范性
2. 潜在安全问题
3. 性能优化建议
4. 可维护性和可读性
5. 最佳实践建议

提交信息：${content.commitMessages}
代码变更：
\`\`\`
${content.diff}
\`\`\`

请提供详细改进建议和代码示例。
`;
}
