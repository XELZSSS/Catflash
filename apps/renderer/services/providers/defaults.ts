import { ProviderId, TavilyConfig } from '../../types';
import { getProviderDefaultModel, listProviderIds } from './registry';
import { getDefaultGlmBaseUrl } from './glmProvider';
import { getDefaultMinimaxBaseUrl } from './minimaxProvider';
import { getDefaultMoonshotBaseUrl } from './moonshotProvider';
import { getDefaultIflowBaseUrl } from './iflowProvider';
import { getDefaultOpenAICompatibleBaseUrl } from './openaiCompatibleProvider';
import { getDefaultOllamaBaseUrl } from './ollamaProvider';
import { getDefaultTavilyConfig } from './tavily';
import { sanitizeApiKey } from './utils';

export interface ProviderSettings {
  apiKey?: string;
  modelName: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
}

const TAVILY_ENABLED_PROVIDERS = new Set<ProviderId>([
  'openai-compatible',
  'openai',
  'xai',
  'gemini',
  'deepseek',
  'glm',
  'minimax',
  'moonshot',
  'iflow',
]);

const resolveDefaultBaseUrl = (providerId: ProviderId): string | undefined => {
  if (providerId === 'minimax') return getDefaultMinimaxBaseUrl();
  if (providerId === 'moonshot') return getDefaultMoonshotBaseUrl();
  if (providerId === 'glm') return getDefaultGlmBaseUrl();
  if (providerId === 'iflow') return getDefaultIflowBaseUrl();
  if (providerId === 'openai-compatible') return getDefaultOpenAICompatibleBaseUrl();
  if (providerId === 'ollama') return getDefaultOllamaBaseUrl();
  return undefined;
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
  baseUrl: resolveDefaultBaseUrl(providerId),
  customHeaders: [],
  tavily: TAVILY_ENABLED_PROVIDERS.has(providerId) ? getDefaultTavilyConfig() : undefined,
});

export const buildDefaultProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  const defaults = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    defaults[id] = getDefaultProviderSettings(id);
  }
  return defaults;
};
