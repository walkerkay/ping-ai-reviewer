import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHome(): string {
    return `
      <h2>Ping Code Review API is running.</h2>
      <p>GitHub project address: <a href="https://github.com/sunmh207/AI-Codereview-Gitlab" target="_blank">
      https://github.com/sunmh207/AI-Codereview-Gitlab</a></p>
      <p>Gitee project address: <a href="https://gitee.com/sunminghui/ai-codereview-gitlab" target="_blank">https://gitee.com/sunminghui/ai-codereview-gitlab</a></p>
    `;
  }

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

