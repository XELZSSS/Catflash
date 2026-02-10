import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { OpenAIStyleProviderBase } from './openaiBase';
import {
  ImageGenerationConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderChat,
  ProviderDefinition,
} from './types';
import { buildSystemInstruction } from './prompts';
import { OPENAI_MODEL_CATALOG } from './models';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import {
  OpenAIChatMessages,
  runToolCallLoop,
  streamStandardChatCompletions,
} from './openaiChatHelpers';
import { sanitizeApiKey } from './utils';

export const OPENAI_PROVIDER_ID: ProviderId = 'openai';
const FALLBACK_OPENAI_MODEL = 'gpt-5.2';
const OPENAI_MODEL_FROM_ENV = process.env.OPENAI_MODEL;
const DEFAULT_OPENAI_MODEL =
  OPENAI_MODEL_FROM_ENV && OPENAI_MODEL_FROM_ENV !== 'undefined'
    ? OPENAI_MODEL_FROM_ENV
    : FALLBACK_OPENAI_MODEL;

const OPENAI_MODELS = Array.from(
  new Set([DEFAULT_OPENAI_MODEL, FALLBACK_OPENAI_MODEL, ...OPENAI_MODEL_CATALOG])
);

const DEFAULT_OPENAI_API_KEY = sanitizeApiKey(process.env.OPENAI_API_KEY);
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

const supportsReasoningSummary = (modelName: string): boolean => {
  const lower = modelName.toLowerCase();
  return lower.startsWith('gpt-5') || lower.startsWith('o');
};

const resolveOpenAIImageModel = (modelName: string): string => {
  const lower = modelName.toLowerCase();
  if (lower.includes('image')) return modelName;
  return 'gpt-image-1';
};

class OpenAIProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = OPENAI_PROVIDER_ID;
  private apiKey?: string;

  private client: OpenAI | null = null;
  private modelName: string;
  private tavilyConfig?: TavilyConfig;
  private imageGenerationConfig?: ImageGenerationConfig;
  constructor() {
    super();
    this.apiKey = DEFAULT_OPENAI_API_KEY;
    this.modelName = openaiProviderDefinition.defaultModel;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_OPENAI_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing OPENAI_API_KEY');
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: OPENAI_BASE_URL,
        dangerouslyAllowBrowser: true,
      });
    }
    return this.client;
  }

  private toInputMessages(messages: ChatMessage[]): Array<{
    type: 'message';
    role: 'user' | 'assistant';
    content: Array<{ type: 'input_text'; text: string }>;
  }> {
    return messages
      .filter((msg) => !msg.isError)
      .map((msg) => ({
        type: 'message' as const,
        role: msg.role === Role.User ? ('user' as const) : ('assistant' as const),
        content: [
          {
            type: 'input_text' as const,
            text: msg.text,
          },
        ],
      }));
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
    const nextModel = model.trim() || openaiProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_OPENAI_API_KEY;
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

  getImageGenerationConfig(): ImageGenerationConfig | undefined {
    return this.imageGenerationConfig;
  }

  setImageGenerationConfig(config?: ImageGenerationConfig): void {
    this.imageGenerationConfig = config;
  }

  supportsImageGeneration(): boolean {
    return true;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const client = this.getClient();
    const payload: Record<string, unknown> = {
      model: resolveOpenAIImageModel(this.modelName),
      prompt: request.prompt,
      n: request.count ?? 1,
      size: request.size ?? '1024x1024',
    };
    if (request.quality) {
      payload.quality = request.quality;
    }
    const response = (await client.images.generate(payload as never)) as unknown as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };

    const first = response.data?.[0];
    if (!first) {
      throw new Error('OpenAI image generation returned no image.');
    }
    return {
      imageUrl: first.url,
      imageDataUrl: first.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined,
      revisedPrompt: first.revised_prompt,
    };
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const userMessage: ChatMessage = {
      id: `openai-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const input = this.toInputMessages(nextHistory);

    let fullResponse = '';
    const enableReasoningSummary = supportsReasoningSummary(this.modelName);

    try {
      const tools = this.buildTools();
      if (!tools) {
        const stream = await client.responses.create({
          model: this.modelName,
          instructions: buildSystemInstruction(this.id, this.modelName),
          input,
          stream: true,
          reasoning: enableReasoningSummary ? { summary: 'auto' } : undefined,
        });

        for await (const event of stream as AsyncIterable<{
          type?: string;
          delta?: string;
          text?: string;
          summary_index?: number;
        }>) {
          if (event.type === 'response.output_text.delta' && event.delta) {
            fullResponse += event.delta;
            yield event.delta;
          } else if (event.type === 'response.output_text.done' && event.text && !fullResponse) {
            fullResponse = event.text;
          } else if (
            event.type === 'response.reasoning_summary_text.delta' &&
            event.delta &&
            enableReasoningSummary
          ) {
            yield `<think>${event.delta}</think>`;
          } else if (
            event.type === 'response.reasoning_text.delta' &&
            event.delta &&
            enableReasoningSummary
          ) {
            yield `<think>${event.delta}</think>`;
          } else if (
            event.type === 'response.reasoning_summary_text.done' &&
            event.text &&
            enableReasoningSummary
          ) {
            yield `<think>${event.text}</think>`;
          } else if (
            event.type === 'response.reasoning_text.done' &&
            event.text &&
            enableReasoningSummary
          ) {
            yield `<think>${event.text}</think>`;
          }
        }
      } else {
        const baseMessages = this.buildMessages(nextHistory, this.id, this.modelName);
        const {
          messages: workingMessages,
          preflightMessage,
          hadToolCalls,
        } = await runToolCallLoop({
          client,
          model: this.modelName,
          messages: baseMessages as OpenAIChatMessages,
          tools,
          tavilyConfig: this.tavilyConfig,
          buildToolMessages: this.buildToolMessages.bind(this),
        });

        if (!hadToolCalls && preflightMessage?.content) {
          fullResponse = preflightMessage.content;
          yield fullResponse;
        } else {
          for await (const chunk of streamStandardChatCompletions({
            client,
            model: this.modelName,
            messages: workingMessages,
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
      }

      const modelMessage: ChatMessage = {
        id: `openai-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in OpenAI stream:', error);
      throw error;
    }
  }
}

export const openaiProviderDefinition: ProviderDefinition = {
  id: OPENAI_PROVIDER_ID,
  models: OPENAI_MODELS,
  defaultModel: DEFAULT_OPENAI_MODEL,
  create: () => new OpenAIProvider(),
};
