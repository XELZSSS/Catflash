import { ProviderId } from '../../types';
import { OLLAMA_MODEL_CATALOG } from './models';
import { OpenAIProxyCompatibleProviderBase } from './openaiProxyCompatibleProviderBase';
import { buildProxyUrl } from './proxy';
import {
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderChat,
  ProviderDefinition,
} from './types';
import { sanitizeApiKey } from './utils';

export const OLLAMA_PROVIDER_ID: ProviderId = 'ollama';
const OLLAMA_PROXY_BASE_URL = buildProxyUrl('/proxy/openai-compatible');
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
      supportsImageGeneration: true,
    });
    this.customHeaders = [];
  }

  protected resolveImageModel(): string {
    const lower = this.modelName.toLowerCase();
    if (lower.includes('image') || this.modelName.includes('/')) {
      return this.modelName;
    }
    return 'x/z-image-turbo';
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const client = this.getClient();
    const response = (await client.images.generate({
      model: this.resolveImageModel(),
      prompt: request.prompt,
      n: request.count ?? 1,
      size: request.size ?? '1024x1024',
      response_format: 'b64_json',
    } as never)) as unknown as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };
    const first = response.data?.[0];
    if (!first) {
      throw new Error('Ollama image generation returned no image.');
    }
    return {
      imageUrl: first.url,
      imageDataUrl: first.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined,
      revisedPrompt: first.revised_prompt,
    };
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
