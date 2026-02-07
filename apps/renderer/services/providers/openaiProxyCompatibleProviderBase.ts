import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import {
  OpenAIChatMessages,
  runToolCallLoop,
  streamStandardChatCompletions,
} from './openaiChatHelpers';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { sanitizeApiKey } from './utils';

type OpenAIProxyCompatibleProviderBaseOptions = {
  id: ProviderId;
  defaultModel: string;
  defaultApiKey?: string;
  fallbackApiKey?: string;
  proxyBaseUrl: string;
  defaultTargetBaseUrl?: string;
  missingApiKeyError?: string;
  missingBaseUrlError: string;
  logLabel: string;
  supportsTavily?: boolean;
};

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

export abstract class OpenAIProxyCompatibleProviderBase extends OpenAIStyleProviderBase {
  protected readonly id: ProviderId;
  protected apiKey?: string;
  protected client: OpenAI | null = null;
  protected modelName: string;
  protected targetBaseUrl?: string;
  protected customHeaders: Array<{ key: string; value: string }> = [];
  protected tavilyConfig?: TavilyConfig;

  private readonly defaultModel: string;
  private readonly defaultApiKey?: string;
  private readonly fallbackApiKey?: string;
  private readonly proxyBaseUrl: string;
  private readonly missingApiKeyError?: string;
  private readonly missingBaseUrlError: string;
  private readonly logLabel: string;
  private readonly supportsTavily: boolean;

  constructor(options: OpenAIProxyCompatibleProviderBaseOptions) {
    super();
    this.id = options.id;
    this.defaultModel = options.defaultModel;
    this.defaultApiKey = options.defaultApiKey;
    this.fallbackApiKey = options.fallbackApiKey;
    this.proxyBaseUrl = options.proxyBaseUrl;
    this.missingApiKeyError = options.missingApiKeyError;
    this.missingBaseUrlError = options.missingBaseUrlError;
    this.logLabel = options.logLabel;
    this.supportsTavily = options.supportsTavily ?? false;

    this.apiKey = options.defaultApiKey;
    this.modelName = options.defaultModel;
    this.targetBaseUrl = options.defaultTargetBaseUrl;
    this.tavilyConfig = this.supportsTavily ? getDefaultTavilyConfig() : undefined;
  }

  protected resolveTargetBaseUrl(baseUrl?: string): string | undefined {
    return baseUrl;
  }

  private resolveApiKey(): string | undefined {
    return this.apiKey ?? this.defaultApiKey ?? this.fallbackApiKey;
  }

  protected getClient(): OpenAI {
    const keyToUse = this.resolveApiKey();
    if (!keyToUse && this.missingApiKeyError) {
      throw new Error(this.missingApiKeyError);
    }
    if (!this.targetBaseUrl) {
      throw new Error(this.missingBaseUrlError);
    }
    if (!this.client) {
      const headersPayload = normalizeCustomHeaders(this.customHeaders);
      this.client = new OpenAI({
        apiKey: keyToUse ?? 'placeholder',
        baseURL: this.proxyBaseUrl,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'x-openai-compatible-base-url': this.targetBaseUrl,
          'x-openai-compatible-headers': JSON.stringify(headersPayload),
        },
      });
    }
    return this.client;
  }

  private buildTools(): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    if (!this.supportsTavily) return undefined;
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

  getBaseUrl(): string | undefined {
    return this.targetBaseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = this.resolveTargetBaseUrl(baseUrl);
    if (nextUrl !== this.targetBaseUrl) {
      this.targetBaseUrl = nextUrl;
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
    if (!this.supportsTavily) return;
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
      } else {
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
