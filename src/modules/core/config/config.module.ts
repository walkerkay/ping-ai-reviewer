import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CodeStandardsService } from './code-standards.service';

@Module({
  imports: [HttpModule],
  providers: [CodeStandardsService],
  exports: [CodeStandardsService],
})
export class ConfigModule {}
