import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import {
  OpenAIChatMessages,
  ToolLoopOverrides,
  runToolCallLoop,
  streamStandardChatCompletions,
} from './openaiChatHelpers';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { sanitizeApiKey } from './utils';

type OpenAIStandardProviderBaseOptions = {
  id: ProviderId;
  defaultModel: string;
  defaultApiKey?: string;
  missingApiKeyError: string;
  logLabel: string;
};

export abstract class OpenAIStandardProviderBase extends OpenAIStyleProviderBase {
  protected readonly id: ProviderId;
  protected apiKey?: string;
  protected client: OpenAI | null = null;
  protected modelName: string;
  protected tavilyConfig?: TavilyConfig;

  private readonly defaultModel: string;
  private readonly defaultApiKey?: string;
  private readonly missingApiKeyError: string;
  private readonly logLabel: string;

  constructor(options: OpenAIStandardProviderBaseOptions) {
    super();
    this.id = options.id;
    this.defaultModel = options.defaultModel;
    this.defaultApiKey = options.defaultApiKey;
    this.missingApiKeyError = options.missingApiKeyError;
    this.logLabel = options.logLabel;
    this.apiKey = options.defaultApiKey;
    this.modelName = options.defaultModel;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  protected abstract createClient(apiKey: string): OpenAI;

  protected getToolLoopOverrides(): ToolLoopOverrides {
    return {};
  }

  protected getClient(): OpenAI {
    const keyToUse = this.apiKey ?? this.defaultApiKey;
    if (!keyToUse) {
      throw new Error(this.missingApiKeyError);
    }
    if (!this.client) {
      this.client = this.createClient(keyToUse);
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
    const nextModel = model.trim() || this.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? this.defaultApiKey;
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
      id: `${this.id}-user-${Date.now()}`,
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
        ...this.getToolLoopOverrides(),
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
        id: `${this.id}-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error(`Error in ${this.logLabel} stream:`, error);
      throw error;
    }
  }
}
