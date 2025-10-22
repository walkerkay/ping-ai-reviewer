import { FileChange } from '../git/interfaces/git-client.interface';
import { File as DiffFile, Chunk, Change } from 'parse-diff';
import * as parseDiff from 'parse-diff';

export interface LineMappingResult {
  originalLine: number;
  actualLine: number;
  isValid: boolean;
}

export interface DiffLineInfo {
  lineNumber: number;
  isAddition: boolean;
  isDeletion: boolean;
  content: string;
  filePath: string;
}

/**
 * 解析diff内容，提取行号信息
 */
export function parseDiffLines(fileChange: FileChange): DiffLineInfo[] {
  const diffLines: DiffLineInfo[] = [];
  const diffFiles = parseDiff(fileChange.patch);
  diffFiles.forEach(file => {
    file.chunks.forEach(chunk => {
      const lines = chunk.changes
        .map((change: Change) => {

          // 获取正确的行号
          const lineNum =
            change.type === "add"
              ? change.ln // 新增行的行号
              : change.type === "del"
                ? change.ln // 删除行的旧行号
                : change.ln2 ?? change.ln1 ?? ""; // 普通行：优先用新文件的行号

          // 去掉 diff 开头符号（如 + 或 -）
          const cleanContent = change.content.replace(/^[-+ ]/, "");
          let content = cleanContent;
          // 检查特殊行 "\ No newline at end of file"
          if (cleanContent.trim() === "\\ No newline at end of file") {
            content = `\n${cleanContent}`; // 不加符号和行号
          }

          return {
            lineNumber: +lineNum,
            isAddition: change.type === "add",
            isDeletion: change.type === "del",
            content: content,
            filePath: file.to || file.from || fileChange.filename,
          }
        });
      diffLines.push(...lines);
    });
  });
  return diffLines;
}

/**
 * 将diff中的行号映射到实际文件行号
 */
export function mapDiffLineToActualLine(
  fileChange: FileChange,
  diffLineNumber: number
): LineMappingResult {
  const diffLines = parseDiffLines(fileChange);

  // 查找对应的diff行
  const targetLine = diffLines.find(line => line.lineNumber === diffLineNumber);

  if (!targetLine) {
    return {
      originalLine: diffLineNumber,
      actualLine: diffLineNumber,
      isValid: false
    };
  }

  // 如果是新增行，直接返回行号
  if (targetLine.isAddition) {
    return {
      originalLine: diffLineNumber,
      actualLine: diffLineNumber,
      isValid: true
    };
  }

  // 如果是删除行，需要特殊处理
  if (targetLine.isDeletion) {
    return {
      originalLine: diffLineNumber,
      actualLine: diffLineNumber,
      isValid: false // 删除的行不能添加评论
    };
  }

  return {
    originalLine: diffLineNumber,
    actualLine: diffLineNumber,
    isValid: true
  };
}

/**
 * 智能匹配行号 - 当精确匹配失败时，尝试找到最接近的有效行
 */
export function findNearestValidLine(
  fileChange: FileChange,
  targetLine: number,
  maxDistance: number = 5
): LineMappingResult {
  const diffLines = parseDiffLines(fileChange);
  const additionLines = diffLines.filter(line => line.isAddition);

  if (additionLines.length === 0) {
    return {
      originalLine: targetLine,
      actualLine: targetLine,
      isValid: false
    };
  }

  // 查找最接近的添加行
  let nearestLine = additionLines[0];
  let minDistance = Math.abs(additionLines[0].lineNumber - targetLine);

  for (const line of additionLines) {
    const distance = Math.abs(line.lineNumber - targetLine);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLine = line;
    }
  }

  // 如果距离在可接受范围内，使用最近的行
  if (minDistance <= maxDistance) {
    return {
      originalLine: targetLine,
      actualLine: nearestLine.lineNumber,
      isValid: true
    };
  }

  return {
    originalLine: targetLine,
    actualLine: targetLine,
    isValid: false
  };
}

/**
 * 基于内容匹配找到正确的行号
 */
export function findLineByContent(
  fileChange: FileChange,
  comment: string,
  targetLine: number
): LineMappingResult {
  const diffLines = parseDiffLines(fileChange);
  const additionLines = diffLines.filter(line => line.isAddition);

  // 尝试从评论中提取关键词进行匹配
  const keywords = extractKeywords(comment);

  for (const line of additionLines) {
    if (keywords.some(keyword =>
      line.content.toLowerCase().includes(keyword.toLowerCase())
    )) {
      return {
        originalLine: targetLine,
        actualLine: line.lineNumber,
        isValid: true
      };
    }
  }

  // 如果内容匹配失败，回退到距离匹配
  return findNearestValidLine(fileChange, targetLine);
}

/**
 * 从评论中提取关键词
 */
function extractKeywords(comment: string): string[] {
  // 简单的关键词提取逻辑
  const words = comment
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'or', 'but', 'for', 'with', 'this', 'that'].includes(word));

  return words.slice(0, 3); // 取前3个关键词
}

/**
 * 验证并修正AI返回的行号（增强版）
 */
export function validateAndCorrectLineNumbers(
  lineComments: Array<{ file: string; line: number; comment: string }>,
  fileChanges: FileChange[],
  options: {
    enableSmartMatching?: boolean;
    enableContentMatching?: boolean;
    maxDistance?: number;
  } = {}
): Array<{ file: string; line: number; comment: string; isValid: boolean; corrected?: boolean }> {
  const {
    enableSmartMatching = true,
    enableContentMatching = true,
    maxDistance = 5
  } = options;

  return lineComments.map(comment => {
    const fileChange = fileChanges.find(fc => fc.filename === comment.file);

    if (!fileChange) {
      return {
        ...comment,
        isValid: false
      };
    }

    // 首先尝试精确匹配
    let mapping = mapDiffLineToActualLine(fileChange, comment.line);

    // 如果精确匹配失败且启用了智能匹配
    if (!mapping.isValid && enableSmartMatching) {
      // 尝试基于内容的匹配
      if (enableContentMatching) {
        mapping = findLineByContent(fileChange, comment.comment, comment.line);
      }

      // 如果内容匹配也失败，尝试距离匹配
      if (!mapping.isValid) {
        mapping = findNearestValidLine(fileChange, comment.line, maxDistance);
      }
    }

    return {
      file: comment.file,
      line: mapping.actualLine,
      comment: comment.comment,
      isValid: mapping.isValid,
      corrected: mapping.actualLine !== comment.line
    };
  }).filter(item => item.isValid);
}

export function formatDiffs(
  changes: FileChange[],
  mode: "raw" | "ai-friendly" = "ai-friendly",
  includeDeletedFiles: boolean = false
): string {
  const parsedFiles: (DiffFile & { __filename: string })[] = [];

  // === 原始模式 ===
  if (mode === "raw") {
    return changes
      .map((c) => `文件: ${c.filename}\n${c.patch || ""}`)
      .join("\n\n==================== 文件分隔 ====================\n\n");
  }


  // === AI 友好模式 ===

  // 解析每个文件的 diff
  for (const change of changes) {
    // 如果不包含删除文件且文件状态为 removed
    if (!includeDeletedFiles && change.status === "removed") continue;
    if (!change.patch) continue;
    const parsedDiffs = parseDiff(change.patch);
    parsedFiles.push(
      ...parsedDiffs.map((diff) => ({
        ...diff,
        __filename: change.filename,
      })),
    );
  }

  const text = parsedFiles
    .map((file) => {
      const fileHeader = `文件: ${file.to || file.from || file.__filename}`;

      const chunksText = file.chunks
        .map((chunk: Chunk) => {
          const header = `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`;

          const lines = chunk.changes
            .map((change: Change) => {
              // diff 符号
              const symbol =
                change.type === "add"
                  ? "+"
                  : change.type === "del"
                    ? "-"
                    : " ";

              // 获取正确的行号
              const lineNum =
                change.type === "add"
                  ? change.ln // 新增行的行号
                  : change.type === "del"
                    ? change.ln // 删除行的旧行号
                    : change.ln2 ?? change.ln1 ?? ""; // 普通行：优先用新文件的行号

              // 去掉 diff 开头符号（如 + 或 -）
              const cleanContent = change.content.replace(/^[-+ ]/, "");

              // 检查特殊行 "\ No newline at end of file"
              if (cleanContent.trim() === "\\ No newline at end of file") {
                return `\n${cleanContent}`; // 不加符号和行号
              }

              return `${symbol} (${lineNum}) ${cleanContent}`;
            })
            .join("\n");

          return `${header}\n${lines}`;
        })
        .join("\n\n-----\n\n");

      return `${fileHeader}\n${chunksText}`;
    })
    .join("\n\n==================== 文件分隔 ====================\n\n");

  return text;
}