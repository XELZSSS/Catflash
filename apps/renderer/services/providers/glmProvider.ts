import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { ProviderChat, ProviderDefinition } from './types';
import { buildSystemInstruction } from './prompts';
import { GLM_MODEL_CATALOG } from './models';
import { getMaxToolCallRounds, sanitizeApiKey } from './utils';
import {
  buildOpenAITavilyTools,
  callTavilySearch,
  getDefaultTavilyConfig,
  normalizeTavilyConfig,
} from './tavily';

export const GLM_PROVIDER_ID: ProviderId = 'glm';
export const GLM_BASE_URL_CN = 'http://localhost:4010/proxy/glm-cn/chat/completions';
export const GLM_BASE_URL_INTL = 'http://localhost:4010/proxy/glm-intl/chat/completions';

const resolveBaseUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window !== 'undefined') {
    return new URL(value, window.location.origin).toString();
  }
  return value;
};

export const getDefaultGlmBaseUrl = (): string => {
  const envOverride = process.env.GLM_BASE_URL;
  if (envOverride && envOverride !== 'undefined') {
    return resolveBaseUrl(envOverride);
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return resolveBaseUrl(GLM_BASE_URL_CN);
    }
  }
  return resolveBaseUrl(GLM_BASE_URL_INTL);
};

const FALLBACK_GLM_MODEL = 'glm-4.7';
const GLM_MODEL_FROM_ENV = process.env.GLM_MODEL;
const DEFAULT_GLM_MODEL =
  GLM_MODEL_FROM_ENV && GLM_MODEL_FROM_ENV !== 'undefined'
    ? GLM_MODEL_FROM_ENV
    : FALLBACK_GLM_MODEL;

const GLM_MODELS = Array.from(
  new Set([DEFAULT_GLM_MODEL, FALLBACK_GLM_MODEL, ...GLM_MODEL_CATALOG])
);

const DEFAULT_GLM_API_KEY = sanitizeApiKey(process.env.GLM_API_KEY);

type GlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const buildMessages = (history: ChatMessage[], systemInstruction: string): GlmMessage[] => [
  { role: 'system', content: systemInstruction },
  ...history
    .filter((msg) => !msg.isError)
    .map((msg) => ({
      role: (msg.role === Role.User ? 'user' : 'assistant') as GlmMessage['role'],
      content: msg.text,
    })),
];

const parseSseLines = (buffer: string): { lines: string[]; rest: string } => {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? '';
  return { lines: parts, rest };
};

class GlmProvider implements ProviderChat {
  private readonly id: ProviderId = GLM_PROVIDER_ID;
  private apiKey?: string;
  private modelName: string;
  private baseUrl: string;
  private tavilyConfig?: TavilyConfig;
  private history: ChatMessage[] = [];

  constructor() {
    this.apiKey = DEFAULT_GLM_API_KEY;
    this.modelName = glmProviderDefinition.defaultModel;
    this.baseUrl = getDefaultGlmBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getApiKeyValue(): string {
    const keyToUse = this.apiKey ?? DEFAULT_GLM_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing GLM_API_KEY');
    }
    return keyToUse;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || glmProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_GLM_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
    }
  }

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim();
    if (nextUrl && nextUrl !== this.baseUrl) {
      this.baseUrl = resolveBaseUrl(nextUrl);
    }
  }

  resetChat(): void {
    this.history = [];
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    this.history = messages.filter((msg) => !msg.isError);
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const userMessage: ChatMessage = {
      id: `glm-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const systemInstruction = buildSystemInstruction(this.id, this.modelName);
    const messages = buildMessages(nextHistory, systemInstruction);

    const tools = buildOpenAITavilyTools(this.tavilyConfig);
    const payload = {
      model: this.modelName,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
    };

    if (tools) {
      let workingMessages = messages as any;
      const maxToolRounds = getMaxToolCallRounds();
      for (let round = 0; round < maxToolRounds; round += 1) {
        const preflight = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getApiKeyValue()}`,
          },
          body: JSON.stringify({ ...payload, messages: workingMessages, stream: false }),
        });

        if (!preflight.ok) {
          throw new Error(`GLM tool preflight failed: ${preflight.status}`);
        }

        const preflightData = (await preflight.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
            };
          }>;
        };

        const toolCalls = preflightData.choices?.[0]?.message?.tool_calls ?? [];
        if (!toolCalls.length) {
          payload.messages = workingMessages;
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
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content,
        }));

        workingMessages = [
          ...workingMessages,
          {
            role: 'assistant',
            content: preflightData.choices?.[0]?.message?.content ?? null,
            tool_calls: toolCalls,
          },
          ...toolMessages,
        ];

        payload.messages = workingMessages;
      }
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKeyValue()}`,
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`GLM stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { lines, rest } = parseSseLines(buffer);
        buffer = rest;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payloadText = trimmed.replace(/^data:\s*/i, '');
          if (payloadText === '[DONE]') {
            buffer = '';
            break;
          }

          let chunk: any;
          try {
            chunk = JSON.parse(payloadText);
          } catch {
            continue;
          }

          const reasoningDelta =
            chunk?.choices?.[0]?.delta?.reasoning_content ??
            chunk?.choices?.[0]?.message?.reasoning_content;
          if (reasoningDelta) {
            yield `<think>${reasoningDelta}</think>`;
          }

          const contentDelta =
            chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      }

      const modelMessage: ChatMessage = {
        id: `glm-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in GLM stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}

export const glmProviderDefinition: ProviderDefinition = {
  id: GLM_PROVIDER_ID,
  models: GLM_MODELS,
  defaultModel: DEFAULT_GLM_MODEL,
  create: () => new GlmProvider(),
};
