import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { GitModule } from '../git/git.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [GitModule, ReviewModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}

