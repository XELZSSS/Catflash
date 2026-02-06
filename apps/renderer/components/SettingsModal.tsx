import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Save, X } from 'lucide-react';
import { ProviderId } from '../types';
import { t } from '../utils/i18n';
import { getProviderDefaultModel, listProviderIds } from '../services/providers/registry';
import {
  DEFAULT_MAX_TOOL_CALL_ROUNDS,
  MAX_TOOL_CALL_ROUNDS,
  MIN_TOOL_CALL_ROUNDS,
  TOOL_CALL_MAX_ROUNDS_STORAGE_KEY,
} from '../services/providers/utils';
import ProviderTab from './settingsModal/ProviderTab';
import SearchTab from './settingsModal/SearchTab';
import ObsidianTab from './settingsModal/ObsidianTab';
import { providerMeta, resolveBaseUrlForProvider, resolveBaseUrlForRegion } from './settingsModal/constants';
import { ActiveSettingsTab, settingsModalReducer, SettingsModalState } from './settingsModal/reducer';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerSettings: Record<
    ProviderId,
    {
      apiKey?: string;
      modelName: string;
      baseUrl?: string;
      customHeaders?: Array<{ key: string; value: string }>;
      tavily?: import('../types').TavilyConfig;
    }
  >;
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: import('../types').TavilyConfig;
  obsidianSettings: import('../types').ObsidianSettings;
  onSave: (value: {
    providerId: ProviderId;
    modelName: string;
    apiKey: string;
    baseUrl?: string;
    customHeaders?: Array<{ key: string; value: string }>;
    tavily?: import('../types').TavilyConfig;
  }) => void;
  onSaveObsidian: (value: import('../types').ObsidianSettings) => void;
}

const ACTIVE_TAB_STORAGE_KEY = 'gemini_settings_active_tab';

const getStoredToolRounds = () => {
  if (typeof window === 'undefined') return String(DEFAULT_MAX_TOOL_CALL_ROUNDS);
  return window.localStorage.getItem(TOOL_CALL_MAX_ROUNDS_STORAGE_KEY) ?? String(DEFAULT_MAX_TOOL_CALL_ROUNDS);
};

const getStoredActiveTab = (): ActiveSettingsTab => {
  if (typeof window === 'undefined') return 'provider';
  const stored = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  if (stored === 'provider' || stored === 'search' || stored === 'obsidian') return stored;
  return 'provider';
};

const buildStateFromProps = (props: SettingsModalProps): SettingsModalState => ({
  providerId: props.providerId,
  modelName: props.modelName,
  apiKey: props.apiKey,
  baseUrl: resolveBaseUrlForProvider(props.providerId, props.baseUrl),
  customHeaders: props.customHeaders ?? [],
  tavily: props.tavily ?? {},
  showApiKey: false,
  showTavilyKey: false,
  obsidianMode: props.obsidianSettings.mode,
  obsidianVaultPath: props.obsidianSettings.vaultPath ?? '',
  obsidianNotePath: props.obsidianSettings.notePath ?? '',
  obsidianApiUrl: props.obsidianSettings.apiUrl ?? '',
  obsidianApiKey: props.obsidianSettings.apiKey ?? '',
  obsidianReadMode: props.obsidianSettings.readMode,
  obsidianWriteMode: props.obsidianSettings.writeMode,
  obsidianWriteHeading: props.obsidianSettings.writeHeading ?? '',
  obsidianPreviewBeforeWrite: props.obsidianSettings.previewBeforeWrite,
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

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { isOpen, onClose, providerSettings, onSave, onSaveObsidian } = props;
  const [state, dispatch] = useReducer(settingsModalReducer, props, buildStateFromProps);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const obsidianNotePathRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    dispatch({ type: 'replace', payload: buildStateFromProps(props) });
  }, [isOpen, props]);

  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }
    setPortalContainer(overlayRef.current);
  }, [isOpen]);

  const providerOptions = useMemo(
    () =>
      listProviderIds().map((id) => ({
        value: id,
        label: providerMeta[id]?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
      })),
    []
  );

  const activeMeta = providerMeta[state.providerId];
  const tabs = useMemo(
    () =>
      [
        { id: 'provider' as const, label: t('settings.modal.tab.model'), visible: true },
        { id: 'search' as const, label: t('settings.modal.tab.search'), visible: !!activeMeta?.supportsTavily },
        { id: 'obsidian' as const, label: t('settings.modal.tab.obsidian'), visible: true },
      ].filter((tab) => tab.visible),
    [activeMeta]
  );

  useEffect(() => {
    if (tabs.some((tab) => tab.id === state.activeTab)) return;
    dispatch({ type: 'patch', payload: { activeTab: 'provider' } });
  }, [state.activeTab, tabs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, state.activeTab);
    } catch (error) {
      console.warn('Failed to persist settings tab:', error);
    }
  }, [state.activeTab]);

  useEffect(() => {
    if (state.obsidianMode === 'plugin' && state.obsidianReadMode === 'recent') {
      dispatch({ type: 'patch', payload: { obsidianReadMode: 'active' } });
    }
  }, [state.obsidianMode, state.obsidianReadMode]);

  const refreshObsidianNotes = useCallback(async () => {
    if (state.obsidianMode !== 'vault' || !state.obsidianVaultPath || !window.gero?.obsidian?.listMarkdown) {
      dispatch({ type: 'patch', payload: { obsidianNotes: [] } });
      return;
    }
    dispatch({ type: 'patch', payload: { obsidianNotesLoading: true } });
    try {
      const notes = await window.gero.obsidian.listMarkdown(state.obsidianVaultPath);
      dispatch({ type: 'patch', payload: { obsidianNotes: notes ?? [] } });
    } catch (error) {
      console.error('Failed to load Obsidian notes:', error);
      dispatch({ type: 'patch', payload: { obsidianNotes: [] } });
    } finally {
      dispatch({ type: 'patch', payload: { obsidianNotesLoading: false } });
    }
  }, [state.obsidianMode, state.obsidianVaultPath]);

  useEffect(() => {
    if (!isOpen) return;
    refreshObsidianNotes();
  }, [isOpen, refreshObsidianNotes]);

  const handleProviderChange = (nextProviderId: ProviderId) => {
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
      },
    });
  };

  const handleTestObsidianApi = useCallback(async () => {
    if (!state.obsidianApiUrl) return;
    dispatch({ type: 'patch', payload: { obsidianTesting: true, obsidianTestStatus: 'idle' } });
    try {
      const response = await fetch(`${state.obsidianApiUrl.replace(/\/+$/, '')}/`, {
        headers: state.obsidianApiKey ? { Authorization: `Bearer ${state.obsidianApiKey}` } : undefined,
      });
      dispatch({ type: 'patch', payload: { obsidianTestStatus: response.ok ? 'ok' : 'fail' } });
    } catch (error) {
      console.error('Failed to test Obsidian API:', error);
      dispatch({ type: 'patch', payload: { obsidianTestStatus: 'fail' } });
    } finally {
      dispatch({ type: 'patch', payload: { obsidianTesting: false } });
    }
  }, [state.obsidianApiKey, state.obsidianApiUrl]);

  const handleSearchObsidianNotes = useCallback(async () => {
    if (!state.obsidianApiUrl || !state.obsidianSearchQuery.trim()) {
      dispatch({ type: 'patch', payload: { obsidianSearchResults: [] } });
      return;
    }
    dispatch({ type: 'patch', payload: { obsidianSearchLoading: true } });
    try {
      const response = await fetch(
        `${state.obsidianApiUrl.replace(/\/+$/, '')}/search/simple/?query=${encodeURIComponent(
          state.obsidianSearchQuery.trim()
        )}`,
        {
          method: 'POST',
          headers: state.obsidianApiKey ? { Authorization: `Bearer ${state.obsidianApiKey}` } : undefined,
        }
      );
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
      const paths = (Array.isArray(payload?.results) ? payload.results : [])
        .map((item) =>
          String((item as any).path ?? (item as any).filename ?? (item as any).file ?? (item as any).name ?? '')
        )
        .filter((value) => value && value !== 'undefined')
        .slice(0, 20);
      dispatch({ type: 'patch', payload: { obsidianSearchResults: paths } });
    } catch (error) {
      console.error('Failed to search Obsidian notes:', error);
      dispatch({ type: 'patch', payload: { obsidianSearchResults: [] } });
    } finally {
      dispatch({ type: 'patch', payload: { obsidianSearchLoading: false } });
    }
  }, [state.obsidianApiKey, state.obsidianApiUrl, state.obsidianSearchQuery]);

  const handleObsidianSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleSearchObsidianNotes();
  };

  const handleSave = () => {
    const parsedRounds = Number.parseInt(state.toolCallMaxRounds, 10);
    const normalizedRounds = Number.isNaN(parsedRounds)
      ? null
      : Math.min(Math.max(parsedRounds, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS);
    if (typeof window !== 'undefined') {
      try {
        if (normalizedRounds === null) {
          window.localStorage.removeItem(TOOL_CALL_MAX_ROUNDS_STORAGE_KEY);
        } else {
          window.localStorage.setItem(TOOL_CALL_MAX_ROUNDS_STORAGE_KEY, String(normalizedRounds));
        }
      } catch (error) {
        console.warn('Failed to persist tool call rounds:', error);
      }
    }

    onSave({
      providerId: state.providerId,
      modelName: state.modelName,
      apiKey: state.apiKey,
      baseUrl: state.baseUrl,
      customHeaders: state.customHeaders,
      tavily: state.tavily,
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

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 titlebar-no-drag"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-xl bg-[var(--bg-1)] [background-image:none] ring-1 ring-[var(--line-1)] shadow-none fx-soft-rise">
        <div className="flex items-center justify-between p-3 pb-1.5">
          <h2 className="text-sm font-semibold text-[var(--ink-1)]">{t('settings.modal.title')}</h2>
          <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex h-[72vh] flex-col gap-4 overflow-hidden p-4 sm:flex-row">
          <div className="flex w-full flex-none gap-2 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => dispatch({ type: 'patch', payload: { activeTab: tab.id } })}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  state.activeTab === tab.id
                    ? 'bg-[var(--bg-2)] text-[var(--ink-1)] ring-1 ring-[var(--line-1)]'
                    : 'text-[var(--ink-3)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pl-2 pr-4 pt-2 sm:pl-4 sm:pr-6 sm:pt-3">
            {state.activeTab === 'provider' && (
              <ProviderTab
                providerId={state.providerId}
                providerOptions={providerOptions}
                modelName={state.modelName}
                apiKey={state.apiKey}
                baseUrl={state.baseUrl}
                customHeaders={state.customHeaders}
                showApiKey={state.showApiKey}
                toolCallMaxRounds={state.toolCallMaxRounds}
                supportsBaseUrl={activeMeta?.supportsBaseUrl}
                supportsCustomHeaders={activeMeta?.supportsCustomHeaders}
                supportsRegion={activeMeta?.supportsRegion}
                portalContainer={portalContainer}
                onProviderChange={handleProviderChange}
                onModelNameChange={(value) => dispatch({ type: 'patch', payload: { modelName: value } })}
                onApiKeyChange={(value) => dispatch({ type: 'patch', payload: { apiKey: value } })}
                onToggleApiKeyVisibility={() =>
                  dispatch({ type: 'patch', payload: { showApiKey: !state.showApiKey } })
                }
                onClearApiKey={() => dispatch({ type: 'patch', payload: { apiKey: '' } })}
                onToolCallMaxRoundsChange={(value) =>
                  dispatch({ type: 'patch', payload: { toolCallMaxRounds: value } })
                }
                onToolCallMaxRoundsBlur={() => {
                  const parsed = Number.parseInt(state.toolCallMaxRounds, 10);
                  if (Number.isNaN(parsed)) {
                    dispatch({ type: 'patch', payload: { toolCallMaxRounds: '' } });
                    return;
                  }
                  const clamped = Math.min(Math.max(parsed, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS);
                  dispatch({ type: 'patch', payload: { toolCallMaxRounds: String(clamped) } });
                }}
                onBaseUrlChange={(value) => dispatch({ type: 'patch', payload: { baseUrl: value } })}
                onAddCustomHeader={() => dispatch({ type: 'add_custom_header' })}
                onSetCustomHeaderKey={(index, value) =>
                  dispatch({ type: 'set_custom_header_key', payload: { index, value } })
                }
                onSetCustomHeaderValue={(index, value) =>
                  dispatch({ type: 'set_custom_header_value', payload: { index, value } })
                }
                onRemoveCustomHeader={(index) =>
                  dispatch({ type: 'remove_custom_header', payload: { index } })
                }
                onSetRegionBaseUrl={(region) =>
                  dispatch({
                    type: 'patch',
                    payload: { baseUrl: resolveBaseUrlForRegion(state.providerId, region) },
                  })
                }
              />
            )}

            {state.activeTab === 'search' && activeMeta?.supportsTavily && (
              <SearchTab
                tavily={state.tavily}
                showTavilyKey={state.showTavilyKey}
                portalContainer={portalContainer}
                onSetTavilyField={(key, value) => dispatch({ type: 'set_tavily', payload: { key, value } })}
                onToggleTavilyKeyVisibility={() =>
                  dispatch({ type: 'patch', payload: { showTavilyKey: !state.showTavilyKey } })
                }
              />
            )}

            {state.activeTab === 'obsidian' && (
              <ObsidianTab
                portalContainer={portalContainer}
                notePathRef={obsidianNotePathRef}
                mode={state.obsidianMode}
                vaultPath={state.obsidianVaultPath}
                notePath={state.obsidianNotePath}
                apiUrl={state.obsidianApiUrl}
                apiKey={state.obsidianApiKey}
                readMode={state.obsidianReadMode}
                writeMode={state.obsidianWriteMode}
                writeHeading={state.obsidianWriteHeading}
                previewBeforeWrite={state.obsidianPreviewBeforeWrite}
                notes={state.obsidianNotes}
                notesLoading={state.obsidianNotesLoading}
                testing={state.obsidianTesting}
                testStatus={state.obsidianTestStatus}
                searchQuery={state.obsidianSearchQuery}
                searchResults={state.obsidianSearchResults}
                searchLoading={state.obsidianSearchLoading}
                onModeChange={(value) => dispatch({ type: 'patch', payload: { obsidianMode: value } })}
                onVaultPathChange={(value) => dispatch({ type: 'patch', payload: { obsidianVaultPath: value } })}
                onNotePathChange={(value) => dispatch({ type: 'patch', payload: { obsidianNotePath: value } })}
                onApiUrlChange={(value) => dispatch({ type: 'patch', payload: { obsidianApiUrl: value } })}
                onApiKeyChange={(value) => dispatch({ type: 'patch', payload: { obsidianApiKey: value } })}
                onReadModeChange={(value) => dispatch({ type: 'patch', payload: { obsidianReadMode: value } })}
                onWriteModeChange={(value) => dispatch({ type: 'patch', payload: { obsidianWriteMode: value } })}
                onWriteHeadingChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianWriteHeading: value } })
                }
                onPreviewBeforeWriteChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianPreviewBeforeWrite: value } })
                }
                onSearchQueryChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianSearchQuery: value } })
                }
                onRefreshNotes={refreshObsidianNotes}
                onTestApi={handleTestObsidianApi}
                onSearch={handleSearchObsidianNotes}
                onSearchKeyDown={handleObsidianSearchKeyDown}
                onSelectSearchResult={(notePath) => {
                  dispatch({
                    type: 'patch',
                    payload: { obsidianNotePath: notePath, obsidianSearchResults: [] },
                  });
                  requestAnimationFrame(() => obsidianNotePathRef.current?.focus());
                }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-3 pt-1.5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
          >
            {t('settings.modal.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-[#1a1a1a] rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={14} />
            {t('settings.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
