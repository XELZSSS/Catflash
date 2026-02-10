import OpenAI from 'openai';
import { ProviderId } from '../../types';
import { MOONSHOT_MODEL_CATALOG } from './models';
import { OpenAIStandardProviderBase } from './openaiStandardProviderBase';
import { buildProxyUrl, getProxyAuthHeadersForTarget } from './proxy';
import { ProviderChat, ProviderDefinition } from './types';
import { sanitizeApiKey } from './utils';

export const MOONSHOT_PROVIDER_ID: ProviderId = 'moonshot';
export const MOONSHOT_BASE_URL_CN = buildProxyUrl('/proxy/moonshot-cn');
export const MOONSHOT_BASE_URL_INTL = buildProxyUrl('/proxy/moonshot-intl');

const FALLBACK_MOONSHOT_MODEL = 'kimi-latest';
const MOONSHOT_MODEL_FROM_ENV = process.env.MOONSHOT_MODEL;
const DEFAULT_MOONSHOT_MODEL =
  MOONSHOT_MODEL_FROM_ENV && MOONSHOT_MODEL_FROM_ENV !== 'undefined'
    ? MOONSHOT_MODEL_FROM_ENV
    : FALLBACK_MOONSHOT_MODEL;

const MOONSHOT_MODELS = Array.from(new Set([DEFAULT_MOONSHOT_MODEL, ...MOONSHOT_MODEL_CATALOG]));

const DEFAULT_MOONSHOT_API_KEY = sanitizeApiKey(process.env.MOONSHOT_API_KEY);

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultMoonshotBaseUrl = (): string => {
  const envOverride = process.env.MOONSHOT_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return resolveBaseUrl(MOONSHOT_BASE_URL_CN);
    }
  }
  return resolveBaseUrl(MOONSHOT_BASE_URL_INTL);
};

class MoonshotProvider extends OpenAIStandardProviderBase implements ProviderChat {
  private baseUrl: string;

  constructor() {
    super({
      id: MOONSHOT_PROVIDER_ID,
      defaultModel: DEFAULT_MOONSHOT_MODEL,
      defaultApiKey: DEFAULT_MOONSHOT_API_KEY,
      missingApiKeyError: 'Missing MOONSHOT_API_KEY',
      logLabel: 'Moonshot',
    });
    this.baseUrl = getDefaultMoonshotBaseUrl();
  }

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        ...getProxyAuthHeadersForTarget(this.baseUrl),
      },
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

export const moonshotProviderDefinition: ProviderDefinition = {
  id: MOONSHOT_PROVIDER_ID,
  models: MOONSHOT_MODELS,
  defaultModel: DEFAULT_MOONSHOT_MODEL,
  create: () => new MoonshotProvider(),
};
