export enum Role {
  User = 'user',
  Model = 'model',
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  timeLabel?: string;
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
  | 'ollama'
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

export type ObsidianMode = 'vault' | 'plugin';
export type ObsidianReadMode = 'selected' | 'recent' | 'active';
export type ObsidianWriteMode = 'append' | 'insert-heading' | 'replace';

export interface ObsidianSettings {
  mode: ObsidianMode;
  vaultPath?: string;
  notePath?: string;
  apiUrl?: string;
  apiKey?: string;
  readMode: ObsidianReadMode;
  writeMode: ObsidianWriteMode;
  writeHeading: string;
  previewBeforeWrite: boolean;
}
