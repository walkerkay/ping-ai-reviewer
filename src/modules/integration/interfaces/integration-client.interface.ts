export enum IntegrationClientType {
  PingCode = 'pingcode',
  DingTalk = 'dingtalk',
  WeCom = 'wecom',
  Feishu = 'feishu',
}

export interface NotificationMessage {
  content: string;
  title?: string;
  msgType?: 'text' | 'markdown';
  additions?: {
    pullRequest?: {
      title?: string;
      url?: string;
    };
  };
}

export interface IntegrationClientInterface {
  sendNotification(message: NotificationMessage): Promise<boolean>;

  pushSummary?(summary: string): Promise<boolean>;
}
