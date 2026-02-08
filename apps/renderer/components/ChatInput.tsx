import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, StopCircle, BookOpen, PenLine, ImagePlus } from 'lucide-react';
import { t } from '../utils/i18n';
import { IconButton } from './ui';

interface ChatInputProps {
  onSend: (message: string, mode: 'chat' | 'image') => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  containerClassName?: string;
  inputMode: 'chat' | 'image';
  onToggleInputMode: () => void;
  imageGenerationAvailable: boolean;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleSearch: () => void;
  onReadObsidian?: () => void;
  onWriteObsidian?: () => void;
  obsidianReadDisabled?: boolean;
  obsidianWriteDisabled?: boolean;
}

const DRAFT_STORAGE_KEY = 'gemini_chat_input_draft';

const ChatInputComponent: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  isStreaming,
  onStop,
  containerClassName,
  inputMode,
  onToggleInputMode,
  imageGenerationAvailable,
  searchEnabled,
  searchAvailable,
  onToggleSearch,
  onReadObsidian,
  onWriteObsidian,
  obsidianReadDisabled,
  obsidianWriteDisabled,
}) => {
  const [input, setInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftSaveTimerRef = useRef<number | null>(null);

  const clearDraftTimer = () => {
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        setInput(savedDraft);
      }
    } catch (error) {
      console.warn('Failed to load draft from storage:', error);
    }
  }, []);

  useEffect(() => {
    return () => clearDraftTimer();
  }, []);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      document.documentElement.style.setProperty(
        '--chat-input-height',
        `${containerRef.current.offsetHeight}px`
      );
    });
  }, [input]);

  useEffect(() => {
    const updateHeight = () => {
      if (!containerRef.current) return;
      document.documentElement.style.setProperty(
        '--chat-input-height',
        `${containerRef.current.offsetHeight}px`
      );
    };
    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    clearDraftTimer();
    draftSaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, newValue);
      } catch (error) {
        console.warn('Failed to save draft to storage:', error);
      }
      clearDraftTimer();
    }, 350);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || (disabled && !isStreaming)) return;

    if (isStreaming) {
      onStop();
      return;
    }

    onSend(input, inputMode);
    setInput('');
    clearDraftTimer();
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear draft from storage:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const obsidianButtonClass = (enabled: boolean) =>
    `h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center ring-1 ${
      enabled
        ? 'bg-[var(--bg-2)] text-[var(--ink-3)] ring-[var(--line-1)] hover:bg-white/5 hover:text-[var(--ink-1)]'
        : 'bg-[var(--bg-2)] text-[var(--ink-3)] ring-[var(--line-1)] opacity-50 cursor-not-allowed'
    }`;

  return (
    <div
      ref={containerRef}
      className={`mx-auto w-full max-w-[min(64rem,100%)] px-4 pb-6 ${containerClassName ?? ''}`}
    >
      <div className="relative flex items-end gap-2 bg-[var(--bg-2)] [background-image:none] border border-[var(--line-1)] rounded-[var(--radius-2)] p-2 shadow-none transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            inputMode === 'image' ? t('input.placeholder.image') : t('input.placeholder.chat')
          }
          className="w-full bg-transparent [background-image:none] shadow-none text-[var(--ink-1)] placeholder-[var(--ink-3)] text-sm p-3 max-h-[150px] resize-none focus:outline-none scrollbar-hide"
          rows={1}
          disabled={disabled && !isStreaming}
        />
        <div className="pb-1 pr-1 flex items-center gap-2">
          <IconButton
            onClick={onToggleInputMode}
            disabled={!imageGenerationAvailable || (disabled && !isStreaming)}
            aria-pressed={inputMode === 'image'}
            title={inputMode === 'image' ? t('input.mode.chat') : t('input.mode.image')}
            className={`h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center ring-1 ${
              inputMode === 'image'
                ? 'bg-white/10 text-[var(--ink-1)] ring-[var(--line-1)]'
                : 'bg-[var(--bg-2)] text-[var(--ink-3)] ring-[var(--line-1)]'
            } ${
              imageGenerationAvailable && !(disabled && !isStreaming)
                ? 'hover:bg-white/5 hover:text-[var(--ink-1)]'
                : 'opacity-50 cursor-not-allowed'
            }`}
            active={inputMode === 'image'}
          >
            <ImagePlus size={18} />
          </IconButton>
          {onReadObsidian && (
            <IconButton
              onClick={onReadObsidian}
              disabled={obsidianReadDisabled || (disabled && !isStreaming)}
              title={t('obsidian.action.read')}
              className={obsidianButtonClass(!obsidianReadDisabled && !(disabled && !isStreaming))}
            >
              <BookOpen size={18} />
            </IconButton>
          )}
          {onWriteObsidian && (
            <IconButton
              onClick={onWriteObsidian}
              disabled={obsidianWriteDisabled || (disabled && !isStreaming)}
              title={t('obsidian.action.write')}
              className={obsidianButtonClass(!obsidianWriteDisabled && !(disabled && !isStreaming))}
            >
              <PenLine size={18} />
            </IconButton>
          )}
          <IconButton
            onClick={onToggleSearch}
            disabled={!searchAvailable || inputMode === 'image' || (disabled && !isStreaming)}
            aria-pressed={searchEnabled}
            title={searchEnabled ? t('input.search.disable') : t('input.search.enable')}
            className={`h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center ring-1 ${
              searchEnabled
                ? 'bg-white/10 text-[var(--ink-1)] ring-[var(--line-1)]'
                : 'bg-[var(--bg-2)] text-[var(--ink-3)] ring-[var(--line-1)]'
            } ${
              searchAvailable && inputMode !== 'image' && !(disabled && !isStreaming)
                ? 'hover:bg-white/5 hover:text-[var(--ink-1)]'
                : 'opacity-50 cursor-not-allowed'
            }`}
            active={searchEnabled}
          >
            <Search size={18} />
          </IconButton>
          <IconButton
            onClick={() => {
              if (isStreaming) {
                onStop();
                return;
              }
              handleSubmit();
            }}
            disabled={(!input.trim() && !isStreaming) || (disabled && !isStreaming)}
            className={`h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center ${
              input.trim() || isStreaming
                ? 'bg-[var(--accent)] text-[#1a1a1a] hover:bg-[var(--accent-strong)]'
                : 'bg-[var(--bg-2)] text-[var(--ink-3)] cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <div className="animate-pulse">
                <StopCircle size={18} />
              </div>
            ) : (
              <Send size={18} />
            )}
          </IconButton>
        </div>
      </div>
    </div>
  );
};

const ChatInput = React.memo(ChatInputComponent);
export default ChatInput;
