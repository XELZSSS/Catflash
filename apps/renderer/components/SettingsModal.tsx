import React, { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { ProviderId, TavilyConfig } from '../types';
import { t } from '../utils/i18n';
import {
  MAX_TOOL_CALL_ROUNDS,
  MIN_TOOL_CALL_ROUNDS,
  TOOL_CALL_MAX_ROUNDS_STORAGE_KEY,
} from '../services/providers/utils';
import ProviderTab from './settingsModal/ProviderTab';
import SearchTab from './settingsModal/SearchTab';
import ObsidianTab from './settingsModal/ObsidianTab';
import { resolveBaseUrlForRegion } from './settingsModal/constants';
import { useObsidianTools } from './settingsModal/useObsidianTools';
import { useSettingsForm } from './settingsModal/useSettingsForm';
import {
  ProviderSettingsMap,
  SaveObsidianPayload,
  SaveSettingsPayload,
} from './settingsModal/types';
import { Button, Modal, Tabs } from './ui';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerSettings: ProviderSettingsMap;
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  obsidianSettings: import('../types').ObsidianSettings;
  onSave: (value: SaveSettingsPayload) => void;
  onSaveObsidian: (value: SaveObsidianPayload) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  providerSettings,
  providerId,
  modelName,
  apiKey,
  baseUrl,
  customHeaders,
  tavily,
  obsidianSettings,
  onSave,
  onSaveObsidian,
}) => {
  const { state, dispatch, providerOptions, activeMeta, tabs, handleProviderChange } =
    useSettingsForm({
      isOpen,
      providerId,
      modelName,
      apiKey,
      baseUrl,
      customHeaders,
      tavily,
      obsidianSettings,
    });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const {
    obsidianNotePathRef,
    refreshObsidianNotes,
    handleTestObsidianApi,
    handleSearchObsidianNotes,
    handleObsidianSearchKeyDown,
  } = useObsidianTools({ state, dispatch, isOpen });
  const overlayRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }
    setPortalContainer(overlayRef.current);
  }, [isOpen]);

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
    <Modal isOpen={isOpen} className="max-w-2xl" overlayRef={overlayRef}>
      <div className="w-full">
        <div className="flex items-center justify-between p-3 pb-1.5">
          <h2 className="text-sm font-semibold text-[var(--ink-1)]">{t('settings.modal.title')}</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="!px-1.5 !py-1 !bg-transparent hover:!bg-transparent text-[var(--ink-3)] hover:text-[var(--ink-1)]"
            aria-label={t('settings.modal.cancel')}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="flex h-[72vh] flex-col gap-4 overflow-hidden p-4 sm:flex-row">
          <Tabs
            items={tabs}
            activeId={state.activeTab}
            onChange={(id) => dispatch({ type: 'patch', payload: { activeTab: id } })}
          />

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
                onProviderChange={(nextProviderId) =>
                  handleProviderChange(nextProviderId, providerSettings)
                }
                onModelNameChange={(value) =>
                  dispatch({ type: 'patch', payload: { modelName: value } })
                }
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
                  const clamped = Math.min(
                    Math.max(parsed, MIN_TOOL_CALL_ROUNDS),
                    MAX_TOOL_CALL_ROUNDS
                  );
                  dispatch({ type: 'patch', payload: { toolCallMaxRounds: String(clamped) } });
                }}
                onBaseUrlChange={(value) =>
                  dispatch({ type: 'patch', payload: { baseUrl: value } })
                }
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
                onSetTavilyField={(key, value) =>
                  dispatch({ type: 'set_tavily', payload: { key, value } })
                }
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
                onModeChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianMode: value } })
                }
                onVaultPathChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianVaultPath: value } })
                }
                onNotePathChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianNotePath: value } })
                }
                onApiUrlChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianApiUrl: value } })
                }
                onApiKeyChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianApiKey: value } })
                }
                onReadModeChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianReadMode: value } })
                }
                onWriteModeChange={(value) =>
                  dispatch({ type: 'patch', payload: { obsidianWriteMode: value } })
                }
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
          <Button onClick={onClose} variant="ghost" size="md">
            {t('settings.modal.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            size="md"
            className="flex items-center gap-2"
          >
            <Save size={14} />
            {t('settings.modal.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
