import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { IFLOW_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import {
  OpenAIChatMessages,
  runToolCallLoop,
  streamStandardChatCompletions,
} from './openaiChatHelpers';

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

class IflowProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = IFLOW_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private baseUrl: string;
  private tavilyConfig?: TavilyConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_IFLOW_API_KEY;
    this.modelName = iflowProviderDefinition.defaultModel;
    this.baseUrl = getDefaultIflowBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_IFLOW_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing IFLOW_API_KEY');
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: this.baseUrl,
        dangerouslyAllowBrowser: true,
      });
    }
    return this.client;
  }

  private buildTools(): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    return buildOpenAITavilyTools(this.tavilyConfig);
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || iflowProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_IFLOW_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
    }
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

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const userMessage: ChatMessage = {
      id: `iflow-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    let fullResponse = '';

    try {
      const tools = this.buildTools();
      const baseMessages = messages as OpenAIChatMessages;
      const { messages: workingMessages } = await runToolCallLoop({
        client,
        model: this.modelName,
        messages: baseMessages,
        tools,
        tavilyConfig: this.tavilyConfig,
        buildToolMessages: this.buildToolMessages.bind(this),
      });

      for await (const chunk of streamStandardChatCompletions({
        client,
        model: this.modelName,
        messages: tools ? workingMessages : baseMessages,
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
        id: `iflow-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in iFlow stream:', error);
      throw error;
    }
  }
}

export const iflowProviderDefinition: ProviderDefinition = {
  id: IFLOW_PROVIDER_ID,
  models: IFLOW_MODELS,
  defaultModel: DEFAULT_IFLOW_MODEL,
  create: () => new IflowProvider(),
};
