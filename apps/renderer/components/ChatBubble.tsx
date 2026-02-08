import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Link2 } from 'lucide-react';
import { Role, ChatMessage } from '../types';
import { t } from '../utils/i18n';
import { formatMessageTime } from '../utils/time';

interface ChatBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 h-6 px-1">
    <div className="w-1.5 h-1.5 bg-[var(--ink-3)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-1.5 h-1.5 bg-[var(--ink-3)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-1.5 h-1.5 bg-[var(--ink-3)] rounded-full animate-bounce"></div>
  </div>
);

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isStreaming = false }) => {
  const isUser = message.role === Role.User;
  const isError = message.isError;
  const hasText = message.text && message.text.length > 0;
  const imageSrc = message.imageDataUrl ?? message.imageUrl;
  const hasImage = Boolean(imageSrc);

  const reasoningText = !isUser ? (message.reasoning?.trim() ?? '') : '';
  const hasReasoning = reasoningText.length > 0;

  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const prevStreamingRef = useRef(isStreaming);
  const reasoningSeenRef = useRef(false);

  useEffect(() => {
    if (isStreaming && hasReasoning && !reasoningSeenRef.current) {
      setIsReasoningOpen(true);
      reasoningSeenRef.current = true;
    }

    if (prevStreamingRef.current && !isStreaming) {
      // Auto-hide after streaming completes, but allow manual re-open.
      setIsReasoningOpen(false);
      reasoningSeenRef.current = false;
    }

    prevStreamingRef.current = isStreaming;
  }, [isStreaming, hasReasoning]);

  const handleDownloadImage = async () => {
    if (!imageSrc) return;
    const filename = `catflash-image-${message.timestamp}.png`;
    const triggerDownload = (href: string) => {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    };

    if (imageSrc.startsWith('data:')) {
      triggerDownload(imageSrc);
      return;
    }

    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(imageSrc, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyImageLink = async () => {
    const copyValue = message.imageUrl ?? imageSrc;
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1400);
    } catch (error) {
      console.warn('Failed to copy image link:', error);
    }
  };

  return (
    <div className="flex w-full mb-8 justify-center fx-soft-rise">
      <div
        className={`flex min-w-0 w-full max-w-[min(64rem,100%)] gap-4 ${
          isUser ? 'justify-end flex-row pr-3' : 'justify-start flex-row'
        }`}
      >
        {/* Message Content */}
        <div
          className={`flex min-w-0 flex-col w-full max-w-[min(52rem,100%)] ${
            isUser ? 'items-end max-w-[min(38rem,100%)]' : 'items-start'
          }`}
        >
          <div
            className={`py-1 ${
              isUser
                ? 'text-[var(--ink-1)]'
                : isError
                  ? 'px-4 py-3 rounded-2xl bg-red-900/10 border border-red-900/30 text-red-100 rounded-tl-sm'
                  : 'text-[var(--ink-2)]'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                {message.text}
              </p>
            ) : (
              <div className="min-w-0">
                {hasReasoning && (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => setIsReasoningOpen((prev) => !prev)}
                      className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
                    >
                      {isStreaming ? t('reasoning.streaming') : t('reasoning.title')}{' '}
                      {isReasoningOpen ? t('reasoning.collapse') : t('reasoning.expand')}
                    </button>
                  </div>
                )}

                {hasReasoning && isReasoningOpen && (
                  <div className="mb-3 w-fit max-w-[min(40rem,100%)] rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--ink-3)]">
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {reasoningText}
                    </p>
                  </div>
                )}

                {!hasText && isStreaming && <TypingIndicator />}
                {hasImage && (
                  <div className="mb-3">
                    <img
                      src={imageSrc}
                      alt={message.imageAlt ?? 'Generated image'}
                      className="max-w-full w-auto h-auto max-h-[22rem] rounded-xl border border-[var(--line-1)]"
                      loading="lazy"
                    />
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleDownloadImage}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--line-1)] px-2 py-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
                        title={t('image.action.download')}
                      >
                        <Download size={14} />
                        {t('image.action.download')}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyImageLink}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--line-1)] px-2 py-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
                        title={t('image.action.copyLink')}
                      >
                        {isCopied ? <Check size={14} /> : <Link2 size={14} />}
                        {isCopied ? t('image.action.copied') : t('image.action.copyLink')}
                      </button>
                    </div>
                  </div>
                )}
                {hasText && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed text-sm text-[var(--ink-2)]">
                    {message.text}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-[10px] text-[var(--ink-3)]">
              {message.timeLabel ?? formatMessageTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatBubble);
