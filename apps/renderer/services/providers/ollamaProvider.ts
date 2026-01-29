import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { OLLAMA_MODEL_CATALOG } from './models';
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

class OllamaProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = OLLAMA_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private targetBaseUrl?: string;

  constructor() {
    super();
    this.apiKey = DEFAULT_OLLAMA_API_KEY;
    this.modelName = ollamaProviderDefinition.defaultModel;
    this.targetBaseUrl = getDefaultOllamaBaseUrl();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_OLLAMA_API_KEY ?? 'ollama';
    if (!this.targetBaseUrl) {
      throw new Error('Missing Ollama base URL');
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: OLLAMA_PROXY_BASE_URL,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'x-openai-compatible-base-url': this.targetBaseUrl,
          'x-openai-compatible-headers': '[]',
        },
      });
    }
    return this.client;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || ollamaProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_OLLAMA_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
    }
  }

  getBaseUrl(): string | undefined {
    return this.targetBaseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim();
    if (nextUrl && nextUrl !== this.targetBaseUrl) {
      this.targetBaseUrl = resolveBaseUrl(nextUrl);
      this.client = null;
    }
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const userMessage: ChatMessage = {
      id: `ollama-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    let fullResponse = '';

    try {
      const stream = (await client.chat.completions.create({
        model: this.modelName,
        messages,
        stream: true,
      })) as unknown as AsyncIterable<{
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning_content?: string;
            reasoning_text?: string;
            reasoning?: string;
          };
          message?: {
            content?: string;
            reasoning_content?: string;
            reasoning_text?: string;
            reasoning?: string;
          };
        }>;
      }>;

      for await (const chunk of stream) {
        const reasoningDelta =
          chunk.choices?.[0]?.delta?.reasoning_content ??
          chunk.choices?.[0]?.delta?.reasoning_text ??
          chunk.choices?.[0]?.delta?.reasoning ??
          chunk.choices?.[0]?.message?.reasoning_content ??
          chunk.choices?.[0]?.message?.reasoning_text ??
          chunk.choices?.[0]?.message?.reasoning;
        if (reasoningDelta) {
          yield `<think>${reasoningDelta}</think>`;
        }

        const contentDelta =
          chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
        if (contentDelta) {
          fullResponse += contentDelta;
          yield contentDelta;
        }
      }

      const modelMessage: ChatMessage = {
        id: `ollama-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in Ollama stream:', error);
      throw error;
    }
  }
}

export const ollamaProviderDefinition: ProviderDefinition = {
  id: OLLAMA_PROVIDER_ID,
  models: OLLAMA_MODELS,
  defaultModel: DEFAULT_OLLAMA_MODEL,
  create: () => new OllamaProvider(),
};
