export interface NotificationMessage {
  content: string;
  title?: string;
  prTitle?: string;
  msgType?: 'text' | 'markdown';
}

export interface Notifier {
  sendNotification(message: NotificationMessage): Promise<boolean>;
  isEnabled(): boolean;
}

