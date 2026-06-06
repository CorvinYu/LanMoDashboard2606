import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai-provider.interface';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

export const aiProviderFactory = {
  provide: AI_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const provider = config.get<string>('AI_PROVIDER', 'openai_compatible');

    if (provider === 'openai_compatible') {
      return new OpenAiCompatibleProvider(config);
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
  },
};
