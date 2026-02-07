import OpenAI from 'openai';
import { ProviderId } from '../../types';
import { IFLOW_MODEL_CATALOG } from './models';
import { OpenAIStandardProviderBase } from './openaiStandardProviderBase';
import { ProviderChat, ProviderDefinition } from './types';
import { sanitizeApiKey } from './utils';

export const IFLOW_PROVIDER_ID: ProviderId = 'iflow';
export const IFLOW_BASE_URL = 'http://localhost:4010/proxy/iflow';

const FALLBACK_IFLOW_MODEL = 'TBStars2-200B-A13B';
const IFLOW_MODEL_FROM_ENV = process.env.IFLOW_MODEL;
const DEFAULT_IFLOW_MODEL =
  IFLOW_MODEL_FROM_ENV && IFLOW_MODEL_FROM_ENV !== 'undefined'
    ? IFLOW_MODEL_FROM_ENV
    : FALLBACK_IFLOW_MODEL;

const IFLOW_MODELS = Array.from(
  new Set([DEFAULT_IFLOW_MODEL, FALLBACK_IFLOW_MODEL, ...IFLOW_MODEL_CATALOG])
);

const DEFAULT_IFLOW_API_KEY = sanitizeApiKey(process.env.IFLOW_API_KEY);

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultIflowBaseUrl = (): string => {
  const envOverride = process.env.IFLOW_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  return resolveBaseUrl(IFLOW_BASE_URL);
};

class IflowProvider extends OpenAIStandardProviderBase implements ProviderChat {
  private baseUrl: string;

  constructor() {
    super({
      id: IFLOW_PROVIDER_ID,
      defaultModel: DEFAULT_IFLOW_MODEL,
      defaultApiKey: DEFAULT_IFLOW_API_KEY,
      missingApiKeyError: 'Missing IFLOW_API_KEY',
      logLabel: 'iFlow',
    });
    this.baseUrl = getDefaultIflowBaseUrl();
  }

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
    });
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim();
    if (nextUrl && nextUrl !== this.baseUrl) {
      this.baseUrl = resolveBaseUrl(nextUrl);
      this.client = null;
    }
  }
}

export const iflowProviderDefinition: ProviderDefinition = {
  id: IFLOW_PROVIDER_ID,
  models: IFLOW_MODELS,
  defaultModel: DEFAULT_IFLOW_MODEL,
  create: () => new IflowProvider(),
};
