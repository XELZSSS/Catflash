import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { OPENAI_COMPATIBLE_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import {
  OpenAIChatMessages,
  runToolCallLoop,
  streamStandardChatCompletions,
} from './openaiChatHelpers';

export const OPENAI_COMPATIBLE_PROVIDER_ID: ProviderId = 'openai-compatible';
const OPENAI_COMPATIBLE_PROXY_BASE_URL = 'http://localhost:4010/proxy/openai-compatible';

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

const normalizeCustomHeaders = (
  headers?: Array<{ key: string; value: string }>
): Array<{ key: string; value: string }> => {
  if (!headers) return [];
  return headers
    .map((header) => ({
      key: header.key?.trim(),
      value: header.value?.trim(),
    }))
    .filter((header) => header.key && header.value) as Array<{ key: string; value: string }>;
};

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

class OpenAICompatibleProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = OPENAI_COMPATIBLE_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private targetBaseUrl?: string;
  private customHeaders: Array<{ key: string; value: string }> = [];
  private tavilyConfig?: TavilyConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_OPENAI_COMPATIBLE_API_KEY;
    this.modelName = openaiCompatibleProviderDefinition.defaultModel;
    this.targetBaseUrl = getDefaultOpenAICompatibleBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_OPENAI_COMPATIBLE_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing OPENAI_COMPATIBLE_API_KEY');
    }
    if (!this.targetBaseUrl) {
      throw new Error('Missing OpenAI-Compatible base URL');
    }
    if (!this.client) {
      const headersPayload = normalizeCustomHeaders(this.customHeaders);
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: OPENAI_COMPATIBLE_PROXY_BASE_URL,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'x-openai-compatible-base-url': this.targetBaseUrl,
          'x-openai-compatible-headers': JSON.stringify(headersPayload),
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
    const nextModel = model.trim() || openaiCompatibleProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_OPENAI_COMPATIBLE_API_KEY;
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

  getCustomHeaders(): Array<{ key: string; value: string }> | undefined {
    return this.customHeaders;
  }

  setCustomHeaders(headers: Array<{ key: string; value: string }>): void {
    const normalized = normalizeCustomHeaders(headers);
    this.customHeaders = normalized;
    this.client = null;
  }

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
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

  private buildTools(): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    return buildOpenAITavilyTools(this.tavilyConfig);
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const userMessage: ChatMessage = {
      id: `openai-compatible-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    let fullResponse = '';

    try {
      const tools = this.buildTools();
      const {
        messages: workingMessages,
        preflightMessage,
        hadToolCalls,
      } = await runToolCallLoop({
        client,
        model: this.modelName,
        messages: messages as OpenAIChatMessages,
        tools,
        tavilyConfig: this.tavilyConfig,
        buildToolMessages: this.buildToolMessages.bind(this),
      });

      if (tools && !hadToolCalls && preflightMessage?.content) {
        fullResponse = preflightMessage.content;
        yield fullResponse;
        return;
      }

      for await (const chunk of streamStandardChatCompletions({
        client,
        model: this.modelName,
        messages: tools ? workingMessages : (messages as OpenAIChatMessages),
      })) {
        if (chunk.reasoning) {
          yield `<think>${chunk.reasoning}</think>`;
        }
        if (chunk.content) {
          fullResponse += chunk.content;
          yield chunk.content;
        }
      }

      const modelMessage: ChatMessage = {
        id: `openai-compatible-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in OpenAI-Compatible stream:', error);
      throw error;
    }
  }
}

export const openaiCompatibleProviderDefinition: ProviderDefinition = {
  id: OPENAI_COMPATIBLE_PROVIDER_ID,
  models: OPENAI_COMPATIBLE_MODELS,
  defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
  create: () => new OpenAICompatibleProvider(),
};
