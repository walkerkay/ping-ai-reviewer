import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ReferenceLoaderService } from './reference-loader.service';

@Module({
  imports: [HttpModule],
  providers: [ReferenceLoaderService],
  exports: [ReferenceLoaderService],
})
export class ReferenceModule {}
