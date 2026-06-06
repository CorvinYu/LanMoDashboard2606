import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER,
  AiProvider,
} from './providers/ai-provider.interface';

@Injectable()
export class AiService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  suggest(message: string) {
    return this.provider.complete({
      responseFormat: 'json',
      messages: [
        {
          role: 'system',
          content:
            'You are a personal planning assistant. Only return suggestions as JSON. Never claim that you changed a user schedule.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });
  }
}
