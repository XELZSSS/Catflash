import OpenAI from 'openai';
import { ProviderId } from '../../types';
import { XAI_MODEL_CATALOG } from './models';
import { OpenAIStandardProviderBase } from './openaiStandardProviderBase';
import {
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderChat,
  ProviderDefinition,
} from './types';
import { sanitizeApiKey } from './utils';

export const XAI_PROVIDER_ID: ProviderId = 'xai';
const XAI_BASE_URL = process.env.XAI_BASE_URL ?? 'https://api.x.ai/v1';
const FALLBACK_XAI_MODEL = 'grok-4';
const XAI_MODEL_FROM_ENV = process.env.XAI_MODEL;
const DEFAULT_XAI_MODEL =
  XAI_MODEL_FROM_ENV && XAI_MODEL_FROM_ENV !== 'undefined'
    ? XAI_MODEL_FROM_ENV
    : FALLBACK_XAI_MODEL;

const XAI_MODELS = Array.from(
  new Set([DEFAULT_XAI_MODEL, FALLBACK_XAI_MODEL, ...XAI_MODEL_CATALOG])
);

const DEFAULT_XAI_API_KEY = sanitizeApiKey(process.env.XAI_API_KEY);

class XAIProvider extends OpenAIStandardProviderBase implements ProviderChat {
  constructor() {
    super({
      id: XAI_PROVIDER_ID,
      defaultModel: DEFAULT_XAI_MODEL,
      defaultApiKey: DEFAULT_XAI_API_KEY,
      missingApiKeyError: 'Missing XAI_API_KEY',
      logLabel: 'xAI',
    });
  }

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: XAI_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
  }

  supportsImageGeneration(): boolean {
    return true;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const client = this.getClient();
    const imageModel = this.modelName.toLowerCase().includes('image')
      ? this.modelName
      : 'grok-2-image';
    const payload: Record<string, unknown> = {
      model: imageModel,
      prompt: request.prompt,
      n: request.count ?? 1,
      response_format: 'b64_json',
    };
    const response = (await client.images.generate(payload as never)) as unknown as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };
    const first = response.data?.[0];
    if (!first) {
      throw new Error('xAI image generation returned no image.');
    }
    return {
      imageUrl: first.url,
      imageDataUrl: first.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined,
      revisedPrompt: first.revised_prompt,
    };
  }
}

export const xaiProviderDefinition: ProviderDefinition = {
  id: XAI_PROVIDER_ID,
  models: XAI_MODELS,
  defaultModel: DEFAULT_XAI_MODEL,
  create: () => new XAIProvider(),
};
