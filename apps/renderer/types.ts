export enum Role {
  User = 'user',
  Model = 'model',
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  isError?: boolean;
  reasoning?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
}

export type ProviderId =
  | 'gemini'
  | 'openai'
  | 'openai-compatible'
  | 'xai'
  | 'deepseek'
  | 'glm'
  | 'minimax'
  | 'moonshot'
  | 'iflow';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  provider: ProviderId;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export type TavilySearchDepth = 'basic' | 'advanced' | 'fast' | 'ultra-fast';
export type TavilyTopic = 'general' | 'news' | 'finance';

export interface TavilyConfig {
  apiKey?: string;
  projectId?: string;
  searchDepth?: TavilySearchDepth;
  maxResults?: number;
  topic?: TavilyTopic;
  includeAnswer?: boolean;
}

export interface ProviderError {
  provider: ProviderId;
  message: string;
  cause?: unknown;
}
