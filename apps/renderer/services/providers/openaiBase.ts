import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { buildSystemInstruction } from './prompts';
import { callTavilySearch } from './tavily';
import { TavilyToolArgs } from './openaiChatHelpers';

type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type ToolMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

export abstract class OpenAIStyleProviderBase {
  protected history: ChatMessage[] = [];

  protected buildMessages(
    nextHistory: ChatMessage[],
    providerId: ProviderId,
    modelName: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const systemInstruction = buildSystemInstruction(providerId, modelName);
    return [
      { role: 'system', content: systemInstruction },
      ...nextHistory
        .filter((msg) => !msg.isError)
        .map((msg) => ({
          role: msg.role === Role.User ? ('user' as const) : ('assistant' as const),
          content: msg.text,
        })),
    ];
  }

  resetChat(): void {
    this.history = [];
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    this.history = messages.filter((msg) => !msg.isError);
  }

  protected async buildToolMessages(
    toolCalls: ToolCall[],
    tavilyConfig?: TavilyConfig
  ): Promise<ToolMessage[]> {
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
        let args: TavilyToolArgs = {};
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
          const result = await callTavilySearch(tavilyConfig, args);
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

    return toolResults.map((result) => ({
      role: 'tool' as const,
      tool_call_id: result.tool_call_id,
      content: result.content,
    }));
  }
}
