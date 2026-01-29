import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import { ProviderChat, ProviderDefinition } from './types';
import { DEEPSEEK_MODEL_CATALOG } from './models';
import { getMaxToolCallRounds, sanitizeApiKey } from './utils';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';

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
      if (tools) {
        let workingMessages = messages;
        let preflightMessage:
          | (OpenAI.Chat.Completions.ChatCompletionMessage & {
              tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
              reasoning_content?: string;
              reasoning?: string;
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
          });

          preflightMessage = initialResponse?.choices?.[0]?.message ?? null;
          const toolCalls =
            (preflightMessage?.tool_calls as Array<{
              id: string;
              function?: { name?: string; arguments?: string };
            }>) ?? [];

          if (!toolCalls.length) {
            break;
          }

          const toolMessages = await this.buildToolMessages(toolCalls, this.tavilyConfig);
          workingMessages = [
            ...workingMessages,
            {
              role: 'assistant' as const,
              content: preflightMessage?.content ?? null,
              tool_calls: toolCalls,
              ...(preflightMessage?.reasoning_content || preflightMessage?.reasoning
                ? {
                    reasoning_content:
                      preflightMessage?.reasoning_content ?? preflightMessage?.reasoning,
                  }
                : {}),
            },
            ...toolMessages,
          ];
        }

        const stream = (await client.chat.completions.create({
          model: this.modelName,
          messages: workingMessages as any,
          stream: true,
        })) as unknown as AsyncIterable<{
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
            message?: { content?: string };
          }>;
        }>;

        for await (const chunk of stream) {
          const reasoningDelta = chunk.choices?.[0]?.delta?.reasoning_content;
          if (reasoningDelta) {
            // Wrap reasoning content so the UI can show it in a dedicated panel during streaming.
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
        const stream = await client.chat.completions.create({
          model: this.modelName,
          messages,
          stream: true,
        });

        for await (const chunk of stream as AsyncIterable<{
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
            message?: { content?: string };
          }>;
        }>) {
          const reasoningDelta = chunk.choices?.[0]?.delta?.reasoning_content;
          if (reasoningDelta) {
            // Wrap reasoning content so the UI can show it in a dedicated panel during streaming.
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
