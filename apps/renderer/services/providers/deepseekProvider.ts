import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { DEEPSEEK_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { runToolCallLoop, streamStandardChatCompletions } from './openaiChatHelpers';

export const DEEPSEEK_PROVIDER_ID: ProviderId = 'deepseek';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const FALLBACK_DEEPSEEK_MODEL = 'deepseek-chat';
const DEEPSEEK_MODEL_FROM_ENV = process.env.DEEPSEEK_MODEL;
const DEFAULT_DEEPSEEK_MODEL =
  DEEPSEEK_MODEL_FROM_ENV && DEEPSEEK_MODEL_FROM_ENV !== 'undefined'
    ? DEEPSEEK_MODEL_FROM_ENV
    : FALLBACK_DEEPSEEK_MODEL;

const DEEPSEEK_MODELS = Array.from(
  new Set([DEFAULT_DEEPSEEK_MODEL, FALLBACK_DEEPSEEK_MODEL, ...DEEPSEEK_MODEL_CATALOG])
);

const DEFAULT_DEEPSEEK_API_KEY = sanitizeApiKey(process.env.DEEPSEEK_API_KEY);

class DeepSeekProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = DEEPSEEK_PROVIDER_ID;

  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private tavilyConfig?: TavilyConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_DEEPSEEK_API_KEY;
    this.modelName = deepseekProviderDefinition.defaultModel;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_DEEPSEEK_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing DEEPSEEK_API_KEY');
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: DEEPSEEK_BASE_URL,
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
    const nextModel = model.trim() || deepseekProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_DEEPSEEK_API_KEY;
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
      id: `deepseek-user-${Date.now()}`,
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
        getAssistantMessageExtras: (preflightMessage) => {
          const reasoning =
            preflightMessage?.reasoning_content ?? preflightMessage?.reasoning ?? undefined;
          return reasoning ? { reasoning_content: reasoning } : null;
        },
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
        id: `deepseek-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in DeepSeek stream:', error);
      throw error;
    }
  }
}

export const deepseekProviderDefinition: ProviderDefinition = {
  id: DEEPSEEK_PROVIDER_ID,
  models: DEEPSEEK_MODELS,
  defaultModel: DEFAULT_DEEPSEEK_MODEL,
  create: () => new DeepSeekProvider(),
};
