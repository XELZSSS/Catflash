import OpenAI from 'openai';
import type { TavilyConfig } from '../../types';
import { getMaxToolCallRounds } from './utils';

type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type ToolMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

type PreflightMessage = OpenAI.Chat.Completions.ChatCompletionMessage & {
  tool_calls?: ToolCall[];
  reasoning_content?: string;
  reasoning?: string;
  reasoning_details?: Array<{ text?: string }>;
};

type RunToolLoopOptions = {
  client: OpenAI;
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
  }>;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tavilyConfig?: TavilyConfig;
  maxRounds?: number;
  extraBody?: Record<string, unknown>;
  buildToolMessages: (toolCalls: ToolCall[], tavilyConfig?: TavilyConfig) => Promise<ToolMessage[]>;
  getAssistantMessageExtras?: (message: PreflightMessage) => Record<string, unknown> | null;
};

type RunToolLoopResult = {
  messages: RunToolLoopOptions['messages'];
  preflightMessage: PreflightMessage | null;
  hadToolCalls: boolean;
};

export const runToolCallLoop = async ({
  client,
  model,
  messages,
  tools,
  tavilyConfig,
  maxRounds = getMaxToolCallRounds(),
  extraBody,
  buildToolMessages,
  getAssistantMessageExtras,
}: RunToolLoopOptions): Promise<RunToolLoopResult> => {
  if (!tools) {
    return { messages, preflightMessage: null, hadToolCalls: false };
  }

  let workingMessages = messages;
  let preflightMessage: PreflightMessage | null = null;
  let hadToolCalls = false;

  for (let round = 0; round < maxRounds; round += 1) {
    const initialResponse = await client.chat.completions.create({
      model,
      messages: workingMessages,
      tools,
      tool_choice: 'auto',
      stream: false,
      ...(extraBody ? { extra_body: extraBody } : {}),
    } as any);

    preflightMessage = (initialResponse?.choices?.[0]?.message as PreflightMessage) ?? null;
    const toolCalls = (preflightMessage?.tool_calls as ToolCall[]) ?? [];

    if (!toolCalls.length) {
      break;
    }

    hadToolCalls = true;
    const toolMessages = await buildToolMessages(toolCalls, tavilyConfig);
    const extras = getAssistantMessageExtras?.(preflightMessage) ?? {};
    workingMessages = [
      ...workingMessages,
      {
        role: 'assistant' as const,
        content: preflightMessage?.content ?? null,
        tool_calls: toolCalls,
        ...extras,
      },
      ...toolMessages,
    ];
  }

  return { messages: workingMessages, preflightMessage, hadToolCalls };
};

type StreamChunk = {
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
};

type StreamOptions = {
  client: OpenAI;
  model: string;
  messages: unknown;
  extraBody?: Record<string, unknown>;
};

export async function* streamStandardChatCompletions({
  client,
  model,
  messages,
  extraBody,
}: StreamOptions): AsyncGenerator<{ content?: string; reasoning?: string }, void, unknown> {
  const stream = (await client.chat.completions.create({
    model,
    messages,
    stream: true,
    ...(extraBody ? { extra_body: extraBody } : {}),
  } as any)) as unknown as AsyncIterable<StreamChunk>;

  for await (const chunk of stream) {
    const reasoningDelta =
      chunk.choices?.[0]?.delta?.reasoning_content ??
      chunk.choices?.[0]?.delta?.reasoning_text ??
      chunk.choices?.[0]?.delta?.reasoning ??
      chunk.choices?.[0]?.message?.reasoning_content ??
      chunk.choices?.[0]?.message?.reasoning_text ??
      chunk.choices?.[0]?.message?.reasoning;
    if (reasoningDelta) {
      yield { reasoning: reasoningDelta };
    }

    const contentDelta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
    if (contentDelta) {
      yield { content: contentDelta };
    }
  }
}
