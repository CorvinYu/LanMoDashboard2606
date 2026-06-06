import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { aiProviderFactory } from './providers/ai-provider.factory';

@Module({
  controllers: [AiController],
  providers: [AiService, aiProviderFactory],
  exports: [AiService],
})
export class AiModule {}
