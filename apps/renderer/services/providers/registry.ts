import { ChatMessage, ProviderId, TavilyConfig } from '../../types';
import { supportsProviderImageGeneration } from './capabilities';
import {
  DEEPSEEK_MODEL_CATALOG,
  GEMINI_MODEL_CATALOG,
  GLM_MODEL_CATALOG,
  IFLOW_MODEL_CATALOG,
  MINIMAX_MODEL_CATALOG,
  MOONSHOT_MODEL_CATALOG,
  OLLAMA_MODEL_CATALOG,
  OPENAI_COMPATIBLE_MODEL_CATALOG,
  OPENAI_MODEL_CATALOG,
  XAI_MODEL_CATALOG,
} from './models';
import { ImageGenerationConfig, ImageGenerationRequest, ImageGenerationResult, ProviderChat, ProviderDefinition } from './types';

const PROVIDER_IDS: ProviderId[] = [
  'gemini',
  'openai',
  'openai-compatible',
  'ollama',
  'xai',
  'deepseek',
  'glm',
  'minimax',
  'moonshot',
  'iflow',
];

const getEnvModelOrFallback = (value: string | undefined, fallback: string): string => {
  if (!value || value === 'undefined') {
    return fallback;
  }
  return value;
};

const uniq = (values: string[]): string[] => Array.from(new Set(values));

type ProviderMeta = {
  defaultModel: string;
  models: string[];
};

const providerMeta: Record<ProviderId, ProviderMeta> = {
  gemini: {
    defaultModel: 'gemini-2.5-flash',
    models: uniq(['gemini-2.5-flash', ...GEMINI_MODEL_CATALOG]),
  },
  openai: {
    defaultModel: getEnvModelOrFallback(process.env.OPENAI_MODEL, 'gpt-5.2'),
    models: uniq([
      getEnvModelOrFallback(process.env.OPENAI_MODEL, 'gpt-5.2'),
      'gpt-5.2',
      ...OPENAI_MODEL_CATALOG,
    ]),
  },
  'openai-compatible': {
    defaultModel: getEnvModelOrFallback(process.env.OPENAI_COMPATIBLE_MODEL, 'gpt-4.1-mini'),
    models: uniq([
      getEnvModelOrFallback(process.env.OPENAI_COMPATIBLE_MODEL, 'gpt-4.1-mini'),
      'gpt-4.1-mini',
      ...OPENAI_COMPATIBLE_MODEL_CATALOG,
    ]),
  },
  ollama: {
    defaultModel: getEnvModelOrFallback(process.env.OLLAMA_MODEL, 'llama3.2'),
    models: uniq([
      getEnvModelOrFallback(process.env.OLLAMA_MODEL, 'llama3.2'),
      'llama3.2',
      ...OLLAMA_MODEL_CATALOG,
    ]),
  },
  xai: {
    defaultModel: getEnvModelOrFallback(process.env.XAI_MODEL, 'grok-4'),
    models: uniq([getEnvModelOrFallback(process.env.XAI_MODEL, 'grok-4'), 'grok-4', ...XAI_MODEL_CATALOG]),
  },
  deepseek: {
    defaultModel: getEnvModelOrFallback(process.env.DEEPSEEK_MODEL, 'deepseek-chat'),
    models: uniq([
      getEnvModelOrFallback(process.env.DEEPSEEK_MODEL, 'deepseek-chat'),
      'deepseek-chat',
      ...DEEPSEEK_MODEL_CATALOG,
    ]),
  },
  glm: {
    defaultModel: getEnvModelOrFallback(process.env.GLM_MODEL, 'glm-4.7'),
    models: uniq([getEnvModelOrFallback(process.env.GLM_MODEL, 'glm-4.7'), 'glm-4.7', ...GLM_MODEL_CATALOG]),
  },
  minimax: {
    defaultModel: getEnvModelOrFallback(process.env.MINIMAX_MODEL, 'MiniMax-M2.1'),
    models: uniq([getEnvModelOrFallback(process.env.MINIMAX_MODEL, 'MiniMax-M2.1'), ...MINIMAX_MODEL_CATALOG]),
  },
  moonshot: {
    defaultModel: getEnvModelOrFallback(process.env.MOONSHOT_MODEL, 'kimi-latest'),
    models: uniq([getEnvModelOrFallback(process.env.MOONSHOT_MODEL, 'kimi-latest'), ...MOONSHOT_MODEL_CATALOG]),
  },
  iflow: {
    defaultModel: getEnvModelOrFallback(process.env.IFLOW_MODEL, 'TBStars2-200B-A13B'),
    models: uniq([
      getEnvModelOrFallback(process.env.IFLOW_MODEL, 'TBStars2-200B-A13B'),
      'TBStars2-200B-A13B',
      ...IFLOW_MODEL_CATALOG,
    ]),
  },
};

const providerDefinitionLoaders: Record<ProviderId, () => Promise<ProviderDefinition>> = {
  gemini: async () => (await import('./geminiProvider')).geminiProviderDefinition,
  openai: async () => (await import('./openaiProvider')).openaiProviderDefinition,
  'openai-compatible': async () =>
    (await import('./openaiCompatibleProvider')).openaiCompatibleProviderDefinition,
  ollama: async () => (await import('./ollamaProvider')).ollamaProviderDefinition,
  xai: async () => (await import('./xaiProvider')).xaiProviderDefinition,
  deepseek: async () => (await import('./deepseekProvider')).deepseekProviderDefinition,
  glm: async () => (await import('./glmProvider')).glmProviderDefinition,
  minimax: async () => (await import('./minimaxProvider')).minimaxProviderDefinition,
  moonshot: async () => (await import('./moonshotProvider')).moonshotProviderDefinition,
  iflow: async () => (await import('./iflowProvider')).iflowProviderDefinition,
};

class LazyProvider implements ProviderChat {
  private loadedProvider: ProviderChat | null = null;
  private loadingProvider: Promise<ProviderChat> | null = null;
  private modelName: string;
  private apiKey?: string;
  private baseUrl?: string;
  private customHeaders?: Array<{ key: string; value: string }>;
  private tavilyConfig?: TavilyConfig;
  private imageGenerationConfig?: ImageGenerationConfig;
  private historySnapshot: ChatMessage[] = [];
  private historyVersion = 0;
  private syncedHistoryVersion = 0;

  constructor(
    private readonly id: ProviderId,
    defaultModel: string,
    private readonly loadDefinition: () => Promise<ProviderDefinition>
  ) {
    this.modelName = defaultModel;
  }

  private cloneHistory(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => ({ ...msg }));
  }

  private applyCachedState(provider: ProviderChat): void {
    provider.setModelName(this.modelName);
    provider.setApiKey(this.apiKey);
    if (provider.setBaseUrl) {
      provider.setBaseUrl(this.baseUrl);
    }
    if (provider.setCustomHeaders) {
      provider.setCustomHeaders(this.customHeaders ?? []);
    }
    if (provider.setTavilyConfig) {
      provider.setTavilyConfig(this.tavilyConfig);
    }
    if (provider.setImageGenerationConfig) {
      provider.setImageGenerationConfig(this.imageGenerationConfig);
    }
  }

  private async syncHistoryIfNeeded(provider: ProviderChat): Promise<void> {
    if (this.syncedHistoryVersion === this.historyVersion) return;
    await provider.startChatWithHistory(this.cloneHistory(this.historySnapshot));
    this.syncedHistoryVersion = this.historyVersion;
  }

  private async ensureProvider(): Promise<ProviderChat> {
    if (this.loadedProvider) {
      await this.syncHistoryIfNeeded(this.loadedProvider);
      return this.loadedProvider;
    }

    if (!this.loadingProvider) {
      this.loadingProvider = this.loadDefinition().then((definition) => {
        const provider = definition.create();
        this.applyCachedState(provider);
        this.loadedProvider = provider;
        return provider;
      });
    }

    const provider = await this.loadingProvider;
    await this.syncHistoryIfNeeded(provider);
    return provider;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.loadedProvider?.getModelName() ?? this.modelName;
  }

  setModelName(model: string): void {
    this.modelName = model;
    this.loadedProvider?.setModelName(model);
  }

  getApiKey(): string | undefined {
    return this.loadedProvider?.getApiKey() ?? this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = apiKey;
    this.loadedProvider?.setApiKey(apiKey);
  }

  getBaseUrl(): string | undefined {
    if (!this.loadedProvider?.getBaseUrl) return this.baseUrl;
    return this.loadedProvider.getBaseUrl();
  }

  setBaseUrl(baseUrl?: string): void {
    this.baseUrl = baseUrl;
    this.loadedProvider?.setBaseUrl?.(baseUrl);
  }

  getCustomHeaders(): Array<{ key: string; value: string }> | undefined {
    if (!this.loadedProvider?.getCustomHeaders) return this.customHeaders;
    return this.loadedProvider.getCustomHeaders();
  }

  setCustomHeaders(headers: Array<{ key: string; value: string }>): void {
    this.customHeaders = [...headers];
    this.loadedProvider?.setCustomHeaders?.([...headers]);
  }

  getTavilyConfig(): TavilyConfig | undefined {
    if (!this.loadedProvider?.getTavilyConfig) return this.tavilyConfig;
    return this.loadedProvider.getTavilyConfig();
  }

  setTavilyConfig(config: TavilyConfig | undefined): void {
    this.tavilyConfig = config;
    this.loadedProvider?.setTavilyConfig?.(config);
  }

  getImageGenerationConfig(): ImageGenerationConfig | undefined {
    if (!this.loadedProvider?.getImageGenerationConfig) return this.imageGenerationConfig;
    return this.loadedProvider.getImageGenerationConfig();
  }

  setImageGenerationConfig(config: ImageGenerationConfig | undefined): void {
    this.imageGenerationConfig = config;
    this.loadedProvider?.setImageGenerationConfig?.(config);
  }

  supportsImageGeneration(): boolean {
    if (!supportsProviderImageGeneration(this.id)) return false;
    if (!this.loadedProvider?.supportsImageGeneration) return true;
    return this.loadedProvider.supportsImageGeneration();
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const provider = await this.ensureProvider();
    if (!provider.generateImage) {
      throw new Error(`Provider does not implement image generation: ${this.id}`);
    }
    return provider.generateImage(request);
  }

  resetChat(): void {
    this.historySnapshot = [];
    this.historyVersion += 1;
    this.syncedHistoryVersion = 0;
    this.loadedProvider?.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    this.historySnapshot = this.cloneHistory(messages);
    this.historyVersion += 1;
    if (!this.loadedProvider) return;
    await this.loadedProvider.startChatWithHistory(this.cloneHistory(this.historySnapshot));
    this.syncedHistoryVersion = this.historyVersion;
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const provider = await this.ensureProvider();
    yield* provider.sendMessageStream(message);
  }
}

const definitions: Record<ProviderId, ProviderDefinition> = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = {
      id,
      models: providerMeta[id].models,
      defaultModel: providerMeta[id].defaultModel,
      create: () => new LazyProvider(id, providerMeta[id].defaultModel, providerDefinitionLoaders[id]),
    };
    return acc;
  },
  {} as Record<ProviderId, ProviderDefinition>
);

export const getProviderDefinition = (id: ProviderId): ProviderDefinition => definitions[id];

export const createProvider = (id: ProviderId): ProviderChat => getProviderDefinition(id).create();

export const listProviderIds = (): ProviderId[] => [...PROVIDER_IDS];

export const getProviderModels = (id: ProviderId): string[] => getProviderDefinition(id).models;

export const getProviderDefaultModel = (id: ProviderId): string =>
  getProviderDefinition(id).defaultModel;
