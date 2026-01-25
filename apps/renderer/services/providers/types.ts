import { ChatMessage, ProviderId } from '../../types';

export interface ProviderChat {
  getId(): ProviderId;
  getModelName(): string;
  setModelName(model: string): void;
  getApiKey(): string | undefined;
  setApiKey(apiKey?: string): void;
  getBaseUrl?(): string | undefined;
  setBaseUrl?(baseUrl?: string): void;
  getCustomHeaders?(): Array<{ key: string; value: string }> | undefined;
  setCustomHeaders?(headers: Array<{ key: string; value: string }>): void;
  getTavilyConfig?(): import('../../types').TavilyConfig | undefined;
  setTavilyConfig?(config: import('../../types').TavilyConfig | undefined): void;
  resetChat(): void;
  startChatWithHistory(messages: ChatMessage[]): Promise<void>;
  sendMessageStream(message: string): AsyncGenerator<string, void, unknown>;
}

export interface ProviderDefinition {
  id: ProviderId;
  models: string[];
  defaultModel: string;
  create(): ProviderChat;
}
