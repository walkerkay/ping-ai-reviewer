export const outputExample = {
  overview: '代码修改总结',
  detailComment: '详细的 Review 结果, 可包含 markdown 格式',
  lineComments: [
    {
      file: '文件路径',
      line: 1,
      comment: '具体的评论内容，可包含 markdown 格式',
    },
  ],
  notification: '',
};
 
export function outroPrompt(language: string): string {
  return `
  要求：
  1. 使用 ${language} 语言进行输出
  2. 请返回 JSON 格式数据，严格遵循示例格式 ${JSON.stringify(outputExample)}
  3. overview 尽量简洁明了，只有具有实际业务的更改才需要输出，否则可为空
  4. detailComment 是详细的 Review 结果，可用 markdown 格式
  5. lineComments 是行级评论，只有你任务必须修改的意见需要生成行级评论，必须包含 file、line、comment，不要输出其他字段、示例值或多余文字，如果 lineComments 包含所有修改意见，则 detailComment 可为空 
  6. notification 是用于是通知推送内容，要求纯文本可包含换行符，
      示例内容：
       状态：❌ 不可合并（✅ 可合并、⚠️ 可合并、❌ 不可合并
       1.存在 2 处命名不规范问题，建议修改变量名
       2.存在 1 处严重缺陷"
  `;
}
