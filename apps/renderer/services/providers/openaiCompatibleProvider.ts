import { ProviderId } from '../../types';
import { OPENAI_COMPATIBLE_MODEL_CATALOG } from './models';
import { OpenAIProxyCompatibleProviderBase } from './openaiProxyCompatibleProviderBase';
import { buildProxyUrl } from './proxy';
import { ProviderChat, ProviderDefinition } from './types';
import { sanitizeApiKey } from './utils';

export const OPENAI_COMPATIBLE_PROVIDER_ID: ProviderId = 'openai-compatible';
const OPENAI_COMPATIBLE_PROXY_BASE_URL = buildProxyUrl('/proxy/openai-compatible');

const FALLBACK_OPENAI_COMPATIBLE_MODEL = 'gpt-4.1-mini';
const OPENAI_COMPATIBLE_MODEL_FROM_ENV = process.env.OPENAI_COMPATIBLE_MODEL;
const DEFAULT_OPENAI_COMPATIBLE_MODEL =
  OPENAI_COMPATIBLE_MODEL_FROM_ENV && OPENAI_COMPATIBLE_MODEL_FROM_ENV !== 'undefined'
    ? OPENAI_COMPATIBLE_MODEL_FROM_ENV
    : FALLBACK_OPENAI_COMPATIBLE_MODEL;

const OPENAI_COMPATIBLE_MODELS = Array.from(
  new Set([
    DEFAULT_OPENAI_COMPATIBLE_MODEL,
    FALLBACK_OPENAI_COMPATIBLE_MODEL,
    ...OPENAI_COMPATIBLE_MODEL_CATALOG,
  ])
);

const DEFAULT_OPENAI_COMPATIBLE_API_KEY = sanitizeApiKey(process.env.OPENAI_COMPATIBLE_API_KEY);

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultOpenAICompatibleBaseUrl = (): string | undefined => {
  const envOverride = process.env.OPENAI_COMPATIBLE_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  return undefined;
};

class OpenAICompatibleProvider extends OpenAIProxyCompatibleProviderBase implements ProviderChat {
  constructor() {
    super({
      id: OPENAI_COMPATIBLE_PROVIDER_ID,
      defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
      defaultApiKey: DEFAULT_OPENAI_COMPATIBLE_API_KEY,
      proxyBaseUrl: OPENAI_COMPATIBLE_PROXY_BASE_URL,
      defaultTargetBaseUrl: getDefaultOpenAICompatibleBaseUrl(),
      missingApiKeyError: 'Missing OPENAI_COMPATIBLE_API_KEY',
      missingBaseUrlError: 'Missing OpenAI-Compatible base URL',
      logLabel: 'OpenAI-Compatible',
      supportsTavily: true,
      supportsImageGeneration: true,
    });
  }

  protected resolveTargetBaseUrl(baseUrl?: string): string | undefined {
    return baseUrl?.trim() ? resolveBaseUrl(baseUrl.trim()) : getDefaultOpenAICompatibleBaseUrl();
  }

  async generateTitle(message: string): Promise<string> {
    try {
      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: 'Return only the short title text.' },
          {
            role: 'user',
            content: `Generate a very short, concise title (max 4-5 words) for a chat that starts with this message: "${message}".`,
          },
        ],
        stream: false,
      });
      return response.choices[0]?.message?.content?.trim() ?? '';
    } catch (error) {
      console.error('OpenAI-Compatible title generation error:', error);
      return '';
    }
  }
}

export const openaiCompatibleProviderDefinition: ProviderDefinition = {
  id: OPENAI_COMPATIBLE_PROVIDER_ID,
  models: OPENAI_COMPATIBLE_MODELS,
  defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
  create: () => new OpenAICompatibleProvider(),
};
