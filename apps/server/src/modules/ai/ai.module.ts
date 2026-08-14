import { Module } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiService } from './ai.service';

@Module({
  providers: [AiConfigService, AiService],
  exports: [AiConfigService, AiService],
})
export class AiModule {}
