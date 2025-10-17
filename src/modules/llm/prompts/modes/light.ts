export function lightPrompt(content: {
  commitMessages: string;
  diff: string;
}): string {
  return `
请对以下代码变更进行轻量审查：
1. 只关注重要问题：安全漏洞、明显bug、性能问题、严重代码质量问题
2. 忽略轻微的代码风格问题
3. 优先关注核心逻辑和关键变更
4. 保持评论简洁明了

  提交信息：${content.commitMessages}
  代码变更：
  \`\`\`
  ${content.diff}
  \`\`\`

`;
}
