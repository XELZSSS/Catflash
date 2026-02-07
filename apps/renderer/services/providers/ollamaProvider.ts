import { ProviderId } from '../../types';
import { OLLAMA_MODEL_CATALOG } from './models';
import { OpenAIProxyCompatibleProviderBase } from './openaiProxyCompatibleProviderBase';
import { ProviderChat, ProviderDefinition } from './types';
import { sanitizeApiKey } from './utils';

export const OLLAMA_PROVIDER_ID: ProviderId = 'ollama';
const OLLAMA_PROXY_BASE_URL = 'http://localhost:4010/proxy/openai-compatible';
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1/';

const FALLBACK_OLLAMA_MODEL = 'llama3.2';
const OLLAMA_MODEL_FROM_ENV = process.env.OLLAMA_MODEL;
const DEFAULT_OLLAMA_MODEL =
  OLLAMA_MODEL_FROM_ENV && OLLAMA_MODEL_FROM_ENV !== 'undefined'
    ? OLLAMA_MODEL_FROM_ENV
    : FALLBACK_OLLAMA_MODEL;

const OLLAMA_MODELS = Array.from(
  new Set([DEFAULT_OLLAMA_MODEL, FALLBACK_OLLAMA_MODEL, ...OLLAMA_MODEL_CATALOG])
);

const DEFAULT_OLLAMA_API_KEY = sanitizeApiKey(process.env.OLLAMA_API_KEY);

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultOllamaBaseUrl = (): string => {
  const envOverride = process.env.OLLAMA_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  return OLLAMA_DEFAULT_BASE_URL;
};

class OllamaProvider extends OpenAIProxyCompatibleProviderBase implements ProviderChat {
  constructor() {
    super({
      id: OLLAMA_PROVIDER_ID,
      defaultModel: DEFAULT_OLLAMA_MODEL,
      defaultApiKey: DEFAULT_OLLAMA_API_KEY,
      fallbackApiKey: 'ollama',
      proxyBaseUrl: OLLAMA_PROXY_BASE_URL,
      defaultTargetBaseUrl: getDefaultOllamaBaseUrl(),
      missingBaseUrlError: 'Missing Ollama base URL',
      logLabel: 'Ollama',
      supportsTavily: false,
    });
    this.customHeaders = [];
  }

  protected resolveTargetBaseUrl(baseUrl?: string): string | undefined {
    const nextUrl = baseUrl?.trim();
    if (!nextUrl) return this.targetBaseUrl;
    return resolveBaseUrl(nextUrl);
  }
}

export const ollamaProviderDefinition: ProviderDefinition = {
  id: OLLAMA_PROVIDER_ID,
  models: OLLAMA_MODELS,
  defaultModel: DEFAULT_OLLAMA_MODEL,
  create: () => new OllamaProvider(),
};
