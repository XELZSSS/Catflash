import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { MOONSHOT_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import {
  buildOpenAITavilyTools,
  callTavilySearch,
  getDefaultTavilyConfig,
  normalizeTavilyConfig,
} from './tavily';

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
      let initialResponse: OpenAI.Chat.Completions.ChatCompletion | null = null;
      if (tools) {
        initialResponse = await client.chat.completions.create({
          model: this.modelName,
          messages,
          tools,
          tool_choice: 'auto',
          stream: false,
        });
      }

      const toolCalls =
        (initialResponse?.choices?.[0]?.message?.tool_calls as Array<{
          id: string;
          function?: { name?: string; arguments?: string };
        }>) ?? [];

      if (!toolCalls || toolCalls.length === 0) {
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
      } else {
        const toolResults = await Promise.all(
          toolCalls.map(async (call) => {
            if (call.function?.name !== 'tavily_search') {
              return {
                tool_call_id: call.id,
                content: JSON.stringify({
                  error: `Unsupported tool: ${call.function?.name ?? 'unknown'}`,
                }),
              };
            }
            let args: { query?: string } = {};
            try {
              args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
            } catch {
              args = {};
            }
            if (!args.query) {
              return {
                tool_call_id: call.id,
                content: JSON.stringify({ error: 'Missing query for tavily_search' }),
              };
            }
            try {
              const result = await callTavilySearch(this.tavilyConfig, args as any);
              return {
                tool_call_id: call.id,
                content: JSON.stringify(result),
              };
            } catch (error) {
              return {
                tool_call_id: call.id,
                content: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Tavily search failed',
                }),
              };
            }
          })
        );

        const toolMessages = toolResults.map((result) => ({
          role: 'tool' as const,
          tool_call_id: result.tool_call_id,
          content: result.content,
        }));

        const followupMessages = [
          ...messages,
          {
            role: 'assistant' as const,
            content: initialResponse?.choices?.[0]?.message?.content ?? null,
            tool_calls: toolCalls,
          },
          ...toolMessages,
        ];

        const stream = (await client.chat.completions.create({
          model: this.modelName,
          messages: followupMessages as any,
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
