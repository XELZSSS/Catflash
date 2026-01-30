import { useEffect, useState } from 'react';
import { ChatService } from '../services/chatService';

const SEARCH_ENABLED_KEY = 'gemini_chat_search_enabled';

type UseSearchToggleOptions = {
  chatService: ChatService;
  tavilyAvailable: boolean;
  currentProviderId: string;
};

export const useSearchToggle = ({
  chatService,
  tavilyAvailable,
  currentProviderId,
}: UseSearchToggleOptions) => {
  const [searchEnabled, setSearchEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem(SEARCH_ENABLED_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      console.warn('Failed to load search toggle from storage:', error);
    }
    return true;
  });

  useEffect(() => {
    if (!tavilyAvailable) {
      setSearchEnabled(false);
      chatService.setSearchEnabled(false);
      return;
    }
    chatService.setSearchEnabled(searchEnabled);
    try {
      window.localStorage.setItem(SEARCH_ENABLED_KEY, String(searchEnabled));
    } catch (error) {
      console.warn('Failed to persist search toggle:', error);
    }
  }, [tavilyAvailable, searchEnabled, currentProviderId, chatService]);

  return { searchEnabled, setSearchEnabled };
};
