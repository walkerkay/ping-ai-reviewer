import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { GitClientInterface } from '../../git/interfaces/git-client.interface';
import { logger } from '../logger';

export interface ReferenceItem {
  path?: string;
  url?: string;
  description?: string;
}

export interface LoadedReference {
  content: string;
  source: string;
  description?: string;
}

const HTML_REGEX = {
  VALIDATE_HTML: /<([^>]+)>.*?<\/\1>/i, // 验证HTML
  COMMENT: /<!--[\s\S]*?-->/g, // 匹配HTML注释
  STYLE_TAG: /<style[\s\S]*?>[\s\S]*?<\/style>/gi, // 匹配<style>标签及内容
  SCRIPT_TAG: /<script[\s\S]*?>[\s\S]*?<\/script>/gi, // 匹配<script>标签及内容
  HTML_TAG: /<[^>]*>/g, // 匹配HTML标签
  WHITESPACE: /\s+/g, // 匹配多余的空白字符
};

const MARKDOWN_REGEX = {
  HEADER: /^#{1,6}\s+/gm, // 匹配Markdown标题
  BOLD: /\*\*(.*?)\*\*/g, // 匹配粗体
  ITALIC: /\*(.*?)\*/g, // 匹配斜体
  CODE_BLOCK: /```[\s\S]*?```/g, // 匹配代码块
  INLINE_CODE: /`([^`]+)`/g, // 匹配行内代码
  LINK: /\[([^\]]+)\]\([^)]+\)/g, // 匹配链接
  IMAGE: /!\[([^\]]*)\]\([^)]+\)/g, // 匹配图片
  LIST_ITEM: /^[\s]*[-*+]\s+/gm, // 匹配列表项
  QUOTE: /^>\s+/gm, // 匹配引用
  HORIZONTAL_RULE: /^[-*_]{3,}$/gm, // 匹配水平线
};

@Injectable()
export class AssetsLoaderService {
  private cache = new Map<string, LoadedReference>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CONTENT_LENGTH = 3000; // 最大内容长度
  private readonly MAX_HTTP_TIMEOUT = 10000; // HTTP请求超时时间

  constructor(private httpService: HttpService) {}

  /**
   * 加载所有references的内容
   */
  async loadReferences(
    references: ReferenceItem[],
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<string[]> {
    if (!references || references.length === 0) {
      return [];
    }

    const loadedReferences: string[] = [];

    for (const reference of references) {
      try {
        const loadedRef = await this.loadSingleReference(
          reference,
          gitClient,
          owner,
          repo,
          ref,
        );

        if (loadedRef) {
          loadedReferences.push(this.formatReferenceContent(loadedRef));
        }
      } catch (error) {
        logger.warn(
          `Failed to load reference: ${reference.path || reference.url}`,
          'ReferenceLoaderService',
          error.message,
        );
        // 如果reference有description，即使加载失败也使用description
        if (reference.description) {
          loadedReferences.push(`参考信息: ${reference.description}`);
        }
      }
    }

    return loadedReferences;
  }

  /**
   * 加载单个reference
   */
  private async loadSingleReference(
    reference: ReferenceItem,
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<LoadedReference | null> {
    const cacheKey = this.getCacheKey(reference, owner, repo, ref);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    let content: string;
    let source: string;

    if (reference.url) {
      // HTTP URL
      const result = await this.loadFromUrl(reference.url);
      content = result.content;
      source = reference.url;
    } else if (reference.path) {
      // 内部文件路径
      const result = await this.loadFromFile(
        reference.path,
        gitClient,
        owner,
        repo,
        ref,
      );
      content = result.content;
      source = reference.path;
    } else {
      return null;
    }

    const loadedRef: LoadedReference = {
      content,
      source,
      description: reference.description,
    };

    // 缓存结果
    this.cache.set(cacheKey, {
      ...loadedRef,
      cachedAt: Date.now(),
    } as any);

    return loadedRef;
  }

  /**
   * 从URL加载内容
   */
  private async loadFromUrl(url: string): Promise<{ content: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: this.MAX_HTTP_TIMEOUT,
          headers: {
            'User-Agent': 'PingAI-Reviewer/1.0',
            Accept: 'text/plain, text/markdown, application/json',
          },
        }),
      );

      let content = response.data;

      // 如果是JSON，尝试提取有用信息
      if (typeof content === 'object') {
        content = JSON.stringify(content, null, 2);
      }

      // 如果是HTML内容，解析为纯文本
      if (typeof content === 'string' && this.isHTMLContent(content)) {
        content = this.extractTextFromHTML(content);
      }

      // 限制内容长度
      if (content.length > this.MAX_CONTENT_LENGTH) {
        content = content.substring(0, this.MAX_CONTENT_LENGTH) + '...';
      }

      return { content };
    } catch (error) {
      throw new Error(`Failed to load URL ${url}: ${error.message}`);
    }
  }

  /**
   * 从文件加载内容
   */
  private async loadFromFile(
    path: string,
    gitClient: GitClientInterface,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<{ content: string }> {
    try {
      const content = await gitClient.getContentAsText(owner, repo, path, ref);

      if (!content) {
        throw new Error(`File not found: ${path}`);
      }

      // 根据文件类型提取纯文本
      let processedContent = this.extractTextFromFile(content, path);

      // 限制内容长度
      if (processedContent.length > this.MAX_CONTENT_LENGTH) {
        processedContent =
          processedContent.substring(0, this.MAX_CONTENT_LENGTH) + '...';
      }

      return { content: processedContent };
    } catch (error) {
      throw new Error(`Failed to load file ${path}: ${error.message}`);
    }
  }

  /**
   * 格式化reference内容用于LLM
   */
  private formatReferenceContent(loadedRef: LoadedReference): string {
    let formatted = `参考来源: ${loadedRef.source}\n`;

    if (loadedRef.description) {
      formatted += `描述: ${loadedRef.description}\n`;
    }

    formatted += `内容:\n${loadedRef.content}`;

    return formatted;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(
    reference: ReferenceItem,
    owner: string,
    repo: string,
    ref: string,
  ): string {
    const key = reference.url || reference.path;
    return `${owner}/${repo}/${ref}/${key}`;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cached: any): boolean {
    return Date.now() - cached.cachedAt < this.CACHE_TTL;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 根据文件类型提取纯文本
   */
  private extractTextFromFile(content: string, filePath: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const extension = this.getFileExtension(filePath).toLowerCase();

    switch (extension) {
      case 'html':
      case 'htm':
        return this.extractTextFromHTML(content);
      case 'md':
      case 'markdown':
        return this.extractTextFromMarkdown(content);
      case 'txt':
      case 'text':
        return this.extractTextFromPlainText(content);
      case 'json':
        return this.extractTextFromJSON(content);
      case 'yaml':
      case 'yml':
        return this.extractTextFromYAML(content);
      default:
        // 尝试检测内容类型
        if (this.isHTMLContent(content)) {
          return this.extractTextFromHTML(content);
        } else if (this.isMarkdownContent(content)) {
          return this.extractTextFromMarkdown(content);
        } else {
          return this.extractTextFromPlainText(content);
        }
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex !== -1 ? filePath.substring(lastDotIndex + 1) : '';
  }

  /**
   * 检测内容是否为HTML格式
   */
  private isHTMLContent(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // 检查是否包含HTML标签
    return HTML_REGEX.VALIDATE_HTML.test(content.trim());
  }

  /**
   * 检测内容是否为Markdown格式
   */
  private isMarkdownContent(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // 检查是否包含Markdown特征
    return (
      /^#{1,6}\s+/.test(content.trim()) ||
      /\*\*.*?\*\*/.test(content) ||
      /```[\s\S]*?```/.test(content)
    );
  }

  /**
   * 从HTML中提取纯文本
   */
  extractTextFromHTML(html: string): string {
    try {
      let cleanedHTML = html.replace(HTML_REGEX.COMMENT, '');
      cleanedHTML = cleanedHTML.replace(HTML_REGEX.STYLE_TAG, '');
      cleanedHTML = cleanedHTML.replace(HTML_REGEX.SCRIPT_TAG, '');
      const pureText = cleanedHTML.replace(HTML_REGEX.HTML_TAG, '').trim();
      return pureText.replace(HTML_REGEX.WHITESPACE, ' ');
    } catch {
      return '';
    }
  }

  /**
   * 从Markdown中提取纯文本
   */
  private extractTextFromMarkdown(markdown: string): string {
    try {
      let text = markdown;

      // 移除代码块
      text = text.replace(MARKDOWN_REGEX.CODE_BLOCK, '');

      // 移除行内代码的标记，保留内容
      text = text.replace(MARKDOWN_REGEX.INLINE_CODE, '$1');

      // 移除链接，保留文本
      text = text.replace(MARKDOWN_REGEX.LINK, '$1');

      // 移除图片
      text = text.replace(MARKDOWN_REGEX.IMAGE, '');

      // 移除粗体和斜体标记，保留内容
      text = text.replace(MARKDOWN_REGEX.BOLD, '$1');
      text = text.replace(MARKDOWN_REGEX.ITALIC, '$1');

      // 移除标题标记
      text = text.replace(MARKDOWN_REGEX.HEADER, '');

      // 移除列表标记
      text = text.replace(MARKDOWN_REGEX.LIST_ITEM, '');

      // 移除引用标记
      text = text.replace(MARKDOWN_REGEX.QUOTE, '');

      // 移除水平线
      text = text.replace(MARKDOWN_REGEX.HORIZONTAL_RULE, '');

      // 压缩空白字符
      return text.replace(HTML_REGEX.WHITESPACE, ' ').trim();
    } catch {
      return '';
    }
  }

  /**
   * 从纯文本中提取内容
   */
  private extractTextFromPlainText(text: string): string {
    try {
      return text.replace(HTML_REGEX.WHITESPACE, ' ').trim();
    } catch {
      return '';
    }
  }

  /**
   * 从JSON中提取纯文本
   */
  private extractTextFromJSON(jsonString: string): string {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  }

  /**
   * 从YAML中提取纯文本
   */
  private extractTextFromYAML(yamlString: string): string {
    try {
      // 简单的YAML到文本转换，移除YAML语法标记
      let text = yamlString;

      // 移除YAML注释
      text = text.replace(/^\s*#.*$/gm, '');

      // 移除YAML键值分隔符
      text = text.replace(/^\s*-\s*/gm, '');

      // 压缩空白字符
      return text.replace(HTML_REGEX.WHITESPACE, ' ').trim();
    } catch {
      return yamlString;
    }
  }
}
