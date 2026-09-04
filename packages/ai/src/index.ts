export * from './provider';
export * from './schemas';
export * from './extract';
export * from './openrouter';
export * from './fake';

import { FakeProvider } from './fake';
import { OpenRouterProvider } from './openrouter';
import type { LanguageModel } from './provider';

export interface ProviderConfig {
  provider?: string;
}

/** Create a LanguageModel from provider config (env or options). */
export function createProvider(config: ProviderConfig = {}): LanguageModel {
  const provider = config.provider ?? process.env.LLM_PROVIDER ?? 'fake';
  switch (provider.toLowerCase()) {
    case 'openrouter':
    case 'openai':
    case 'generic':
    case 'deepseek':
    case 'nvidia':
      return new OpenRouterProvider();
    case 'fake':
      return new FakeProvider();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Available: fake, openrouter (and any OpenAI-compatible via env base/key).`,
      );
  }
}