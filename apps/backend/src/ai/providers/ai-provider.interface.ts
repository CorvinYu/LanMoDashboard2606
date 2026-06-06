export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompletionInput = {
  messages: AiMessage[];
  responseFormat?: 'text' | 'json';
};

export type AiCompletionOutput = {
  content: string;
  provider: string;
  model: string;
};

export interface AiProvider {
  complete(input: AiCompletionInput): Promise<AiCompletionOutput>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
