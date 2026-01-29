import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { MINIMAX_MODEL_CATALOG } from './models';
import { getMaxToolCallRounds, sanitizeApiKey } from './utils';
import {
  buildOpenAITavilyTools,
  callTavilySearch,
  getDefaultTavilyConfig,
  normalizeTavilyConfig,
} from './tavily';

export const MINIMAX_PROVIDER_ID: ProviderId = 'minimax';
export const DEFAULT_MINIMAX_BASE_URL = 'http://localhost:4010/proxy/minimax-intl';
export const CHINA_MINIMAX_BASE_URL = 'http://localhost:4010/proxy/minimax-cn';

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultMinimaxBaseUrl = (): string => {
  const envOverride = process.env.MINIMAX_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return resolveBaseUrl(CHINA_MINIMAX_BASE_URL);
    }
  }
  return resolveBaseUrl(DEFAULT_MINIMAX_BASE_URL);
};

const FALLBACK_MINIMAX_MODEL = 'MiniMax-M2.1';
const MINIMAX_MODEL_FROM_ENV = process.env.MINIMAX_MODEL;
const DEFAULT_MINIMAX_MODEL =
  MINIMAX_MODEL_FROM_ENV && MINIMAX_MODEL_FROM_ENV !== 'undefined'
    ? MINIMAX_MODEL_FROM_ENV
    : FALLBACK_MINIMAX_MODEL;

const MINIMAX_MODELS = Array.from(new Set([DEFAULT_MINIMAX_MODEL, ...MINIMAX_MODEL_CATALOG]));

const DEFAULT_MINIMAX_API_KEY = sanitizeApiKey(process.env.MINIMAX_API_KEY);

class MiniMaxProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = MINIMAX_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;
  private modelName: string;
  private baseUrl: string;
  private tavilyConfig?: TavilyConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_MINIMAX_API_KEY;
    this.modelName = minimaxProviderDefinition.defaultModel;
    this.baseUrl = getDefaultMinimaxBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_MINIMAX_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing MINIMAX_API_KEY');
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
    const nextModel = model.trim() || minimaxProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_MINIMAX_API_KEY;
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
      id: `minimax-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    let fullResponse = '';
    let fullReasoning = '';

    try {
      const tools = this.buildTools();
      if (tools) {
        let workingMessages = messages;
        let preflightMessage:
          | (OpenAI.Chat.Completions.ChatCompletionMessage & {
              tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
              reasoning_details?: Array<{ text?: string }>;
            })
          | null = null;
        const maxToolRounds = getMaxToolCallRounds();

        for (let round = 0; round < maxToolRounds; round += 1) {
          const initialResponse = await client.chat.completions.create({
            model: this.modelName,
            messages: workingMessages,
            tools,
            tool_choice: 'auto',
            stream: false,
            extra_body: { reasoning_split: true },
          } as any);

          preflightMessage = initialResponse?.choices?.[0]?.message ?? null;
          const toolCalls =
            (preflightMessage?.tool_calls as Array<{
              id: string;
              function?: { name?: string; arguments?: string };
            }>) ?? [];

          if (!toolCalls.length) {
            break;
          }

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

          workingMessages = [
            ...workingMessages,
            {
              role: 'assistant' as const,
              content: preflightMessage?.content ?? null,
              tool_calls: toolCalls,
              ...(preflightMessage?.reasoning_details?.length
                ? { reasoning_details: preflightMessage.reasoning_details }
                : {}),
            },
            ...toolMessages,
          ];
        }

        const stream = (await client.chat.completions.create({
          model: this.modelName,
          messages: workingMessages as any,
          stream: true,
          extra_body: { reasoning_split: true },
        } as any)) as unknown as AsyncIterable<{
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_details?: Array<{ text?: string }>;
            };
          }>;
        }>;

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const reasoningDetails = delta?.reasoning_details ?? [];
          for (const detail of reasoningDetails) {
            if (!detail?.text) continue;
            fullReasoning += detail.text;
            yield `<think>${detail.text}</think>`;
          }

          const contentDelta = delta?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      } else {
        const stream = (await client.chat.completions.create({
          model: this.modelName,
          messages,
          stream: true,
          extra_body: { reasoning_split: true },
        } as any)) as unknown as AsyncIterable<{
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_details?: Array<{ text?: string }>;
            };
          }>;
        }>;

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const reasoningDetails = delta?.reasoning_details ?? [];
          for (const detail of reasoningDetails) {
            if (!detail?.text) continue;
            fullReasoning += detail.text;
            yield `<think>${detail.text}</think>`;
          }

          const contentDelta = delta?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      }

      const modelMessage: ChatMessage = {
        id: `minimax-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        reasoning: fullReasoning || undefined,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in MiniMax stream:', error);
      throw error;
    }
  }
}

export const minimaxProviderDefinition: ProviderDefinition = {
  id: MINIMAX_PROVIDER_ID,
  models: MINIMAX_MODELS,
  defaultModel: DEFAULT_MINIMAX_MODEL,
  create: () => new MiniMaxProvider(),
};
