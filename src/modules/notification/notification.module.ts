import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationService } from './notification.service';
import { DingTalkNotifier } from './notifiers/dingtalk.notifier';
import { WeComNotifier } from './notifiers/wecom.notifier';
import { FeishuNotifier } from './notifiers/feishu.notifier';

@Module({
  imports: [HttpModule],
  providers: [NotificationService, DingTalkNotifier, WeComNotifier, FeishuNotifier],
  exports: [NotificationService],
})
export class NotificationModule {}
