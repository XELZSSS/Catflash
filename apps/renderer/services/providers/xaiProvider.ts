import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { XAI_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { runToolCallLoop, streamStandardChatCompletions } from './openaiChatHelpers';

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

class XAIProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = XAI_PROVIDER_ID;

  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private tavilyConfig?: TavilyConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_XAI_API_KEY;
    this.modelName = xaiProviderDefinition.defaultModel;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_XAI_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing XAI_API_KEY');
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: XAI_BASE_URL,
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
    const nextModel = model.trim() || xaiProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_XAI_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
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
      id: `xai-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    let fullResponse = '';

    try {
      const tools = this.buildTools();
      const { messages: workingMessages } = await runToolCallLoop({
        client,
        model: this.modelName,
        messages: messages as any,
        tools,
        tavilyConfig: this.tavilyConfig,
        buildToolMessages: this.buildToolMessages.bind(this),
      });

      for await (const chunk of streamStandardChatCompletions({
        client,
        model: this.modelName,
        messages: (tools ? workingMessages : messages) as any,
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
        id: `xai-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in xAI stream:', error);
      throw error;
    }
  }
}

export const xaiProviderDefinition: ProviderDefinition = {
  id: XAI_PROVIDER_ID,
  models: XAI_MODELS,
  defaultModel: DEFAULT_XAI_MODEL,
  create: () => new XAIProvider(),
};
