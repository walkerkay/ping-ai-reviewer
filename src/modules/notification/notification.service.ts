import { Injectable } from '@nestjs/common';
import { NotificationMessage } from './interfaces/notifier.interface';
import { DingTalkNotifier } from './notifiers/dingtalk.notifier';
import { WeComNotifier } from './notifiers/wecom.notifier';
import { FeishuNotifier } from './notifiers/feishu.notifier';
import { PingCodeNotifier } from './notifiers/pingcode.notifier';
import { logger } from '../core/logger';

@Injectable()
export class NotificationService {
  constructor(
    private dingTalkNotifier: DingTalkNotifier,
    private weComNotifier: WeComNotifier,
    private feishuNotifier: FeishuNotifier,
    private pingCodeNotifier: PingCodeNotifier,
  ) {}

  async sendNotification(message: NotificationMessage): Promise<void> {
    const promises: Promise<boolean>[] = [];

    if (this.dingTalkNotifier.isEnabled()) {
      promises.push(this.dingTalkNotifier.sendNotification(message));
    }

    if (this.weComNotifier.isEnabled()) {
      promises.push(this.weComNotifier.sendNotification(message));
    }

    if (this.feishuNotifier.isEnabled()) {
      promises.push(this.feishuNotifier.sendNotification(message));
    }

    if (this.pingCodeNotifier.isEnabled()) {
      promises.push(this.pingCodeNotifier.sendNotification(message));
    }

    if (promises.length === 0) {
      logger.info('No notification channels enabled', 'NotificationService');
      return;
    }

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Notification sending failed:', 'NotificationService', error.message);
    }
  }
}

