import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IntegrationService } from './integration.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}

