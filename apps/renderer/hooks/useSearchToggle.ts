import { useEffect, useState } from 'react';
import { ChatService } from '../services/chatService';
import { readAppStorage, writeAppStorage } from '../services/storageKeys';

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
  const [searchEnabled, setSearchEnabled] = useState(() => readAppStorage('searchEnabled') !== 'false');

  useEffect(() => {
    if (!tavilyAvailable) {
      if (searchEnabled) {
        setSearchEnabled(false);
      }
      chatService.setSearchEnabled(false);
      writeAppStorage('searchEnabled', 'false');
      return;
    }
    chatService.setSearchEnabled(searchEnabled);
    writeAppStorage('searchEnabled', String(searchEnabled));
  }, [chatService, currentProviderId, searchEnabled, tavilyAvailable]);

  return { searchEnabled, setSearchEnabled };
};
