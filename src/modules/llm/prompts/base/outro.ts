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

const defaultNotificationTemplate = `
  状态: {{ status }}  ✅ 可合并、🔍 需检查 、💥 严重问题
  1. 存在 2 处命名不规范问题，建议修改变量名
  2. 存在 1 处严重缺陷
  `;

export function outroPrompt(
  language: string,
  max_review_length: number,
): string {
  return `
  重要约束：
  1. 使用 ${language} 语言进行输出
  2. 请返回 JSON 格式数据，严格遵循示例格式 ${JSON.stringify(outputExample)}
  3. overview 是针对提交代码实现的总结，不需要包含审查意见，尽量简洁明了，只有具有实际业务的更改才需要输出，否则可为空
  4. lineComments 是行级评论，只有你任务必须修改的意见需要生成行级评论，必须包含 file、line、comment，不要输出其他字段、示例值或多余文字，如果 lineComments 包含所有修改意见，则 detailComment 可为空 
  5. 优先使用行级评论进行具体问题定位，detailComment 用于总结和补充说明，可用 markdown 格式，长度不超过 ${max_review_length} 字符
  6. 参考信息用于辅助检查，如果存在上次审查结论，需要结合上次审查结论进行检查
  7. notification， 是用于是通知推送内容，参考以下模板，纯文本可包含换行符，示例：${defaultNotificationTemplate}
  8. 合理使用相关Emoji,不要过度使用
       - 🐛 表示bug
       - 💥 表示严重问题
       - 🎯 表示改进建议
       - 🔍 表示需要仔细检查
  `;
}
