import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { GitClientInterface } from '../../git/interfaces/git-client.interface';
import { AssetsLoaderService } from './assets-loader.service';

describe('AssetsLoaderService', () => {
  let service: AssetsLoaderService;
  let httpService: HttpService;
  let mockGitClient: jest.Mocked<GitClientInterface>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    mockGitClient = {
      getContentAsText: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsLoaderService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<AssetsLoaderService>(AssetsLoaderService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loadReferences', () => {
    it('should load references from files and URLs', async () => {
      const references = [
        {
          path: './docs/code-style.md',
          description: '代码风格规范',
        },
        {
          url: 'https://example.com/guidelines',
          description: '开发指南',
        },
      ];

      // Mock file content
      mockGitClient.getContentAsText.mockResolvedValue(
        '# 代码风格规范\n\n## 命名规范\n- 使用驼峰命名',
      );

      // Mock HTTP response
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: '# 开发指南\n\n## 最佳实践\n- 遵循SOLID原则',
        }) as any,
      );

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('代码风格规范');
      expect(result[1]).toContain('开发指南');
    });

    it('should handle empty references array', async () => {
      const result = await service.loadReferences(
        [],
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toEqual([]);
    });

    it('should handle file not found gracefully', async () => {
      const references = [
        {
          path: './docs/non-existent.md',
          description: '备用描述',
        },
      ];

      mockGitClient.getContentAsText.mockRejectedValue(
        new Error('File not found'),
      );

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('参考信息: 备用描述');
    });

    it('should handle HTTP request failure gracefully', async () => {
      const references = [
        {
          url: 'https://example.com/invalid-url',
          description: '备用描述',
        },
      ];

      jest.spyOn(httpService, 'get').mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('参考信息: 备用描述');
    });

    it('should use cache for repeated requests', async () => {
      const references = [
        {
          path: './docs/code-style.md',
          description: '代码风格规范',
        },
      ];

      mockGitClient.getContentAsText.mockResolvedValue('# 代码风格规范');

      // First call
      await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      // Second call should use cache
      await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      // getContentAsText should only be called once due to caching
      expect(mockGitClient.getContentAsText).toHaveBeenCalledTimes(1);
    });

    it('should parse HTML content from URL to plain text', async () => {
      const references = [
        {
          url: 'https://example.com/html-doc',
          description: 'HTML文档',
        },
      ];

      const htmlContent = `
        <html>
          <head><title>开发指南</title></head>
          <body>
            <h1>代码规范</h1>
            <p>这是重要的开发规范</p>
            <script>console.log('test');</script>
            <style>body { color: red; }</style>
          </body>
        </html>
      `;

      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: htmlContent,
        }) as any,
      );

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('开发指南');
      expect(result[0]).toContain('代码规范');
      expect(result[0]).toContain('这是重要的开发规范');
      expect(result[0]).not.toContain('<html>');
      expect(result[0]).not.toContain('<script>');
      expect(result[0]).not.toContain('<style>');
    });

    it('should parse HTML content from file to plain text', async () => {
      const references = [
        {
          path: './docs/html-guide.html',
          description: 'HTML指南',
        },
      ];

      const htmlContent = `
        <html>
          <head><title>API设计规范</title></head>
          <body>
            <h2>RESTful API</h2>
            <p>遵循REST原则设计API</p>
            <!-- 这是注释 -->
            <div>重要提示：使用适当的HTTP状态码</div>
          </body>
        </html>
      `;

      mockGitClient.getContentAsText.mockResolvedValue(htmlContent);

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('API设计规范');
      expect(result[0]).toContain('RESTful API');
      expect(result[0]).toContain('遵循REST原则设计API');
      expect(result[0]).toContain('重要提示：使用适当的HTTP状态码');
      expect(result[0]).not.toContain('<html>');
      expect(result[0]).not.toContain('<!-- 这是注释 -->');
    });

    it('should parse Markdown content from file to plain text', async () => {
      const references = [
        {
          path: './docs/code-style.md',
          description: 'Markdown代码规范',
        },
      ];

      const markdownContent = `
# 代码风格规范

## 命名规范
- 使用驼峰命名法
- 变量名要有意义

## 代码质量
**重要提示**：确保代码可读性

\`\`\`javascript
// 示例代码
function example() {
  return 'hello';
}
\`\`\`

> 这是引用内容

[参考链接](https://example.com)
      `;

      mockGitClient.getContentAsText.mockResolvedValue(markdownContent);

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('代码风格规范');
      expect(result[0]).toContain('命名规范');
      expect(result[0]).toContain('使用驼峰命名法');
      expect(result[0]).toContain('变量名要有意义');
      expect(result[0]).toContain('重要提示');
      expect(result[0]).toContain('确保代码可读性');
      expect(result[0]).toContain('这是引用内容');
      expect(result[0]).toContain('参考链接');
      expect(result[0]).not.toContain('#');
      expect(result[0]).not.toContain('**');
      expect(result[0]).not.toContain('```');
      expect(result[0]).not.toContain('>');
    });

    it('should parse JSON content from file', async () => {
      const references = [
        {
          path: './docs/config.json',
          description: '配置文件',
        },
      ];

      const jsonContent = JSON.stringify(
        {
          rules: {
            naming: 'camelCase',
            maxLineLength: 100,
            requireComments: true,
          },
          guidelines: ['Use meaningful variable names', 'Keep functions small'],
        },
        null,
        2,
      );

      mockGitClient.getContentAsText.mockResolvedValue(jsonContent);

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('rules');
      expect(result[0]).toContain('naming');
      expect(result[0]).toContain('camelCase');
      expect(result[0]).toContain('maxLineLength');
      expect(result[0]).toContain('guidelines');
      expect(result[0]).toContain('Use meaningful variable names');
    });

    it('should parse plain text content from file', async () => {
      const references = [
        {
          path: './docs/guidelines.txt',
          description: '纯文本指南',
        },
      ];

      const textContent = `
        代码审查指南
        
        1. 检查代码质量
        2. 确保安全性
        3. 验证性能
        
        重要提示：所有代码都需要经过审查
      `;

      mockGitClient.getContentAsText.mockResolvedValue(textContent);

      const result = await service.loadReferences(
        references,
        mockGitClient,
        'owner',
        'repo',
        'main',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('代码审查指南');
      expect(result[0]).toContain('检查代码质量');
      expect(result[0]).toContain('确保安全性');
      expect(result[0]).toContain('验证性能');
      expect(result[0]).toContain('重要提示：所有代码都需要经过审查');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      service.clearCache();
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});
