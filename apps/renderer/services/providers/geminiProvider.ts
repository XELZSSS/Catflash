import { GoogleGenAI, Chat, Content, GenerateContentResponse, Part, Type } from '@google/genai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import {
  ImageGenerationConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderChat,
  ProviderDefinition,
} from './types';
import { buildSystemInstruction } from './prompts';
import { GEMINI_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { callTavilySearch, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { TavilyToolArgs } from './openaiChatHelpers';

export const GEMINI_PROVIDER_ID: ProviderId = 'gemini';
export const GEMINI_MODEL_NAME = 'gemini-2.5-flash';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

const DEFAULT_GEMINI_API_KEY = sanitizeApiKey(process.env.GEMINI_API_KEY ?? process.env.API_KEY);
class GeminiProvider implements ProviderChat {
  private readonly id: ProviderId = GEMINI_PROVIDER_ID;

  private chat: Chat | null = null;
  private modelName: string;
  private apiKey?: string;
  private client: GoogleGenAI | null = null;
  private tavilyConfig?: TavilyConfig;
  private imageGenerationConfig?: ImageGenerationConfig;
  private history: ChatMessage[] = [];

  constructor() {
    this.modelName = GEMINI_MODEL_NAME;
    this.apiKey = DEFAULT_GEMINI_API_KEY;
    this.tavilyConfig = getDefaultTavilyConfig();
    if (this.apiKey) {
      this.resetChat();
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  private createChat(history: Content[] = []): Chat {
    return this.getClient().chats.create({
      model: this.modelName,
      history,
      config: {
        systemInstruction: buildSystemInstruction(this.id, this.modelName),
      },
    });
  }

  private buildContents(history: ChatMessage[]): Content[] {
    return history
      .filter((msg) => !msg.isError)
      .map((msg) => ({
        role: msg.role === Role.User ? 'user' : 'model',
        parts: [{ text: msg.text }] as Part[],
      }));
  }

  private buildTools() {
    if (!this.tavilyConfig?.apiKey) return undefined;
    return [
      {
        functionDeclarations: [
          {
            name: 'tavily_search',
            description:
              'Search the web for up-to-date information and return a concise summary with sources.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING, description: 'Search query' },
                search_depth: {
                  type: Type.STRING,
                  enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
                  description: 'Search depth',
                },
                max_results: {
                  type: Type.INTEGER,
                  minimum: 1,
                  maximum: 20,
                  description: 'Number of results to return',
                },
                topic: {
                  type: Type.STRING,
                  enum: ['general', 'news', 'finance'],
                  description: 'Search topic',
                },
                include_answer: { type: Type.BOOLEAN, description: 'Include answer summary' },
              },
              required: ['query'],
            },
          },
        ],
      },
    ];
  }

  private ensureChat(): Chat {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    if (!this.chat) {
      this.chat = this.createChat();
    }
    return this.chat;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || geminiProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
      this.resetChat();
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_GEMINI_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
      this.resetChat();
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
    const requested = this.modelName.trim();
    const imageModel = requested.toLowerCase().includes('image') ? requested : GEMINI_IMAGE_MODEL;
    const promptWithReference = request.subjectReference?.trim()
      ? `${request.prompt}\n\nReference image URL: ${request.subjectReference.trim()}`
      : request.prompt;
    const config: Record<string, unknown> = {
      responseModalities: ['TEXT', 'IMAGE'],
    };
    if (request.aspectRatio) {
      config.imageConfig = { aspectRatio: request.aspectRatio };
    }
    const response = await this.getClient().models.generateContent({
      model: imageModel,
      contents: [{ role: 'user', parts: [{ text: promptWithReference }] }],
      config: config as never,
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => Boolean(part.inlineData?.data));
    const base64Data = imagePart?.inlineData?.data;
    if (!base64Data) {
      throw new Error('Gemini image generation returned no image.');
    }
    const mimeType = imagePart?.inlineData?.mimeType ?? 'image/png';
    return {
      imageDataUrl: `data:${mimeType};base64,${base64Data}`,
      revisedPrompt: response.text ?? undefined,
    };
  }

  resetChat(): void {
    if (!this.apiKey) {
      this.chat = null;
      return;
    }
    this.chat = this.createChat();
    this.history = [];
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    this.history = messages.filter((msg) => !msg.isError);
    const history = this.buildContents(this.history);
    this.chat = this.createChat(history);
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    try {
      let fullResponse = '';
      const userMessage: ChatMessage = {
        id: `gemini-user-${Date.now()}`,
        role: Role.User,
        text: message,
        timestamp: Date.now(),
      };
      if (!this.tavilyConfig?.apiKey) {
        const chat = this.ensureChat();
        const result = await chat.sendMessageStream({ message });

        for await (const chunk of result) {
          const c = chunk as GenerateContentResponse;
          if (c.text) {
            fullResponse += c.text;
            yield c.text;
          }
        }
        if (fullResponse) {
          const modelMessage: ChatMessage = {
            id: `gemini-model-${Date.now()}`,
            role: Role.Model,
            text: fullResponse,
            timestamp: Date.now(),
          };
          this.history = [...this.history, userMessage, modelMessage];
        }
        return;
      }

      const contents = this.buildContents([...this.history, userMessage]);
      const tools = this.buildTools();
      const response = await this.getClient().models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: buildSystemInstruction(this.id, this.modelName),
          tools,
        },
      });

      const functionCalls = response.functionCalls ?? [];
      if (!functionCalls.length) {
        if (response.text) {
          fullResponse = response.text;
          yield response.text;
          const modelMessage: ChatMessage = {
            id: `gemini-model-${Date.now()}`,
            role: Role.Model,
            text: response.text,
            timestamp: Date.now(),
          };
          this.history = [...this.history, userMessage, modelMessage];
          return;
        }
        const chat = this.ensureChat();
        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
          const c = chunk as GenerateContentResponse;
          if (c.text) {
            fullResponse += c.text;
            yield c.text;
          }
        }
        if (fullResponse) {
          const modelMessage: ChatMessage = {
            id: `gemini-model-${Date.now()}`,
            role: Role.Model,
            text: fullResponse,
            timestamp: Date.now(),
          };
          this.history = [...this.history, userMessage, modelMessage];
        }
        return;
      }

      const toolParts: Part[] = [];
      for (const call of functionCalls) {
        if (call.name !== 'tavily_search') {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: { error: `Unsupported tool: ${call.name}` },
            },
          });
          continue;
        }
        const args = (call.args ?? {}) as TavilyToolArgs;
        if (!args.query) {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: { error: 'Missing query for tavily_search' },
            },
          });
          continue;
        }
        try {
          const result = await callTavilySearch(this.tavilyConfig, args);
          toolParts.push({
            functionResponse: { name: call.name, response: result as Record<string, unknown> },
          });
        } catch (error) {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: {
                error: error instanceof Error ? error.message : 'Tavily search failed',
              },
            },
          });
        }
      }

      const followupContents: Content[] = [
        ...contents,
        ...(response.candidates?.[0]?.content ? [response.candidates[0].content] : []),
        { role: 'user', parts: toolParts },
      ];

      const stream = await this.getClient().models.generateContentStream({
        model: this.modelName,
        contents: followupContents,
        config: {
          systemInstruction: buildSystemInstruction(this.id, this.modelName),
          tools,
        },
      });

      for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullResponse += c.text;
          yield c.text;
        }
      }
      if (fullResponse) {
        const modelMessage: ChatMessage = {
          id: `gemini-model-${Date.now()}`,
          role: Role.Model,
          text: fullResponse,
          timestamp: Date.now(),
        };
        this.history = [...this.history, userMessage, modelMessage];
      }
    } catch (error) {
      console.error('Error in Gemini stream:', error);
      throw error;
    }
  }
}

export const geminiProviderDefinition: ProviderDefinition = {
  id: GEMINI_PROVIDER_ID,
  models: Array.from(new Set([GEMINI_MODEL_NAME, ...GEMINI_MODEL_CATALOG])),
  defaultModel: GEMINI_MODEL_NAME,
  create: () => new GeminiProvider(),
};
