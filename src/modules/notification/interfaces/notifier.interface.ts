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

export interface Notifier {
  sendNotification(message: NotificationMessage): Promise<boolean>;
  isEnabled(): boolean;
}
