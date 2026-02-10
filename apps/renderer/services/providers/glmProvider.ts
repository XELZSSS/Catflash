import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import {
  ImageGenerationConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderChat,
  ProviderDefinition,
} from './types';
import { GLM_MODEL_CATALOG } from './models';
import { getMaxToolCallRounds, sanitizeApiKey } from './utils';
import { buildProxyUrl, getProxyAuthHeadersForTarget } from './proxy';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { OpenAIChatMessages, OpenAIStreamChunk } from './openaiChatHelpers';
import { OpenAIStyleProviderBase } from './openaiBase';

export const GLM_PROVIDER_ID: ProviderId = 'glm';
export const GLM_BASE_URL_CN = buildProxyUrl('/proxy/glm-cn/chat/completions');
export const GLM_BASE_URL_INTL = buildProxyUrl('/proxy/glm-intl/chat/completions');

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultGlmBaseUrl = (): string => {
  const envOverride = process.env.GLM_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return resolveBaseUrl(GLM_BASE_URL_CN);
    }
  }
  return resolveBaseUrl(GLM_BASE_URL_INTL);
};

const FALLBACK_GLM_MODEL = 'glm-4.7';
const GLM_MODEL_FROM_ENV = process.env.GLM_MODEL;
const DEFAULT_GLM_MODEL =
  GLM_MODEL_FROM_ENV && GLM_MODEL_FROM_ENV !== 'undefined'
    ? GLM_MODEL_FROM_ENV
    : FALLBACK_GLM_MODEL;

const GLM_MODELS = Array.from(
  new Set([DEFAULT_GLM_MODEL, FALLBACK_GLM_MODEL, ...GLM_MODEL_CATALOG])
);

const DEFAULT_GLM_API_KEY = sanitizeApiKey(process.env.GLM_API_KEY);

const parseSseLines = (buffer: string): { lines: string[]; rest: string } => {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? '';
  return { lines: parts, rest };
};

const resolveGlmImageEndpoint = (baseUrl: string): string => {
  if (baseUrl.includes('/chat/completions')) {
    return baseUrl.replace('/chat/completions', '/images/generations');
  }
  return `${baseUrl.replace(/\/+$/, '')}/images/generations`;
};

const resolveGlmImageModel = (modelName: string): string => {
  const lower = modelName.toLowerCase();
  if (lower.includes('image') || lower.includes('cogview')) return modelName;
  return 'glm-image';
};

class GlmProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = GLM_PROVIDER_ID;
  private apiKey?: string;
  private modelName: string;
  private baseUrl: string;
  private tavilyConfig?: TavilyConfig;
  private imageGenerationConfig?: ImageGenerationConfig;

  constructor() {
    super();
    this.apiKey = DEFAULT_GLM_API_KEY;
    this.modelName = glmProviderDefinition.defaultModel;
    this.baseUrl = getDefaultGlmBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getApiKeyValue(): string {
    const keyToUse = this.apiKey ?? DEFAULT_GLM_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing GLM_API_KEY');
    }
    return keyToUse;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || glmProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_GLM_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
    }
  }

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  getImageGenerationConfig(): ImageGenerationConfig | undefined {
    return this.imageGenerationConfig;
  }

  setImageGenerationConfig(config?: ImageGenerationConfig): void {
    this.imageGenerationConfig = config;
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim();
    if (nextUrl && nextUrl !== this.baseUrl) {
      this.baseUrl = resolveBaseUrl(nextUrl);
    }
  }

  supportsImageGeneration(): boolean {
    return true;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await fetch(resolveGlmImageEndpoint(this.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKeyValue()}`,
        ...getProxyAuthHeadersForTarget(this.baseUrl),
      },
      body: JSON.stringify({
        model: resolveGlmImageModel(this.modelName),
        prompt: request.prompt,
        size: request.size ?? '1024x1024',
        quality: request.quality,
        n: request.count,
      }),
    });

    if (!response.ok) {
      throw new Error(`GLM image request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };
    const first = payload.data?.[0];
    if (!first) {
      throw new Error('GLM image generation returned no image.');
    }

    return {
      imageUrl: first.url,
      imageDataUrl: first.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined,
      revisedPrompt: first.revised_prompt,
    };
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const userMessage: ChatMessage = {
      id: `glm-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    const tools = buildOpenAITavilyTools(this.tavilyConfig);
    const payload = {
      model: this.modelName,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
    };

    if (tools) {
      let workingMessages = messages as OpenAIChatMessages;
      const maxToolRounds = getMaxToolCallRounds();
      for (let round = 0; round < maxToolRounds; round += 1) {
        const preflight = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getApiKeyValue()}`,
            ...getProxyAuthHeadersForTarget(this.baseUrl),
          },
          body: JSON.stringify({ ...payload, messages: workingMessages, stream: false }),
        });

        if (!preflight.ok) {
          throw new Error(`GLM tool preflight failed: ${preflight.status}`);
        }

        const preflightData = (await preflight.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
            };
          }>;
        };

        const toolCalls = preflightData.choices?.[0]?.message?.tool_calls ?? [];
        if (!toolCalls.length) {
          payload.messages = workingMessages;
          break;
        }

        const toolMessages = await this.buildToolMessages(toolCalls, this.tavilyConfig);

        workingMessages = [
          ...workingMessages,
          {
            role: 'assistant',
            content: preflightData.choices?.[0]?.message?.content ?? null,
            tool_calls: toolCalls,
          },
          ...toolMessages,
        ];

        payload.messages = workingMessages;
      }
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKeyValue()}`,
        ...getProxyAuthHeadersForTarget(this.baseUrl),
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`GLM stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { lines, rest } = parseSseLines(buffer);
        buffer = rest;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payloadText = trimmed.replace(/^data:\s*/i, '');
          if (payloadText === '[DONE]') {
            buffer = '';
            break;
          }

          let chunk: OpenAIStreamChunk | null = null;
          try {
            chunk = JSON.parse(payloadText) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          const reasoningDelta =
            chunk?.choices?.[0]?.delta?.reasoning_content ??
            chunk?.choices?.[0]?.message?.reasoning_content;
          if (reasoningDelta) {
            yield `<think>${reasoningDelta}</think>`;
          }

          const contentDelta =
            chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      }

      const modelMessage: ChatMessage = {
        id: `glm-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in GLM stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}

export const glmProviderDefinition: ProviderDefinition = {
  id: GLM_PROVIDER_ID,
  models: GLM_MODELS,
  defaultModel: DEFAULT_GLM_MODEL,
  create: () => new GlmProvider(),
};
