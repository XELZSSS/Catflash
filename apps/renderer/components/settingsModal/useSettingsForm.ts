import { useEffect, useMemo, useReducer } from 'react';
import { getProviderDefaultModel, listProviderIds } from '../../services/providers/registry';
import {
  DEFAULT_MAX_TOOL_CALL_ROUNDS,
} from '../../services/providers/utils';
import { ProviderId, TavilyConfig } from '../../types';
import { t } from '../../utils/i18n';
import { providerMeta, resolveBaseUrlForProvider } from './constants';
import { ActiveSettingsTab, settingsModalReducer, SettingsModalState } from './reducer';
import { ProviderSettingsMap } from './types';
import { ImageGenerationConfig } from '../../services/providers/types';
import { readAppStorage, writeAppStorage } from '../../services/storageKeys';

const getStoredToolRounds = () => {
  if (typeof window === 'undefined') return String(DEFAULT_MAX_TOOL_CALL_ROUNDS);
  return readAppStorage('toolCallMaxRounds') ?? String(DEFAULT_MAX_TOOL_CALL_ROUNDS);
};

const getStoredActiveTab = (): ActiveSettingsTab => {
  if (typeof window === 'undefined') return 'provider';
  const stored = readAppStorage('settingsActiveTab');
  if (stored === 'provider' || stored === 'search' || stored === 'obsidian' || stored === 'image')
    return stored;
  return 'provider';
};

type BuildStateInput = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  imageGeneration?: ImageGenerationConfig;
  obsidianSettings: import('../../types').ObsidianSettings;
};

const buildStateFromInput = (input: BuildStateInput): SettingsModalState => ({
  providerId: input.providerId,
  modelName: input.modelName,
  apiKey: input.apiKey,
  baseUrl: resolveBaseUrlForProvider(input.providerId, input.baseUrl),
  customHeaders: input.customHeaders ?? [],
  tavily: input.tavily ?? {},
  imageGeneration: input.imageGeneration ?? {},
  showApiKey: false,
  showTavilyKey: false,
  obsidianMode: input.obsidianSettings.mode,
  obsidianVaultPath: input.obsidianSettings.vaultPath ?? '',
  obsidianNotePath: input.obsidianSettings.notePath ?? '',
  obsidianApiUrl: input.obsidianSettings.apiUrl ?? '',
  obsidianApiKey: input.obsidianSettings.apiKey ?? '',
  obsidianReadMode: input.obsidianSettings.readMode,
  obsidianWriteMode: input.obsidianSettings.writeMode,
  obsidianWriteHeading: input.obsidianSettings.writeHeading ?? '',
  obsidianPreviewBeforeWrite: input.obsidianSettings.previewBeforeWrite,
  obsidianNotes: [],
  obsidianNotesLoading: false,
  obsidianTesting: false,
  obsidianTestStatus: 'idle',
  obsidianSearchQuery: '',
  obsidianSearchResults: [],
  obsidianSearchLoading: false,
  toolCallMaxRounds: getStoredToolRounds(),
  activeTab: getStoredActiveTab(),
});

type UseSettingsFormOptions = BuildStateInput & {
  isOpen: boolean;
};

export const useSettingsForm = ({
  isOpen,
  providerId,
  modelName,
  apiKey,
  baseUrl,
  customHeaders,
  tavily,
  imageGeneration,
  obsidianSettings,
}: UseSettingsFormOptions) => {
  const obsidianMode = obsidianSettings.mode;
  const obsidianVaultPath = obsidianSettings.vaultPath;
  const obsidianNotePath = obsidianSettings.notePath;
  const obsidianApiUrl = obsidianSettings.apiUrl;
  const obsidianApiKey = obsidianSettings.apiKey;
  const obsidianReadMode = obsidianSettings.readMode;
  const obsidianWriteMode = obsidianSettings.writeMode;
  const obsidianWriteHeading = obsidianSettings.writeHeading;
  const obsidianPreviewBeforeWrite = obsidianSettings.previewBeforeWrite;

  const stateSeed = useMemo(
    () =>
      buildStateFromInput({
        providerId,
        modelName,
        apiKey,
        baseUrl,
        customHeaders: customHeaders ?? [],
        tavily: tavily ?? {},
        imageGeneration: imageGeneration ?? {},
        obsidianSettings: {
          mode: obsidianMode,
          vaultPath: obsidianVaultPath,
          notePath: obsidianNotePath,
          apiUrl: obsidianApiUrl,
          apiKey: obsidianApiKey,
          readMode: obsidianReadMode,
          writeMode: obsidianWriteMode,
          writeHeading: obsidianWriteHeading,
          previewBeforeWrite: obsidianPreviewBeforeWrite,
        },
      }),
    [
      apiKey,
      baseUrl,
      modelName,
      obsidianApiKey,
      obsidianApiUrl,
      obsidianMode,
      obsidianNotePath,
      obsidianPreviewBeforeWrite,
      obsidianReadMode,
      obsidianVaultPath,
      obsidianWriteHeading,
      obsidianWriteMode,
      providerId,
      customHeaders,
      tavily,
      imageGeneration,
    ]
  );

  const [state, dispatch] = useReducer(settingsModalReducer, stateSeed);

  useEffect(() => {
    if (!isOpen) return;
    dispatch({ type: 'replace', payload: stateSeed });
  }, [isOpen, stateSeed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeAppStorage('settingsActiveTab', state.activeTab);
  }, [state.activeTab]);

  useEffect(() => {
    if (state.obsidianMode === 'plugin' && state.obsidianReadMode === 'recent') {
      dispatch({ type: 'patch', payload: { obsidianReadMode: 'active' } });
    }
  }, [state.obsidianMode, state.obsidianReadMode]);

  const providerOptions = useMemo(
    () =>
      listProviderIds().map((id) => ({
        value: id,
        label: providerMeta[id]?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
      })),
    []
  );

  const activeMeta = providerMeta[state.providerId];
  const providerTabLabel = t('settings.modal.tab.model');
  const searchTabLabel = t('settings.modal.tab.search');
  const obsidianTabLabel = t('settings.modal.tab.obsidian');
  const imageTabLabel = t('settings.modal.tab.image');
  const tabs = useMemo(
    () =>
      [
        { id: 'provider' as const, label: providerTabLabel, visible: true },
        {
          id: 'search' as const,
          label: searchTabLabel,
          visible: !!activeMeta?.supportsTavily,
        },
        { id: 'obsidian' as const, label: obsidianTabLabel, visible: true },
        {
          id: 'image' as const,
          label: imageTabLabel,
          visible: !!activeMeta?.supportsImageGeneration,
        },
      ].filter((tab) => tab.visible),
    [activeMeta, imageTabLabel, obsidianTabLabel, providerTabLabel, searchTabLabel]
  );

  useEffect(() => {
    if (tabs.some((tab) => tab.id === state.activeTab)) return;
    dispatch({ type: 'patch', payload: { activeTab: 'provider' } });
  }, [state.activeTab, tabs]);

  const handleProviderChange = (
    nextProviderId: ProviderId,
    providerSettings: ProviderSettingsMap
  ) => {
    const nextSettings = providerSettings[nextProviderId];
    dispatch({
      type: 'patch',
      payload: {
        providerId: nextProviderId,
        modelName: nextSettings?.modelName ?? getProviderDefaultModel(nextProviderId),
        apiKey: nextSettings?.apiKey ?? '',
        baseUrl: resolveBaseUrlForProvider(nextProviderId, nextSettings?.baseUrl),
        customHeaders: nextSettings?.customHeaders ?? [],
        tavily: nextSettings?.tavily ?? {},
        imageGeneration: nextSettings?.imageGeneration ?? {},
      },
    });
  };

  return {
    state,
    dispatch,
    providerOptions,
    activeMeta,
    tabs,
    handleProviderChange,
  };
};
