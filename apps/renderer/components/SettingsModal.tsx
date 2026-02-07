import React from 'react';
import { Save, X } from 'lucide-react';
import { ProviderId, TavilyConfig } from '../types';
import { t } from '../utils/i18n';
import ProviderTab from './settingsModal/ProviderTab';
import SearchTab from './settingsModal/SearchTab';
import ObsidianTab from './settingsModal/ObsidianTab';
import { useSettingsController } from './settingsModal/useSettingsController';
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
  const {
    state,
    tabs,
    overlayRef,
    portalContainer,
    providerOptions,
    activeMeta,
    obsidianNotePathRef,
    handleSave,
    onTabChange,
    providerActions,
    searchActions,
    obsidianActions,
  } = useSettingsController({
    isOpen,
    onClose,
    onSave,
    onSaveObsidian,
    providerSettings,
    providerId,
    modelName,
    apiKey,
    baseUrl,
    customHeaders,
    tavily,
    obsidianSettings,
  });

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
          <Tabs items={tabs} activeId={state.activeTab} onChange={onTabChange} />

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
                onProviderChange={providerActions.onProviderChange}
                onModelNameChange={providerActions.onModelNameChange}
                onApiKeyChange={providerActions.onApiKeyChange}
                onToggleApiKeyVisibility={providerActions.onToggleApiKeyVisibility}
                onClearApiKey={providerActions.onClearApiKey}
                onToolCallMaxRoundsChange={providerActions.onToolCallMaxRoundsChange}
                onToolCallMaxRoundsBlur={providerActions.onToolCallMaxRoundsBlur}
                onBaseUrlChange={providerActions.onBaseUrlChange}
                onAddCustomHeader={providerActions.onAddCustomHeader}
                onSetCustomHeaderKey={providerActions.onSetCustomHeaderKey}
                onSetCustomHeaderValue={providerActions.onSetCustomHeaderValue}
                onRemoveCustomHeader={providerActions.onRemoveCustomHeader}
                onSetRegionBaseUrl={providerActions.onSetRegionBaseUrl}
              />
            )}

            {state.activeTab === 'search' && activeMeta?.supportsTavily && (
              <SearchTab
                tavily={state.tavily}
                showTavilyKey={state.showTavilyKey}
                portalContainer={portalContainer}
                onSetTavilyField={searchActions.onSetTavilyField}
                onToggleTavilyKeyVisibility={searchActions.onToggleTavilyKeyVisibility}
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
                onModeChange={obsidianActions.onModeChange}
                onVaultPathChange={obsidianActions.onVaultPathChange}
                onNotePathChange={obsidianActions.onNotePathChange}
                onApiUrlChange={obsidianActions.onApiUrlChange}
                onApiKeyChange={obsidianActions.onApiKeyChange}
                onReadModeChange={obsidianActions.onReadModeChange}
                onWriteModeChange={obsidianActions.onWriteModeChange}
                onWriteHeadingChange={obsidianActions.onWriteHeadingChange}
                onPreviewBeforeWriteChange={obsidianActions.onPreviewBeforeWriteChange}
                onSearchQueryChange={obsidianActions.onSearchQueryChange}
                onRefreshNotes={obsidianActions.onRefreshNotes}
                onTestApi={obsidianActions.onTestApi}
                onSearch={obsidianActions.onSearch}
                onSearchKeyDown={obsidianActions.onSearchKeyDown}
                onSelectSearchResult={obsidianActions.onSelectSearchResult}
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
