import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { MOONSHOT_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import {
  OpenAIChatMessages,
  runToolCallLoop,
  streamStandardChatCompletions,
} from './openaiChatHelpers';

export const MOONSHOT_PROVIDER_ID: ProviderId = 'moonshot';
export const MOONSHOT_BASE_URL_CN = 'http://localhost:4010/proxy/moonshot-cn';
export const MOONSHOT_BASE_URL_INTL = 'http://localhost:4010/proxy/moonshot-intl';

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

class MoonshotProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = MOONSHOT_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private baseUrl: string;
  private tavilyConfig?: TavilyConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_MOONSHOT_API_KEY;
    this.modelName = moonshotProviderDefinition.defaultModel;
    this.baseUrl = getDefaultMoonshotBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_MOONSHOT_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing MOONSHOT_API_KEY');
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
    const nextModel = model.trim() || moonshotProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_MOONSHOT_API_KEY;
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
      id: `moonshot-user-${Date.now()}`,
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
        id: `moonshot-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in Moonshot stream:', error);
      throw error;
    }
  }
}

export const moonshotProviderDefinition: ProviderDefinition = {
  id: MOONSHOT_PROVIDER_ID,
  models: MOONSHOT_MODELS,
  defaultModel: DEFAULT_MOONSHOT_MODEL,
  create: () => new MoonshotProvider(),
};
