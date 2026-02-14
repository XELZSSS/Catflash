import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/chatService';
import { ChatMessage, Role } from '../types';
import { t } from '../utils/i18n';
import {
  appendThinkStreamChunk,
  createThinkStreamParserState,
  finalizeThinkStreamParserState,
} from '../utils/streaming';
import { formatMessageTime } from '../utils/time';

type UseStreamingMessagesOptions = {
  chatService: ChatService;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};
type MessageOverrides = Omit<Partial<ChatMessage>, 'role' | 'text'>;

export const useStreamingMessages = ({
  chatService,
  messages,
  setMessages,
}: UseStreamingMessagesOptions) => {
  type InputMode = 'chat' | 'image';
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const commitMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        return next;
      });
    },
    [setMessages]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth', force = false) => {
    if (!force && !messagesEndRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const updateMessageById = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      commitMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === messageId);
        if (index === -1) return prev;
        const current = prev[index];
        const nextMessage = { ...current, ...updates };
        if (
          nextMessage.text === current.text &&
          nextMessage.reasoning === current.reasoning &&
          nextMessage.isError === current.isError
        ) {
          return prev;
        }
        const next = [...prev];
        next[index] = nextMessage;
        return next;
      });
    },
    [commitMessages]
  );

  const buildMessage = useCallback(
    (role: Role, text: string, overrides: MessageOverrides = {}): ChatMessage => {
      const { id, timestamp, timeLabel, ...rest } = overrides;
      const resolvedTimestamp = timestamp ?? Date.now();
      return {
        id: id ?? uuidv4(),
        role,
        text,
        timestamp: resolvedTimestamp,
        timeLabel: timeLabel ?? formatMessageTime(resolvedTimestamp),
        ...rest,
      };
    },
    []
  );

  const syncHistory = useCallback(() => {
    void chatService.startChatWithHistory(messagesRef.current).catch((error) => {
      console.error('Failed to synchronize chat history:', error);
    });
  }, [chatService]);

  useEffect(() => {
    const behavior = isStreaming ? 'auto' : 'smooth';
    scrollToBottom(behavior);
  }, [messages, isStreaming, isLoading, scrollToBottom]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      stopRequestedRef.current = false;
      const modelMessageId = uuidv4();
      const userMessage = buildMessage(Role.User, text);

      commitMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setIsLoading(true);

      try {
        commitMessages((prev) => [
          ...prev,
          buildMessage(Role.Model, '', { id: modelMessageId }),
        ]);
        requestAnimationFrame(() => scrollToBottom('auto', true));

        let fullResponseClean = '';
        let fullResponseReasoning = '';
        let isFirstChunk = true;
        let pendingBuffer = '';
        let isFlushScheduled = false;
        let parserState = createThinkStreamParserState();

        const flushBufferedResponse = () => {
          isFlushScheduled = false;
          if (!pendingBuffer) return;
          parserState = appendThinkStreamChunk(parserState, pendingBuffer);
          const parsed = finalizeThinkStreamParserState(parserState);
          fullResponseClean = parsed.cleaned;
          fullResponseReasoning = parsed.reasoning;
          pendingBuffer = '';
          updateMessageById(modelMessageId, {
            text: fullResponseClean,
            reasoning: fullResponseReasoning || undefined,
          });
        };

        const scheduleFlush = () => {
          if (isFlushScheduled) return;
          isFlushScheduled = true;
          requestAnimationFrame(flushBufferedResponse);
        };

        for await (const chunk of chatService.sendMessageStream(text)) {
          if (stopRequestedRef.current) {
            break;
          }
          if (isFirstChunk) {
            setIsLoading(false);
            isFirstChunk = false;
          }

          pendingBuffer += chunk;
          scheduleFlush();
        }
        flushBufferedResponse();
        updateMessageById(modelMessageId, {
          text: fullResponseClean,
          reasoning: fullResponseReasoning || undefined,
        });
      } catch (error: unknown) {
        console.error('Chat error:', error);

        let friendlyError = t('error.generic');
        const rawMessage = error instanceof Error ? error.message : String(error);
        const rawLower = rawMessage.toLowerCase();

        if (rawLower.includes('api key') || rawLower.includes('403')) {
          friendlyError = t('error.auth');
        } else if (rawLower.includes('quota') || rawLower.includes('429')) {
          friendlyError = t('error.quota');
        } else if (rawLower.includes('safety') || rawLower.includes('blocked')) {
          friendlyError = t('error.safety');
        } else if (
          rawLower.includes('fetch') ||
          rawLower.includes('network') ||
          rawLower.includes('failed to fetch')
        ) {
          friendlyError = t('error.network');
        } else if (rawLower.includes('503') || rawLower.includes('overloaded')) {
          friendlyError = t('error.overloaded');
        }

        const finalMessageText = `**${friendlyError}**

**${t('error.troubleshooting')}**
1. ${t('error.step1')}
2. ${t('error.step2')}
3. ${t('error.step3')}

<details>
<summary>${t('error.technicalDetails')}</summary>

\`\`\`
${rawMessage}
\`\`\`
</details>`;

        const errorMessage = buildMessage(Role.Model, finalMessageText, { isError: true });
        commitMessages((prev) => {
          const index = prev.findIndex((msg) => msg.id === modelMessageId);
          if (index === -1) {
            return [...prev, errorMessage];
          }
          const next = [...prev];
          next[index] = {
            ...next[index],
            text: finalMessageText,
            reasoning: undefined,
            isError: true,
          };
          return next;
        });
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
        syncHistory();
      }
    },
    [buildMessage, chatService, commitMessages, scrollToBottom, syncHistory, updateMessageById]
  );

  const handleGenerateImage = useCallback(
    async (prompt: string) => {
      stopRequestedRef.current = false;
      const modelMessageId = uuidv4();
      const userMessage = buildMessage(Role.User, prompt);

      commitMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        commitMessages((prev) => [
          ...prev,
          buildMessage(Role.Model, '', { id: modelMessageId }),
        ]);
        requestAnimationFrame(() => scrollToBottom('auto', true));

        const result = await chatService.generateImage({ prompt });

        updateMessageById(modelMessageId, {
          text: result.revisedPrompt ?? '',
          imageUrl: result.imageUrl,
          imageDataUrl: result.imageDataUrl,
          imageAlt: prompt,
          isError: false,
        });
      } catch (error: unknown) {
        console.error('Image generation error:', error);
        const rawMessage = error instanceof Error ? error.message : String(error);
        const finalMessageText = `**${t('error.generic')}**\n\n${rawMessage}`;
        updateMessageById(modelMessageId, {
          text: finalMessageText,
          reasoning: undefined,
          isError: true,
        });
      } finally {
        setIsLoading(false);
        syncHistory();
      }
    },
    [buildMessage, chatService, commitMessages, scrollToBottom, syncHistory, updateMessageById]
  );

  const handleSendInput = useCallback(
    async (text: string, mode: InputMode) => {
      if (mode === 'image') {
        await handleGenerateImage(text);
        return;
      }
      await handleSendMessage(text);
    },
    [handleGenerateImage, handleSendMessage]
  );

  const stopStreaming = useCallback(() => {
    stopRequestedRef.current = true;
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  return {
    messagesEndRef,
    messagesContainerRef,
    isStreaming,
    isLoading,
    scrollToBottom,
    handleSendMessage: handleSendInput,
    stopStreaming,
  };
};
