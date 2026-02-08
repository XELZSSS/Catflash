import { ChatMessage, ProviderId } from '../../types';

export interface ImageGenerationRequest {
  prompt: string;
  size?: string;
  aspectRatio?: string;
  count?: number;
  quality?: string;
  subjectReference?: string;
}

export interface ImageGenerationResult {
  imageUrl?: string;
  imageDataUrl?: string;
  revisedPrompt?: string;
}

export interface ImageGenerationConfig {
  size?: string;
  aspectRatio?: string;
  count?: number;
  quality?: string;
  subjectReference?: string;
}

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
  getImageGenerationConfig?(): ImageGenerationConfig | undefined;
  setImageGenerationConfig?(config: ImageGenerationConfig | undefined): void;
  supportsImageGeneration?(): boolean;
  generateImage?(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
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
