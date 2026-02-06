import { Dispatch, SetStateAction, useCallback } from 'react';
import { ChatService } from '../services/chatService';
import { ObsidianSettings, ProviderId, TavilyConfig } from '../types';
import { Language, setLanguage, t } from '../utils/i18n';
import { saveObsidianSettings } from '../utils/obsidian';

type ProviderSettingsState = Record<
  ProviderId,
  {
    apiKey?: string;
    modelName: string;
    baseUrl?: string;
    customHeaders?: Array<{ key: string; value: string }>;
    tavily?: TavilyConfig;
  }
>;

type SaveSettingsPayload = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
};

type UseAppSettingsOptions = {
  chatService: ChatService;
  providerSettings: ProviderSettingsState;
  currentProviderId: ProviderId;
  setProviderSettings: Dispatch<SetStateAction<ProviderSettingsState>>;
  setCurrentProviderId: Dispatch<SetStateAction<ProviderId>>;
  setCurrentModelName: Dispatch<SetStateAction<string>>;
  setCurrentApiKey: Dispatch<SetStateAction<string>>;
  setObsidianSettings: Dispatch<SetStateAction<ObsidianSettings>>;
  setLanguageState: Dispatch<SetStateAction<Language>>;
  startNewChat: () => void;
};

export const useAppSettings = ({
  chatService,
  providerSettings,
  currentProviderId,
  setProviderSettings,
  setCurrentProviderId,
  setCurrentModelName,
  setCurrentApiKey,
  setObsidianSettings,
  setLanguageState,
  startNewChat,
}: UseAppSettingsOptions) => {
  const syncTrayLabels = useCallback((language: Language) => {
    window.gero?.setTrayLanguage?.(language);
    window.gero?.setTrayLabels?.({
      open: t('tray.open'),
      hide: t('tray.hide'),
      toggleDevTools: t('tray.toggleDevTools'),
      quit: t('tray.quit'),
    });
  }, []);

  const handleSaveSettings = useCallback(
    (value: SaveSettingsPayload) => {
      chatService.setProvider(value.providerId);
      const updatedSettings = chatService.updateProviderSettings(value.providerId, {
        apiKey: value.apiKey,
        modelName: value.modelName,
        baseUrl: value.baseUrl,
        customHeaders: value.customHeaders,
        tavily: value.tavily,
      });
      setProviderSettings(chatService.getAllProviderSettings());
      setCurrentProviderId(value.providerId);
      setCurrentModelName(updatedSettings.modelName);
      setCurrentApiKey(updatedSettings.apiKey ?? '');
      const prev = providerSettings[value.providerId];
      const shouldRestart =
        value.providerId !== currentProviderId ||
        !prev ||
        prev.modelName !== updatedSettings.modelName ||
        (prev.apiKey ?? '') !== (updatedSettings.apiKey ?? '') ||
        (prev.baseUrl ?? '') !== (updatedSettings.baseUrl ?? '') ||
        JSON.stringify(prev.customHeaders ?? []) !==
          JSON.stringify(updatedSettings.customHeaders ?? []) ||
        JSON.stringify(prev.tavily ?? {}) !== JSON.stringify(updatedSettings.tavily ?? {});
      if (shouldRestart) {
        startNewChat();
      }
    },
    [
      chatService,
      currentProviderId,
      providerSettings,
      setCurrentApiKey,
      setCurrentModelName,
      setCurrentProviderId,
      setProviderSettings,
      startNewChat,
    ]
  );

  const handleSaveObsidian = useCallback(
    (value: ObsidianSettings) => {
      setObsidianSettings(value);
      saveObsidianSettings(value);
    },
    [setObsidianSettings]
  );

  const handleLanguageChange = useCallback(
    (nextLanguage: Language) => {
      setLanguage(nextLanguage);
      setLanguageState(nextLanguage);
      syncTrayLabels(nextLanguage);
    },
    [setLanguageState, syncTrayLabels]
  );

  return {
    syncTrayLabels,
    handleSaveSettings,
    handleSaveObsidian,
    handleLanguageChange,
  };
};
