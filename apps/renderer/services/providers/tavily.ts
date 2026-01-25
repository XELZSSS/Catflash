import type OpenAI from 'openai';
import { TavilyConfig } from '../../types';
import { sanitizeApiKey } from './utils';

export const normalizeTavilyConfig = (value?: TavilyConfig): TavilyConfig | undefined => {
  if (!value) return undefined;
  const apiKey = sanitizeApiKey(value.apiKey);
  const projectId = value.projectId?.trim() || undefined;
  const searchDepth = value.searchDepth;
  const maxResults =
    typeof value.maxResults === 'number' && Number.isFinite(value.maxResults)
      ? Math.min(Math.max(Math.round(value.maxResults), 1), 20)
      : undefined;
  const topic = value.topic;
  const includeAnswer = value.includeAnswer ?? undefined;
  if (!apiKey && !projectId && !searchDepth && !maxResults && !topic && includeAnswer === undefined)
    return undefined;
  return { apiKey, projectId, searchDepth, maxResults, topic, includeAnswer };
};

export const getDefaultTavilyConfig = (): TavilyConfig | undefined => {
  const apiKey = sanitizeApiKey(process.env.TAVILY_API_KEY);
  if (!apiKey) return undefined;
  const maxResults = process.env.TAVILY_MAX_RESULTS
    ? Number.parseInt(process.env.TAVILY_MAX_RESULTS, 10)
    : undefined;
  const includeAnswer =
    process.env.TAVILY_INCLUDE_ANSWER === 'true'
      ? true
      : process.env.TAVILY_INCLUDE_ANSWER === 'false'
        ? false
        : undefined;
  return normalizeTavilyConfig({
    apiKey,
    projectId: process.env.TAVILY_PROJECT_ID,
    searchDepth: process.env.TAVILY_SEARCH_DEPTH as TavilyConfig['searchDepth'],
    maxResults,
    topic: process.env.TAVILY_TOPIC as TavilyConfig['topic'],
    includeAnswer,
  });
};

export const buildOpenAITavilyTools = (
  tavilyConfig?: TavilyConfig
): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined => {
  if (!tavilyConfig?.apiKey) return undefined;
  return [
    {
      type: 'function' as const,
      function: {
        name: 'tavily_search',
        description:
          'Search the web for up-to-date information and return a concise summary with sources.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            search_depth: {
              type: 'string',
              enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
              description: 'Search depth',
            },
            max_results: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              description: 'Number of results to return',
            },
            topic: {
              type: 'string',
              enum: ['general', 'news', 'finance'],
              description: 'Search topic',
            },
            include_answer: { type: 'boolean', description: 'Include answer summary' },
          },
          required: ['query'],
        },
      },
    },
  ];
};

export const callTavilySearch = async (
  tavilyConfig: TavilyConfig | undefined,
  args: {
    query: string;
    search_depth?: TavilyConfig['searchDepth'];
    max_results?: number;
    topic?: TavilyConfig['topic'];
    include_answer?: boolean;
  }
): Promise<unknown> => {
  if (!tavilyConfig?.apiKey) {
    throw new Error('Missing Tavily API key');
  }
  const payload = {
    query: args.query,
    search_depth: args.search_depth ?? tavilyConfig.searchDepth ?? 'basic',
    max_results: Math.min(Math.max(args.max_results ?? tavilyConfig.maxResults ?? 5, 1), 20),
    topic: args.topic ?? tavilyConfig.topic ?? 'general',
    include_answer: args.include_answer ?? tavilyConfig.includeAnswer ?? true,
  };

  const response = await fetch('http://localhost:4010/proxy/tavily/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tavilyConfig.apiKey}`,
      ...(tavilyConfig.projectId ? { 'X-Project-ID': tavilyConfig.projectId } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }
  return response.json();
};
