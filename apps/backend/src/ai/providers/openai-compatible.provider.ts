import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AiCompletionInput,
  AiCompletionOutput,
  AiProvider,
} from './ai-provider.interface';

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.model = config.getOrThrow<string>('AI_MODEL');
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('AI_API_KEY'),
      baseURL: config.getOrThrow<string>('AI_BASE_URL'),
    });
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionOutput> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: input.messages,
      response_format:
        input.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    return {
      content: response.choices[0]?.message?.content ?? '',
      provider: 'openai_compatible',
      model: this.model,
    };
  }
}
