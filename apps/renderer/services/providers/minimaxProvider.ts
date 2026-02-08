import OpenAI from 'openai';
import { ProviderId, TavilyConfig } from '../../types';
import { OpenAIChatCreateStreaming, OpenAIStreamChunk, runToolCallLoop } from './openaiChatHelpers';
import { MINIMAX_MODEL_CATALOG } from './models';
import { OpenAIStandardProviderBase } from './openaiStandardProviderBase';
import { buildOpenAITavilyTools } from './tavily';
import {
  ImageGenerationConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderChat,
  ProviderDefinition,
} from './types';
import { sanitizeApiKey } from './utils';

export const MINIMAX_PROVIDER_ID: ProviderId = 'minimax';
export const DEFAULT_MINIMAX_BASE_URL = 'http://localhost:4010/proxy/minimax-intl';
export const CHINA_MINIMAX_BASE_URL = 'http://localhost:4010/proxy/minimax-cn';

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultMinimaxBaseUrl = (): string => {
  const envOverride = process.env.MINIMAX_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return resolveBaseUrl(CHINA_MINIMAX_BASE_URL);
    }
  }
  return resolveBaseUrl(DEFAULT_MINIMAX_BASE_URL);
};

const FALLBACK_MINIMAX_MODEL = 'MiniMax-M2.1';
const MINIMAX_MODEL_FROM_ENV = process.env.MINIMAX_MODEL;
const DEFAULT_MINIMAX_MODEL =
  MINIMAX_MODEL_FROM_ENV && MINIMAX_MODEL_FROM_ENV !== 'undefined'
    ? MINIMAX_MODEL_FROM_ENV
    : FALLBACK_MINIMAX_MODEL;

const MINIMAX_MODELS = Array.from(new Set([DEFAULT_MINIMAX_MODEL, ...MINIMAX_MODEL_CATALOG]));

const DEFAULT_MINIMAX_API_KEY = sanitizeApiKey(process.env.MINIMAX_API_KEY);

const resolveMinimaxImageModel = (modelName: string): string => {
  const lower = modelName.toLowerCase();
  if (lower.includes('image')) return modelName;
  return 'image-01';
};

class MiniMaxProvider extends OpenAIStandardProviderBase implements ProviderChat {
  private baseUrl: string;
  private imageGenerationConfig?: ImageGenerationConfig;

  constructor() {
    super({
      id: MINIMAX_PROVIDER_ID,
      defaultModel: DEFAULT_MINIMAX_MODEL,
      defaultApiKey: DEFAULT_MINIMAX_API_KEY,
      missingApiKeyError: 'Missing MINIMAX_API_KEY',
      logLabel: 'MiniMax',
    });
    this.baseUrl = getDefaultMinimaxBaseUrl();
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

  getImageGenerationConfig(): ImageGenerationConfig | undefined {
    return this.imageGenerationConfig;
  }

  setImageGenerationConfig(config?: ImageGenerationConfig): void {
    this.imageGenerationConfig = config;
  }

  supportsImageGeneration(): boolean {
    return true;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const apiKey = this.getApiKey() ?? DEFAULT_MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error('Missing MINIMAX_API_KEY');
    }
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/image_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolveMinimaxImageModel(this.modelName),
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio ?? '1:1',
        response_format: 'url',
        n: request.count ?? 1,
        quality: request.quality,
        subject_reference: request.subjectReference,
      }),
    });

    if (!response.ok) {
      throw new Error(`MiniMax image request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
      image_urls?: string[];
    };
    const first = payload.data?.[0];
    const firstUrl = first?.url ?? payload.image_urls?.[0];
    const firstDataUrl = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined;
    if (!firstUrl && !firstDataUrl) {
      throw new Error('MiniMax image generation returned no image.');
    }

    return {
      imageUrl: firstUrl,
      imageDataUrl: firstDataUrl,
      revisedPrompt: first?.revised_prompt,
    };
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const userMessage = {
      id: `${this.id}-user-${Date.now()}`,
      role: 'user' as const,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    let fullResponse = '';
    let fullReasoning = '';

    try {
      const tools = buildOpenAITavilyTools(this.getTavilyConfig());

      if (tools) {
        const { messages: workingMessages } = await runToolCallLoop({
          client,
          model: this.modelName,
          messages,
          tools,
          tavilyConfig: this.getTavilyConfig() as TavilyConfig,
          extraBody: { reasoning_split: true },
          buildToolMessages: this.buildToolMessages.bind(this),
          getAssistantMessageExtras: (preflightMessage) =>
            preflightMessage?.reasoning_details?.length
              ? { reasoning_details: preflightMessage.reasoning_details }
              : null,
        });

        const stream = (await client.chat.completions.create({
          model: this.modelName,
          messages: workingMessages,
          stream: true,
          extra_body: { reasoning_split: true },
        } as OpenAIChatCreateStreaming)) as unknown as AsyncIterable<OpenAIStreamChunk>;

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const reasoningDetails = delta?.reasoning_details ?? [];
          for (const detail of reasoningDetails) {
            if (!detail?.text) continue;
            fullReasoning += detail.text;
            yield `<think>${detail.text}</think>`;
          }

          const contentDelta = delta?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      } else {
        const stream = (await client.chat.completions.create({
          model: this.modelName,
          messages,
          stream: true,
          extra_body: { reasoning_split: true },
        } as OpenAIChatCreateStreaming)) as unknown as AsyncIterable<OpenAIStreamChunk>;

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const reasoningDetails = delta?.reasoning_details ?? [];
          for (const detail of reasoningDetails) {
            if (!detail?.text) continue;
            fullReasoning += detail.text;
            yield `<think>${detail.text}</think>`;
          }

          const contentDelta = delta?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      }

      const modelMessage = {
        id: `${this.id}-model-${Date.now()}`,
        role: 'model' as const,
        text: fullResponse,
        reasoning: fullReasoning || undefined,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in MiniMax stream:', error);
      throw error;
    }
  }
}

export const minimaxProviderDefinition: ProviderDefinition = {
  id: MINIMAX_PROVIDER_ID,
  models: MINIMAX_MODELS,
  defaultModel: DEFAULT_MINIMAX_MODEL,
  create: () => new MiniMaxProvider(),
};
