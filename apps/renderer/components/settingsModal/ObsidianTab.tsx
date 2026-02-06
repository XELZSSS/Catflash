import React from 'react';
import { ObsidianMode, ObsidianReadMode, ObsidianWriteMode } from '../../types';
import { t } from '../../utils/i18n';
import Dropdown from '../settings/Dropdown';
import {
  fullInputClass,
  getObsidianModeOptions,
  getObsidianReadOptions,
  getObsidianWriteOptions,
} from './constants';

type ObsidianTabProps = {
  portalContainer: HTMLElement | null;
  notePathRef: React.RefObject<HTMLInputElement>;
  mode: ObsidianMode;
  vaultPath: string;
  notePath: string;
  apiUrl: string;
  apiKey: string;
  readMode: ObsidianReadMode;
  writeMode: ObsidianWriteMode;
  writeHeading: string;
  previewBeforeWrite: boolean;
  notes: string[];
  notesLoading: boolean;
  testing: boolean;
  testStatus: 'idle' | 'ok' | 'fail';
  searchQuery: string;
  searchResults: string[];
  searchLoading: boolean;
  onModeChange: (value: ObsidianMode) => void;
  onVaultPathChange: (value: string) => void;
  onNotePathChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onReadModeChange: (value: ObsidianReadMode) => void;
  onWriteModeChange: (value: ObsidianWriteMode) => void;
  onWriteHeadingChange: (value: string) => void;
  onPreviewBeforeWriteChange: (value: boolean) => void;
  onSearchQueryChange: (value: string) => void;
  onRefreshNotes: () => void;
  onTestApi: () => void;
  onSearch: () => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectSearchResult: (notePath: string) => void;
};

const ObsidianTab: React.FC<ObsidianTabProps> = ({
  portalContainer,
  notePathRef,
  mode,
  vaultPath,
  notePath,
  apiUrl,
  apiKey,
  readMode,
  writeMode,
  writeHeading,
  previewBeforeWrite,
  notes,
  notesLoading,
  testing,
  testStatus,
  searchQuery,
  searchResults,
  searchLoading,
  onModeChange,
  onVaultPathChange,
  onNotePathChange,
  onApiUrlChange,
  onApiKeyChange,
  onReadModeChange,
  onWriteModeChange,
  onWriteHeadingChange,
  onPreviewBeforeWriteChange,
  onSearchQueryChange,
  onRefreshNotes,
  onTestApi,
  onSearch,
  onSearchKeyDown,
  onSelectSearchResult,
}) => {
  const readOptions =
    mode === 'plugin'
      ? getObsidianReadOptions().filter((option) => option.value !== 'recent')
      : getObsidianReadOptions();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[var(--ink-2)]">{t('settings.modal.obsidian.title')}</label>
        {mode === 'vault' ? (
          <button
            type="button"
            onClick={onRefreshNotes}
            className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
            disabled={!vaultPath || notesLoading}
          >
            {notesLoading
              ? t('settings.modal.obsidian.refreshing')
              : t('settings.modal.obsidian.refresh')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onTestApi}
            className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
            disabled={!apiUrl || testing}
          >
            {testing ? t('settings.modal.obsidian.testing') : t('settings.modal.obsidian.test')}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.mode')}</label>
        <Dropdown
          value={mode}
          options={getObsidianModeOptions()}
          onChange={(value) => onModeChange(value as ObsidianMode)}
          widthClassName="sm:w-56"
          portalContainer={portalContainer}
        />
        {mode === 'plugin' && testStatus !== 'idle' && (
          <div className={`text-[11px] ${testStatus === 'ok' ? 'text-emerald-300' : 'text-red-400'}`}>
            {testStatus === 'ok'
              ? t('settings.modal.obsidian.test.success')
              : t('settings.modal.obsidian.test.fail')}
          </div>
        )}
      </div>

      {mode === 'vault' ? (
        <div className="space-y-2">
          <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.vaultPath')}</label>
          <input
            type="text"
            value={vaultPath}
            onChange={(event) => onVaultPathChange(event.target.value)}
            placeholder="C:\\Users\\you\\Documents\\Obsidian\\Vault"
            className={fullInputClass}
            autoComplete="off"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.apiUrl')}</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(event) => onApiUrlChange(event.target.value)}
              placeholder="http://127.0.0.1:27123"
              className={fullInputClass}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.apiKey')}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              className={fullInputClass}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.search')}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t('settings.modal.obsidian.search.placeholder')}
                className="w-full flex-1 rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-sm font-sans text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={onSearch}
                className="px-3 py-1.5 text-xs rounded-md ring-1 ring-[var(--line-1)] text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-2)] transition-colors"
                disabled={!searchQuery.trim() || searchLoading}
              >
                {searchLoading
                  ? t('settings.modal.obsidian.searching')
                  : t('settings.modal.obsidian.search')}
              </button>
            </div>
            {searchResults.length > 0 ? (
              <div className="max-h-40 overflow-auto rounded-md border border-[var(--line-1)] bg-[var(--bg-2)]">
                {searchResults.map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => onSelectSearchResult(note)}
                    className="w-full text-left px-3 py-2 text-xs text-[var(--ink-2)] hover:bg-white/5"
                  >
                    {note}
                  </button>
                ))}
              </div>
            ) : (
              searchQuery.trim() &&
              !searchLoading && (
                <div className="text-[11px] text-[var(--ink-3)]">
                  {t('settings.modal.obsidian.search.empty')}
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.notePath')}</label>
        <input
          type="text"
          value={notePath}
          onChange={(event) => onNotePathChange(event.target.value)}
          placeholder={t('settings.modal.obsidian.notePath.placeholder')}
          className={fullInputClass}
          list={mode === 'vault' ? 'obsidian-note-list' : undefined}
          autoComplete="off"
          ref={notePathRef}
        />
        {mode === 'vault' && (
          <datalist id="obsidian-note-list">
            {notes.map((note) => (
              <option key={note} value={note} />
            ))}
          </datalist>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.readMode')}</label>
          <Dropdown
            value={readMode}
            options={readOptions}
            onChange={(value) => onReadModeChange(value as ObsidianReadMode)}
            widthClassName="sm:w-full"
            portalContainer={portalContainer}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.obsidian.writeMode')}</label>
          <Dropdown
            value={writeMode}
            options={getObsidianWriteOptions()}
            onChange={(value) => onWriteModeChange(value as ObsidianWriteMode)}
            widthClassName="sm:w-full"
            portalContainer={portalContainer}
          />
        </div>
      </div>

      {writeMode === 'insert-heading' && (
        <div className="space-y-2">
          <label className="text-xs text-[var(--ink-3)]">
            {t('settings.modal.obsidian.writeHeading')}
          </label>
          <input
            type="text"
            value={writeHeading}
            onChange={(event) => onWriteHeadingChange(event.target.value)}
            placeholder="## AI Draft"
            className={fullInputClass}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
        <input
          type="checkbox"
          checked={previewBeforeWrite}
          onChange={(event) => onPreviewBeforeWriteChange(event.target.checked)}
          className="h-4 w-4 rounded border border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-1)] accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink-3)] focus-visible:ring-offset-0"
        />
        {t('settings.modal.obsidian.preview')}
      </label>
    </div>
  );
};

export default ObsidianTab;
