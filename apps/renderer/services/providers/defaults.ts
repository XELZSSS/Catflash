import { ProviderId, TavilyConfig } from '../../types';
import { ImageGenerationConfig } from './types';
import { resolveDefaultBaseUrlForProvider } from './baseUrl';
import { supportsProviderImageGeneration, supportsProviderTavily } from './capabilities';
import { getProviderDefaultModel, listProviderIds } from './registry';
import { getDefaultTavilyConfig } from './tavily';
import { sanitizeApiKey } from './utils';

export interface ProviderSettings {
  apiKey?: string;
  modelName: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  imageGeneration?: ImageGenerationConfig;
}

const getDefaultImageGenerationConfig = (
  providerId: ProviderId
): ImageGenerationConfig | undefined => {
  if (!supportsProviderImageGeneration(providerId)) return undefined;
  if (providerId === 'minimax') {
    return {
      aspectRatio: '1:1',
      count: 1,
      quality: 'standard',
    };
  }
  if (providerId === 'ollama') {
    return {
      size: '1024x1024',
      count: 1,
      quality: 'auto',
    };
  }
  return {
    size: '1024x1024',
    count: 1,
    quality: 'auto',
  };
};

export const getEnvApiKey = (providerId: ProviderId): string | undefined => {
  if (providerId === 'openai') {
    return sanitizeApiKey(process.env.OPENAI_API_KEY);
  }
  if (providerId === 'openai-compatible') {
    return sanitizeApiKey(process.env.OPENAI_COMPATIBLE_API_KEY);
  }
  if (providerId === 'ollama') {
    return sanitizeApiKey(process.env.OLLAMA_API_KEY);
  }
  if (providerId === 'xai') {
    return sanitizeApiKey(process.env.XAI_API_KEY);
  }
  if (providerId === 'deepseek') {
    return sanitizeApiKey(process.env.DEEPSEEK_API_KEY);
  }
  if (providerId === 'glm') {
    return sanitizeApiKey(process.env.GLM_API_KEY);
  }
  if (providerId === 'moonshot') {
    return sanitizeApiKey(process.env.MOONSHOT_API_KEY);
  }
  if (providerId === 'iflow') {
    return sanitizeApiKey(process.env.IFLOW_API_KEY);
  }
  if (providerId === 'minimax') {
    return sanitizeApiKey(process.env.MINIMAX_API_KEY);
  }
  return sanitizeApiKey(process.env.GEMINI_API_KEY ?? process.env.API_KEY);
};

export const getDefaultProviderSettings = (providerId: ProviderId): ProviderSettings => ({
  apiKey: getEnvApiKey(providerId),
  modelName: getProviderDefaultModel(providerId),
  baseUrl: resolveDefaultBaseUrlForProvider(providerId),
  customHeaders: [],
  tavily: supportsProviderTavily(providerId) ? getDefaultTavilyConfig() : undefined,
  imageGeneration: getDefaultImageGenerationConfig(providerId),
});

export const buildDefaultProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  const defaults = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    defaults[id] = getDefaultProviderSettings(id);
  }
  return defaults;
};
