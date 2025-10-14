import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationService } from './notification.service';
import { DingTalkNotifier } from './notifiers/dingtalk.notifier';
import { WeComNotifier } from './notifiers/wecom.notifier';
import { FeishuNotifier } from './notifiers/feishu.notifier';
import { PingCodeNotifier } from './notifiers/pingcode.notifier';

@Module({
  imports: [HttpModule],
  providers: [NotificationService, DingTalkNotifier, WeComNotifier, FeishuNotifier, PingCodeNotifier],
  exports: [NotificationService],
})
export class NotificationModule {}

