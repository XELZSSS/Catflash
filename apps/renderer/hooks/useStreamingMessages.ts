import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/chatService';
import { ChatMessage, Role } from '../types';
import { t } from '../utils/i18n';
import { parseThinkTags } from '../utils/streaming';
import { formatMessageTime } from '../utils/time';

type UseStreamingMessagesOptions = {
  chatService: ChatService;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export const useStreamingMessages = ({
  chatService,
  messages,
  setMessages,
}: UseStreamingMessagesOptions) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
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
      setMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === messageId);
        if (index === -1) return prev;
        const current = prev[index];
        const nextMessage = { ...current, ...updates };
        if (nextMessage.text === current.text && nextMessage.reasoning === current.reasoning) {
          return prev;
        }
        const next = [...prev];
        next[index] = nextMessage;
        return next;
      });
    },
    [setMessages]
  );

  useEffect(() => {
    const behavior = isStreaming ? 'auto' : 'smooth';
    scrollToBottom(behavior);
  }, [messages, isStreaming, isLoading, scrollToBottom]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      stopRequestedRef.current = false;

      const userTimestamp = Date.now();
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: Role.User,
        text: text,
        timestamp: userTimestamp,
        timeLabel: formatMessageTime(userTimestamp),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setIsLoading(true);

      try {
        const modelMessageId = uuidv4();

        const modelTimestamp = Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: modelMessageId,
            role: Role.Model,
            text: '',
            timestamp: modelTimestamp,
            timeLabel: formatMessageTime(modelTimestamp),
          },
        ]);
        requestAnimationFrame(() => scrollToBottom('auto', true));

        let fullResponseRaw = '';
        let fullResponseClean = '';
        let fullResponseReasoning = '';
        let isFirstChunk = true;
        let pendingBuffer = '';
        let isFlushScheduled = false;

        const flushBufferedResponse = () => {
          isFlushScheduled = false;
          if (!pendingBuffer) return;
          fullResponseRaw += pendingBuffer;
          const parsed = parseThinkTags(fullResponseRaw);
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

        const errorTimestamp = Date.now();
        const errorMessage: ChatMessage = {
          id: uuidv4(),
          role: Role.Model,
          text: finalMessageText,
          timestamp: errorTimestamp,
          timeLabel: formatMessageTime(errorTimestamp),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [chatService, scrollToBottom, setMessages, updateMessageById]
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
    handleSendMessage,
    stopStreaming,
  };
};
