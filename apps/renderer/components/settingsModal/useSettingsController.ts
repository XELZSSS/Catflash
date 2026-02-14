import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_TOOL_CALL_ROUNDS,
  MIN_TOOL_CALL_ROUNDS,
} from '../../services/providers/utils';
import { ObsidianMode, ObsidianReadMode, ObsidianWriteMode, TavilyConfig } from '../../types';
import { ActiveSettingsTab } from './reducer';
import { resolveBaseUrlForRegion } from './constants';
import { useObsidianTools } from './useObsidianTools';
import { useSettingsForm } from './useSettingsForm';
import { ProviderSettingsMap, SaveObsidianPayload, SaveSettingsPayload } from './types';
import { removeAppStorage, writeAppStorage } from '../../services/storageKeys';

type UseSettingsControllerOptions = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: SaveSettingsPayload) => void;
  onSaveObsidian: (value: SaveObsidianPayload) => void;
  providerSettings: ProviderSettingsMap;
} & Omit<Parameters<typeof useSettingsForm>[0], 'isOpen'>;

const normalizeToolCallRounds = (value: string): string => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return '';
  return String(Math.min(Math.max(parsed, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS));
};

const persistToolCallRounds = (value: string): void => {
  const parsed = Number.parseInt(value, 10);
  const normalized = Number.isNaN(parsed)
    ? null
    : Math.min(Math.max(parsed, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS);

  if (typeof window === 'undefined') return;
  if (normalized === null) {
    removeAppStorage('toolCallMaxRounds');
    return;
  }
  writeAppStorage('toolCallMaxRounds', String(normalized));
};

export const useSettingsController = ({
  isOpen,
  onClose,
  onSave,
  onSaveObsidian,
  ...formOptions
}: UseSettingsControllerOptions) => {
  const { state, dispatch, providerOptions, activeMeta, tabs, handleProviderChange } =
    useSettingsForm({
      isOpen,
      ...formOptions,
    });

  const overlayRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  const {
    obsidianNotePathRef,
    refreshObsidianNotes,
    handleTestObsidianApi,
    handleSearchObsidianNotes,
    handleObsidianSearchKeyDown,
  } = useObsidianTools({ state, dispatch, isOpen });

  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }
    setPortalContainer(overlayRef.current);
  }, [isOpen]);

  const handleSave = () => {
    persistToolCallRounds(state.toolCallMaxRounds);

    onSave({
      providerId: state.providerId,
      modelName: state.modelName,
      apiKey: state.apiKey,
      baseUrl: state.baseUrl,
      customHeaders: state.customHeaders,
      tavily: state.tavily,
      imageGeneration: state.imageGeneration,
    });

    onSaveObsidian({
      mode: state.obsidianMode,
      vaultPath: state.obsidianVaultPath.trim(),
      notePath: state.obsidianNotePath.trim(),
      apiUrl: state.obsidianApiUrl.trim(),
      apiKey: state.obsidianApiKey.trim(),
      readMode: state.obsidianReadMode,
      writeMode: state.obsidianWriteMode,
      writeHeading: state.obsidianWriteHeading.trim(),
      previewBeforeWrite: state.obsidianPreviewBeforeWrite,
    });
    onClose();
  };

  const providerActions = useMemo(
    () => ({
      onProviderChange: (nextProviderId: Parameters<typeof handleProviderChange>[0]) =>
        handleProviderChange(nextProviderId, formOptions.providerSettings),
      onModelNameChange: (value: string) =>
        dispatch({ type: 'patch', payload: { modelName: value } }),
      onApiKeyChange: (value: string) => dispatch({ type: 'patch', payload: { apiKey: value } }),
      onToggleApiKeyVisibility: () =>
        dispatch({ type: 'patch', payload: { showApiKey: !state.showApiKey } }),
      onClearApiKey: () => dispatch({ type: 'patch', payload: { apiKey: '' } }),
      onToolCallMaxRoundsChange: (value: string) =>
        dispatch({ type: 'patch', payload: { toolCallMaxRounds: value } }),
      onToolCallMaxRoundsBlur: () =>
        dispatch({
          type: 'patch',
          payload: { toolCallMaxRounds: normalizeToolCallRounds(state.toolCallMaxRounds) },
        }),
      onBaseUrlChange: (value: string) => dispatch({ type: 'patch', payload: { baseUrl: value } }),
      onAddCustomHeader: () => dispatch({ type: 'add_custom_header' }),
      onSetCustomHeaderKey: (index: number, value: string) =>
        dispatch({ type: 'set_custom_header_key', payload: { index, value } }),
      onSetCustomHeaderValue: (index: number, value: string) =>
        dispatch({ type: 'set_custom_header_value', payload: { index, value } }),
      onRemoveCustomHeader: (index: number) =>
        dispatch({ type: 'remove_custom_header', payload: { index } }),
      onSetRegionBaseUrl: (region: 'intl' | 'cn') =>
        dispatch({
          type: 'patch',
          payload: { baseUrl: resolveBaseUrlForRegion(state.providerId, region) },
        }),
      onSetImageSize: (value: string) =>
        dispatch({
          type: 'patch',
          payload: {
            imageGeneration: { ...state.imageGeneration, size: value.trim() || undefined },
          },
        }),
      onSetImageAspectRatio: (value: string) =>
        dispatch({
          type: 'patch',
          payload: {
            imageGeneration: { ...state.imageGeneration, aspectRatio: value.trim() || undefined },
          },
        }),
      onSetImageCount: (value: string) => {
        const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
        const count = Number.isNaN(parsed) ? undefined : Math.min(Math.max(parsed, 1), 4);
        dispatch({
          type: 'patch',
          payload: { imageGeneration: { ...state.imageGeneration, count } },
        });
      },
      onSetImageQuality: (value: string) =>
        dispatch({
          type: 'patch',
          payload: {
            imageGeneration: { ...state.imageGeneration, quality: value.trim() || undefined },
          },
        }),
      onSetImageSubjectReference: (value: string) =>
        dispatch({
          type: 'patch',
          payload: {
            imageGeneration: {
              ...state.imageGeneration,
              subjectReference: value.trim() || undefined,
            },
          },
        }),
    }),
    [
      dispatch,
      formOptions.providerSettings,
      handleProviderChange,
      state.providerId,
      state.showApiKey,
      state.toolCallMaxRounds,
      state.imageGeneration,
    ]
  );

  const searchActions = useMemo(
    () => ({
      onSetTavilyField: (key: keyof TavilyConfig, value: TavilyConfig[keyof TavilyConfig]) =>
        dispatch({
          type: 'set_tavily',
          payload: { key, value },
        }),
      onToggleTavilyKeyVisibility: () =>
        dispatch({ type: 'patch', payload: { showTavilyKey: !state.showTavilyKey } }),
    }),
    [dispatch, state.showTavilyKey]
  );

  const obsidianActions = useMemo(
    () => ({
      onModeChange: (value: ObsidianMode) =>
        dispatch({ type: 'patch', payload: { obsidianMode: value } }),
      onVaultPathChange: (value: string) =>
        dispatch({ type: 'patch', payload: { obsidianVaultPath: value } }),
      onNotePathChange: (value: string) =>
        dispatch({ type: 'patch', payload: { obsidianNotePath: value } }),
      onApiUrlChange: (value: string) =>
        dispatch({ type: 'patch', payload: { obsidianApiUrl: value } }),
      onApiKeyChange: (value: string) =>
        dispatch({ type: 'patch', payload: { obsidianApiKey: value } }),
      onReadModeChange: (value: ObsidianReadMode) =>
        dispatch({ type: 'patch', payload: { obsidianReadMode: value } }),
      onWriteModeChange: (value: ObsidianWriteMode) =>
        dispatch({ type: 'patch', payload: { obsidianWriteMode: value } }),
      onWriteHeadingChange: (value: string) =>
        dispatch({ type: 'patch', payload: { obsidianWriteHeading: value } }),
      onPreviewBeforeWriteChange: (value: boolean) =>
        dispatch({ type: 'patch', payload: { obsidianPreviewBeforeWrite: value } }),
      onSearchQueryChange: (value: string) =>
        dispatch({ type: 'patch', payload: { obsidianSearchQuery: value } }),
      onRefreshNotes: refreshObsidianNotes,
      onTestApi: handleTestObsidianApi,
      onSearch: handleSearchObsidianNotes,
      onSearchKeyDown: handleObsidianSearchKeyDown,
      onSelectSearchResult: (notePath: string) => {
        dispatch({
          type: 'patch',
          payload: { obsidianNotePath: notePath, obsidianSearchResults: [] },
        });
        requestAnimationFrame(() => obsidianNotePathRef.current?.focus());
      },
    }),
    [
      dispatch,
      handleObsidianSearchKeyDown,
      handleSearchObsidianNotes,
      handleTestObsidianApi,
      obsidianNotePathRef,
      refreshObsidianNotes,
    ]
  );

  return {
    state,
    tabs,
    overlayRef,
    portalContainer,
    providerOptions,
    activeMeta,
    obsidianNotePathRef,
    handleSave,
    onTabChange: (id: ActiveSettingsTab) => dispatch({ type: 'patch', payload: { activeTab: id } }),
    providerActions,
    searchActions,
    obsidianActions,
  };
};
