import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, StopCircle } from 'lucide-react';
import { t } from '../utils/i18n';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  containerClassName?: string;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleSearch: () => void;
}

const DRAFT_STORAGE_KEY = 'gemini_chat_input_draft';

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  isStreaming,
  onStop: _onStop,
  containerClassName,
  searchEnabled,
  searchAvailable,
  onToggleSearch,
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftSaveTimerRef = useRef<number | null>(null);

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
    return () => {
      if (draftSaveTimerRef.current !== null) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
    };
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
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, newValue);
      } catch (error) {
        console.warn('Failed to save draft to storage:', error);
      }
      draftSaveTimerRef.current = null;
    }, 350);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || (disabled && !isStreaming)) return;

    if (isStreaming) {
      _onStop();
      return;
    }

    onSend(input);
    setInput('');
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
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

  return (
    <div className={`mx-auto w-full max-w-[min(64rem,100%)] px-4 pb-6 ${containerClassName ?? ''}`}>
      <div className="relative flex items-end gap-2 bg-[var(--bg-2)] [background-image:none] border border-[var(--line-1)] rounded-[var(--radius-2)] p-2 shadow-none transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent [background-image:none] shadow-none text-[var(--ink-1)] placeholder-[var(--ink-3)] text-sm p-3 max-h-[150px] resize-none focus:outline-none scrollbar-hide"
          rows={1}
          disabled={disabled && !isStreaming}
        />
        <div className="pb-1 pr-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSearch}
            disabled={!searchAvailable || (disabled && !isStreaming)}
            aria-pressed={searchEnabled}
            title={searchEnabled ? t('input.search.disable') : t('input.search.enable')}
            className={`h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center ring-1 ${
              searchEnabled
                ? 'bg-white/10 text-[var(--ink-1)] ring-[var(--line-1)]'
                : 'bg-[var(--bg-2)] text-[var(--ink-3)] ring-[var(--line-1)]'
            } ${
              searchAvailable && !(disabled && !isStreaming)
                ? 'hover:bg-white/5 hover:text-[var(--ink-1)]'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => {
              if (isStreaming) {
                _onStop();
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
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
