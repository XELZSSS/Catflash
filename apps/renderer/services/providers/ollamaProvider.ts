import { ProviderId } from '../../types';
import { getDefaultOllamaBaseUrl, resolveBaseUrl } from './baseUrl';
import { parseImageGenerationResponse } from './imageResponse';
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
    return parseImageGenerationResponse(response, 'Ollama image generation returned no image.');
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
