import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

type ChatBody = {
  message: string;
};

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  chat(@Body() body: ChatBody) {
    return this.aiService.suggest(body.message);
  }
}
