import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Eye, EyeOff, Trash2 } from 'lucide-react';
import { ProviderId } from '../types';
import { t } from '../utils/i18n';
import { getProviderDefaultModel, listProviderIds } from '../services/providers/registry';
import Dropdown, { type DropdownOption } from './settings/Dropdown';
import {
  DEFAULT_MAX_TOOL_CALL_ROUNDS,
  MAX_TOOL_CALL_ROUNDS,
  MIN_TOOL_CALL_ROUNDS,
  TOOL_CALL_MAX_ROUNDS_STORAGE_KEY,
} from '../services/providers/utils';

const MINIMAX_BASE_URL_INTL = 'http://localhost:4010/proxy/minimax-intl';
const MINIMAX_BASE_URL_CN = 'http://localhost:4010/proxy/minimax-cn';
const MOONSHOT_BASE_URL_INTL = 'http://localhost:4010/proxy/moonshot-intl';
const MOONSHOT_BASE_URL_CN = 'http://localhost:4010/proxy/moonshot-cn';
const GLM_BASE_URL_INTL = 'http://localhost:4010/proxy/glm-intl/chat/completions';
const GLM_BASE_URL_CN = 'http://localhost:4010/proxy/glm-cn/chat/completions';

const resolveBaseUrlForProvider = (
  providerId: ProviderId,
  override?: string
): string | undefined => {
  if (override) return override;
  if (providerId === 'minimax') return MINIMAX_BASE_URL_INTL;
  if (providerId === 'moonshot') return MOONSHOT_BASE_URL_INTL;
  if (providerId === 'glm') return GLM_BASE_URL_CN;
  return undefined;
};

const resolveBaseUrlForRegion = (providerId: ProviderId, region: 'intl' | 'cn'): string => {
  if (providerId === 'moonshot') {
    return region === 'intl' ? MOONSHOT_BASE_URL_INTL : MOONSHOT_BASE_URL_CN;
  }
  if (providerId === 'glm') {
    return region === 'intl' ? GLM_BASE_URL_INTL : GLM_BASE_URL_CN;
  }
  return region === 'intl' ? MINIMAX_BASE_URL_INTL : MINIMAX_BASE_URL_CN;
};

const providerMeta: Record<
  ProviderId,
  {
    label: string;
    supportsTavily?: boolean;
    supportsBaseUrl?: boolean;
    supportsCustomHeaders?: boolean;
    supportsRegion?: boolean;
  }
> = {
  openai: { label: 'OpenAI', supportsTavily: true },
  'openai-compatible': {
    label: 'OpenAI-Compatible',
    supportsTavily: true,
    supportsBaseUrl: true,
    supportsCustomHeaders: true,
  },
  ollama: { label: 'Ollama', supportsBaseUrl: true },
  xai: { label: 'xAI', supportsTavily: true },
  gemini: { label: 'Gemini', supportsTavily: true },
  deepseek: { label: 'DeepSeek', supportsTavily: true },
  glm: { label: 'GLM', supportsTavily: true, supportsRegion: true },
  minimax: { label: 'MiniMax', supportsTavily: true, supportsRegion: true },
  moonshot: { label: 'Moonshot', supportsTavily: true, supportsRegion: true },
  iflow: { label: 'iFlow', supportsTavily: true },
};

const getTavilySearchDepthOptions = (): DropdownOption[] => [
  { value: 'basic', label: t('settings.modal.tavily.searchDepth.basic') },
  { value: 'advanced', label: t('settings.modal.tavily.searchDepth.advanced') },
  { value: 'fast', label: t('settings.modal.tavily.searchDepth.fast') },
  { value: 'ultra-fast', label: t('settings.modal.tavily.searchDepth.ultraFast') },
];

const getTavilyTopicOptions = (): DropdownOption[] => [
  { value: 'general', label: t('settings.modal.tavily.topic.general') },
  { value: 'news', label: t('settings.modal.tavily.topic.news') },
  { value: 'finance', label: t('settings.modal.tavily.topic.finance') },
];

const getObsidianReadOptions = (): DropdownOption[] => [
  { value: 'selected', label: t('settings.modal.obsidian.read.selected') },
  { value: 'recent', label: t('settings.modal.obsidian.read.recent') },
  { value: 'active', label: t('settings.modal.obsidian.read.active') },
];

const getObsidianWriteOptions = (): DropdownOption[] => [
  { value: 'insert-heading', label: t('settings.modal.obsidian.write.heading') },
  { value: 'append', label: t('settings.modal.obsidian.write.append') },
  { value: 'replace', label: t('settings.modal.obsidian.write.replace') },
];

const getObsidianModeOptions = (): DropdownOption[] => [
  { value: 'vault', label: t('settings.modal.obsidian.mode.vault') },
  { value: 'plugin', label: t('settings.modal.obsidian.mode.plugin') },
];

const inputBaseClass =
  'rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-sm font-sans text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]';
const fullInputClass = `w-full ${inputBaseClass}`;
const smInputClass = `w-full sm:w-72 ${inputBaseClass}`;

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [localProviderId, setLocalProviderId] = useState<ProviderId>(providerId);
  const [localModelName, setLocalModelName] = useState<string>(modelName);
  const [localApiKey, setLocalApiKey] = useState<string>(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState<string | undefined>(baseUrl);
  const [localHeaders, setLocalHeaders] = useState<Array<{ key: string; value: string }>>(
    customHeaders ?? []
  );
  const [localTavily, setLocalTavily] = useState<import('../types').TavilyConfig>(tavily ?? {});
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [obsidianMode, setObsidianMode] = useState<import('../types').ObsidianMode>(
    obsidianSettings.mode
  );
  const [obsidianVaultPath, setObsidianVaultPath] = useState<string>(
    obsidianSettings.vaultPath ?? ''
  );
  const [obsidianNotePath, setObsidianNotePath] = useState<string>(obsidianSettings.notePath ?? '');
  const obsidianNotePathRef = useRef<HTMLInputElement>(null);
  const [obsidianApiUrl, setObsidianApiUrl] = useState<string>(obsidianSettings.apiUrl ?? '');
  const [obsidianApiKey, setObsidianApiKey] = useState<string>(obsidianSettings.apiKey ?? '');
  const [obsidianReadMode, setObsidianReadMode] = useState<import('../types').ObsidianReadMode>(
    obsidianSettings.readMode
  );
  const [obsidianWriteMode, setObsidianWriteMode] = useState<import('../types').ObsidianWriteMode>(
    obsidianSettings.writeMode
  );
  const [obsidianWriteHeading, setObsidianWriteHeading] = useState<string>(
    obsidianSettings.writeHeading ?? ''
  );
  const [obsidianPreviewBeforeWrite, setObsidianPreviewBeforeWrite] = useState<boolean>(
    obsidianSettings.previewBeforeWrite
  );
  const [obsidianNotes, setObsidianNotes] = useState<string[]>([]);
  const [obsidianNotesLoading, setObsidianNotesLoading] = useState(false);
  const [obsidianTesting, setObsidianTesting] = useState(false);
  const [obsidianTestStatus, setObsidianTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [obsidianSearchQuery, setObsidianSearchQuery] = useState('');
  const [obsidianSearchResults, setObsidianSearchResults] = useState<string[]>([]);
  const [obsidianSearchLoading, setObsidianSearchLoading] = useState(false);
  const [toolCallMaxRounds, setToolCallMaxRounds] = useState<string>(() => {
    if (typeof window === 'undefined') return String(DEFAULT_MAX_TOOL_CALL_ROUNDS);
    const stored = window.localStorage.getItem(TOOL_CALL_MAX_ROUNDS_STORAGE_KEY);
    return stored ?? String(DEFAULT_MAX_TOOL_CALL_ROUNDS);
  });
  const ACTIVE_TAB_STORAGE_KEY = 'gemini_settings_active_tab';
  const [activeTab, setActiveTab] = useState<'provider' | 'search' | 'obsidian'>(() => {
    if (typeof window === 'undefined') return 'provider';
    const stored = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (stored === 'provider' || stored === 'search' || stored === 'obsidian') {
      return stored;
    }
    return 'provider';
  });

  useEffect(() => {
    if (isOpen) {
      setLocalProviderId(providerId);
      setLocalModelName(modelName);
      setLocalApiKey(apiKey);
      setLocalBaseUrl(resolveBaseUrlForProvider(providerId, baseUrl));
      setLocalHeaders(customHeaders ?? []);
      setLocalTavily(tavily ?? {});
      setShowApiKey(false);
      setShowTavilyKey(false);
      setObsidianMode(obsidianSettings.mode);
      setObsidianVaultPath(obsidianSettings.vaultPath ?? '');
      setObsidianNotePath(obsidianSettings.notePath ?? '');
      setObsidianApiUrl(obsidianSettings.apiUrl ?? '');
      setObsidianApiKey(obsidianSettings.apiKey ?? '');
      setObsidianReadMode(obsidianSettings.readMode);
      setObsidianWriteMode(obsidianSettings.writeMode);
      setObsidianWriteHeading(obsidianSettings.writeHeading ?? '');
      setObsidianPreviewBeforeWrite(obsidianSettings.previewBeforeWrite);
      setObsidianTestStatus('idle');
      setObsidianSearchQuery('');
      setObsidianSearchResults([]);
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(TOOL_CALL_MAX_ROUNDS_STORAGE_KEY);
        setToolCallMaxRounds(stored ?? String(DEFAULT_MAX_TOOL_CALL_ROUNDS));
      } else {
        setToolCallMaxRounds(String(DEFAULT_MAX_TOOL_CALL_ROUNDS));
      }
      if (typeof window === 'undefined') {
        setActiveTab('provider');
      } else {
        const stored = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
        const next =
          stored === 'provider' || stored === 'search' || stored === 'obsidian'
            ? stored
            : 'provider';
        setActiveTab(next);
      }
    }
  }, [isOpen, providerId, modelName, apiKey, baseUrl, customHeaders, tavily, obsidianSettings]);

  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }
    setPortalContainer(overlayRef.current);
  }, [isOpen]);

  const providerOptions = listProviderIds().map((id) => ({
    value: id,
    label: providerMeta[id]?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
  }));
  const obsidianReadOptions =
    obsidianMode === 'plugin'
      ? getObsidianReadOptions().filter((option) => option.value !== 'recent')
      : getObsidianReadOptions();

  useEffect(() => {
    if (obsidianMode === 'plugin' && obsidianReadMode === 'recent') {
      setObsidianReadMode('active');
    }
  }, [obsidianMode, obsidianReadMode]);

  const handleProviderChange = (nextProviderId: ProviderId) => {
    setLocalProviderId(nextProviderId);
    const nextSettings = providerSettings[nextProviderId];
    setLocalModelName(nextSettings?.modelName ?? getProviderDefaultModel(nextProviderId));
    setLocalApiKey(nextSettings?.apiKey ?? '');
    setLocalBaseUrl(resolveBaseUrlForProvider(nextProviderId, nextSettings?.baseUrl));
    setLocalHeaders(nextSettings?.customHeaders ?? []);
    setLocalTavily(nextSettings?.tavily ?? {});
  };

  const activeMeta = providerMeta[localProviderId];
  const tabs = [
    { id: 'provider' as const, label: t('settings.modal.tab.model'), visible: true },
    {
      id: 'search' as const,
      label: t('settings.modal.tab.search'),
      visible: !!activeMeta?.supportsTavily,
    },
    { id: 'obsidian' as const, label: t('settings.modal.tab.obsidian'), visible: true },
  ].filter((tab) => tab.visible);

  useEffect(() => {
    setActiveTab((prev) => (tabs.find((tab) => tab.id === prev) ? prev : 'provider'));
  }, [tabs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch (error) {
      console.warn('Failed to persist settings tab:', error);
    }
  }, [activeTab]);
  const handleSave = () => {
    const parsedRounds = Number.parseInt(toolCallMaxRounds, 10);
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
      providerId: localProviderId,
      modelName: localModelName,
      apiKey: localApiKey,
      baseUrl: localBaseUrl,
      customHeaders: localHeaders,
      tavily: localTavily,
    });
    onSaveObsidian({
      mode: obsidianMode,
      vaultPath: obsidianVaultPath.trim(),
      notePath: obsidianNotePath.trim(),
      apiUrl: obsidianApiUrl.trim(),
      apiKey: obsidianApiKey.trim(),
      readMode: obsidianReadMode,
      writeMode: obsidianWriteMode,
      writeHeading: obsidianWriteHeading.trim(),
      previewBeforeWrite: obsidianPreviewBeforeWrite,
    });
    onClose();
  };

  const refreshObsidianNotes = useCallback(async () => {
    if (obsidianMode !== 'vault') {
      setObsidianNotes([]);
      return;
    }
    if (!obsidianVaultPath) {
      setObsidianNotes([]);
      return;
    }
    if (!window.gero?.obsidian?.listMarkdown) return;
    setObsidianNotesLoading(true);
    try {
      const notes = await window.gero.obsidian.listMarkdown(obsidianVaultPath);
      setObsidianNotes(notes ?? []);
    } catch (error) {
      console.error('Failed to load Obsidian notes:', error);
      setObsidianNotes([]);
    } finally {
      setObsidianNotesLoading(false);
    }
  }, [obsidianVaultPath, obsidianMode]);

  useEffect(() => {
    if (!isOpen) return;
    refreshObsidianNotes();
  }, [isOpen, obsidianVaultPath, obsidianMode, refreshObsidianNotes]);

  const handleTestObsidianApi = async () => {
    if (!obsidianApiUrl) return;
    setObsidianTesting(true);
    setObsidianTestStatus('idle');
    try {
      const response = await fetch(`${obsidianApiUrl.replace(/\/+$/, '')}/`, {
        headers: obsidianApiKey ? { Authorization: `Bearer ${obsidianApiKey}` } : undefined,
      });
      setObsidianTestStatus(response.ok ? 'ok' : 'fail');
    } catch (error) {
      console.error('Failed to test Obsidian API:', error);
      setObsidianTestStatus('fail');
    } finally {
      setObsidianTesting(false);
    }
  };

  const handleSearchObsidianNotes = async () => {
    if (!obsidianApiUrl || !obsidianSearchQuery.trim()) {
      setObsidianSearchResults([]);
      return;
    }
    setObsidianSearchLoading(true);
    try {
      const response = await fetch(
        `${obsidianApiUrl.replace(/\/+$/, '')}/search/simple/?query=${encodeURIComponent(
          obsidianSearchQuery.trim()
        )}`,
        {
          method: 'POST',
          headers: obsidianApiKey ? { Authorization: `Bearer ${obsidianApiKey}` } : undefined,
        }
      );
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      const payload = (await response.json()) as {
        results?: Array<Record<string, unknown>>;
      };
      const rawResults = Array.isArray(payload?.results) ? payload.results : [];
      const paths = rawResults
        .map((item) =>
          String(
            (item as any).path ??
              (item as any).filename ??
              (item as any).file ??
              (item as any).name ??
              ''
          )
        )
        .filter((value) => value && value !== 'undefined')
        .slice(0, 20);
      setObsidianSearchResults(paths);
    } catch (error) {
      console.error('Failed to search Obsidian notes:', error);
      setObsidianSearchResults([]);
    } finally {
      setObsidianSearchLoading(false);
    }
  };

  const handleObsidianSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchObsidianNotes();
    }
  };

  if (!isOpen) return null;

  const updateTavilyField = <K extends keyof import('../types').TavilyConfig>(
    key: K,
    value: import('../types').TavilyConfig[K]
  ) => {
    setLocalTavily((prev) => ({ ...prev, [key]: value }));
  };

  const updateHeaderKey = (index: number, value: string) => {
    setLocalHeaders((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], key: value };
      return next;
    });
  };

  const updateHeaderValue = (index: number, value: string) => {
    setLocalHeaders((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  };

  const handleAddHeader = () => {
    setLocalHeaders((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setLocalHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 titlebar-no-drag"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-xl bg-[var(--bg-1)] [background-image:none] ring-1 ring-[var(--line-1)] shadow-none fx-soft-rise"
      >
        <div className="flex items-center justify-between p-3 pb-1.5">
          <h2 className="text-sm font-semibold text-[var(--ink-1)]">{t('settings.modal.title')}</h2>
          <button
            onClick={onClose}
            className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex h-[72vh] flex-col gap-4 overflow-hidden p-4 sm:flex-row">
          <div className="flex w-full flex-none gap-2 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--bg-2)] text-[var(--ink-1)] ring-1 ring-[var(--line-1)]'
                    : 'text-[var(--ink-3)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pl-2 pr-4 pt-2 sm:pl-4 sm:pr-6 sm:pt-3">
            {activeTab === 'provider' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-xs font-medium text-[var(--ink-2)]">
                      {t('settings.modal.provider')}
                    </label>
                    <Dropdown
                      value={localProviderId}
                      options={providerOptions}
                      onChange={(value) => handleProviderChange(value as ProviderId)}
                      portalContainer={portalContainer}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-xs font-medium text-[var(--ink-2)]">
                      {t('settings.modal.model')}
                    </label>
                    <input
                      type="text"
                      value={localModelName}
                      onChange={(e) => setLocalModelName(e.target.value)}
                      placeholder={getProviderDefaultModel(localProviderId)}
                      className={smInputClass}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-xs font-medium text-[var(--ink-2)]">
                      {t('settings.modal.toolCallRounds')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={toolCallMaxRounds}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/[^\d]/g, '');
                        setToolCallMaxRounds(nextValue);
                      }}
                      onBlur={() => {
                        const parsed = Number.parseInt(toolCallMaxRounds, 10);
                        if (Number.isNaN(parsed)) {
                          setToolCallMaxRounds('');
                          return;
                        }
                        const clamped = Math.min(
                          Math.max(parsed, MIN_TOOL_CALL_ROUNDS),
                          MAX_TOOL_CALL_ROUNDS
                        );
                        setToolCallMaxRounds(String(clamped));
                      }}
                      placeholder={String(DEFAULT_MAX_TOOL_CALL_ROUNDS)}
                      className={smInputClass}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-[var(--ink-2)]">
                      {t('settings.modal.apiKey')}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        className={`${fullInputClass} pr-20`}
                        autoComplete="off"
                      />
                      <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowApiKey((prev) => !prev)}
                          className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                          aria-label={
                            showApiKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')
                          }
                        >
                          {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocalApiKey('')}
                          className="text-[var(--ink-3)] hover:text-red-400 transition-colors"
                          aria-label={t('settings.apiKey.clear')}
                          title={t('settings.apiKey.clear')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {(activeMeta?.supportsBaseUrl || activeMeta?.supportsCustomHeaders) && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="text-xs font-medium text-[var(--ink-2)]">
                          {t('settings.modal.baseUrl')}
                        </label>
                        <input
                          type="text"
                          value={localBaseUrl ?? ''}
                          onChange={(e) => setLocalBaseUrl(e.target.value)}
                          placeholder="https://api.example.com/v1"
                          className={smInputClass}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-[var(--ink-2)]">
                          {t('settings.modal.customHeaders')}
                        </label>
                        <button
                          type="button"
                          onClick={handleAddHeader}
                          className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                        >
                          {t('settings.modal.customHeaders.add')}
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {localHeaders.length === 0 && (
                          <div className="text-xs text-[var(--ink-3)]">
                            {t('settings.modal.customHeaders.empty')}
                          </div>
                        )}
                        {localHeaders.map((header, index) => (
                          <div
                            key={`${header.key}-${index}`}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => updateHeaderKey(index, e.target.value)}
                              placeholder={t('settings.modal.customHeaders.key')}
                              className={fullInputClass}
                              autoComplete="off"
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => updateHeaderValue(index, e.target.value)}
                              placeholder={t('settings.modal.customHeaders.value')}
                              className={fullInputClass}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveHeader(index)}
                              className="text-[var(--ink-3)] hover:text-red-400 transition-colors"
                              aria-label={t('settings.modal.customHeaders.remove')}
                              title={t('settings.modal.customHeaders.remove')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeMeta?.supportsRegion && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-[var(--ink-2)]">
                        {t('settings.modal.region')}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLocalBaseUrl(resolveBaseUrlForRegion(localProviderId, 'intl'))
                        }
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1 ${
                          localBaseUrl === resolveBaseUrlForRegion(localProviderId, 'intl')
                            ? 'bg-[var(--accent)] text-[#1a1a1a] ring-[var(--accent)]'
                            : 'text-[var(--ink-3)] ring-[var(--line-1)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {t('settings.modal.region.international')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLocalBaseUrl(resolveBaseUrlForRegion(localProviderId, 'cn'))
                        }
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1 ${
                          localBaseUrl === resolveBaseUrlForRegion(localProviderId, 'cn')
                            ? 'bg-[var(--accent)] text-[#1a1a1a] ring-[var(--accent)]'
                            : 'text-[var(--ink-3)] ring-[var(--line-1)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {t('settings.modal.region.china')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'search' && activeMeta?.supportsTavily && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--ink-2)]">
                      {t('settings.modal.tavily.title')}
                    </label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-[var(--ink-3)]">
                        {t('settings.modal.tavily.apiKey')}
                      </label>
                      <div className="relative">
                        <input
                          type={showTavilyKey ? 'text' : 'password'}
                          value={localTavily.apiKey ?? ''}
                          onChange={(e) => updateTavilyField('apiKey', e.target.value)}
                          className={`${fullInputClass} pr-20`}
                          autoComplete="off"
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowTavilyKey((prev) => !prev)}
                            className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                            aria-label={
                              showTavilyKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')
                            }
                          >
                            {showTavilyKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTavilyField('apiKey', '')}
                            className="text-[var(--ink-3)] hover:text-red-400 transition-colors"
                            aria-label={t('settings.apiKey.clear')}
                            title={t('settings.apiKey.clear')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-[var(--ink-3)]">
                        {t('settings.modal.tavily.projectId')}
                      </label>
                      <input
                        type="text"
                        value={localTavily.projectId ?? ''}
                        onChange={(e) => updateTavilyField('projectId', e.target.value)}
                        className={fullInputClass}
                        autoComplete="off"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-[var(--ink-3)]">
                          {t('settings.modal.tavily.searchDepth')}
                        </label>
                        <Dropdown
                          value={localTavily.searchDepth ?? 'basic'}
                          options={getTavilySearchDepthOptions()}
                          onChange={(value) =>
                            updateTavilyField(
                              'searchDepth',
                              value as import('../types').TavilySearchDepth
                            )
                          }
                          widthClassName="sm:w-full"
                          portalContainer={portalContainer}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-[var(--ink-3)]">
                          {t('settings.modal.tavily.maxResults')}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={localTavily.maxResults ?? 5}
                          onChange={(e) =>
                            updateTavilyField(
                              'maxResults',
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                          className={fullInputClass}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-[var(--ink-3)]">
                          {t('settings.modal.tavily.topic')}
                        </label>
                        <Dropdown
                          value={localTavily.topic ?? 'general'}
                          options={getTavilyTopicOptions()}
                          onChange={(value) =>
                            updateTavilyField('topic', value as import('../types').TavilyTopic)
                          }
                          widthClassName="sm:w-full"
                          portalContainer={portalContainer}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
                      <input
                        type="checkbox"
                        checked={localTavily.includeAnswer ?? true}
                        onChange={(e) => updateTavilyField('includeAnswer', e.target.checked)}
                        className="h-4 w-4 rounded border border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-1)] accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink-3)] focus-visible:ring-offset-0"
                      />
                      {t('settings.modal.tavily.includeAnswer')}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'obsidian' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--ink-2)]">
                    {t('settings.modal.obsidian.title')}
                  </label>
                  {obsidianMode === 'vault' ? (
                    <button
                      type="button"
                      onClick={refreshObsidianNotes}
                      className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                      disabled={!obsidianVaultPath || obsidianNotesLoading}
                    >
                      {obsidianNotesLoading
                        ? t('settings.modal.obsidian.refreshing')
                        : t('settings.modal.obsidian.refresh')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTestObsidianApi}
                      className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                      disabled={!obsidianApiUrl || obsidianTesting}
                    >
                      {obsidianTesting
                        ? t('settings.modal.obsidian.testing')
                        : t('settings.modal.obsidian.test')}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-[var(--ink-3)]">
                    {t('settings.modal.obsidian.mode')}
                  </label>
                  <Dropdown
                    value={obsidianMode}
                    options={getObsidianModeOptions()}
                    onChange={(value) => setObsidianMode(value as import('../types').ObsidianMode)}
                    widthClassName="sm:w-56"
                    portalContainer={portalContainer}
                  />
                  {obsidianMode === 'plugin' && obsidianTestStatus !== 'idle' && (
                    <div
                      className={`text-[11px] ${
                        obsidianTestStatus === 'ok' ? 'text-emerald-300' : 'text-red-400'
                      }`}
                    >
                      {obsidianTestStatus === 'ok'
                        ? t('settings.modal.obsidian.test.success')
                        : t('settings.modal.obsidian.test.fail')}
                    </div>
                  )}
                </div>

                {obsidianMode === 'vault' ? (
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--ink-3)]">
                      {t('settings.modal.obsidian.vaultPath')}
                    </label>
                    <input
                      type="text"
                      value={obsidianVaultPath}
                      onChange={(e) => setObsidianVaultPath(e.target.value)}
                      placeholder="C:\Users\you\Documents\Obsidian\Vault"
                      className={fullInputClass}
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--ink-3)]">
                        {t('settings.modal.obsidian.apiUrl')}
                      </label>
                      <input
                        type="text"
                        value={obsidianApiUrl}
                        onChange={(e) => setObsidianApiUrl(e.target.value)}
                        placeholder="http://127.0.0.1:27123"
                        className={fullInputClass}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--ink-3)]">
                        {t('settings.modal.obsidian.apiKey')}
                      </label>
                      <input
                        type="password"
                        value={obsidianApiKey}
                        onChange={(e) => setObsidianApiKey(e.target.value)}
                        className={fullInputClass}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--ink-3)]">
                        {t('settings.modal.obsidian.search')}
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={obsidianSearchQuery}
                          onChange={(e) => setObsidianSearchQuery(e.target.value)}
                          onKeyDown={handleObsidianSearchKeyDown}
                          placeholder={t('settings.modal.obsidian.search.placeholder')}
                          className="w-full flex-1 rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-sm font-sans text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={handleSearchObsidianNotes}
                          className="px-3 py-1.5 text-xs rounded-md ring-1 ring-[var(--line-1)] text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-2)] transition-colors"
                          disabled={!obsidianSearchQuery.trim() || obsidianSearchLoading}
                        >
                          {obsidianSearchLoading
                            ? t('settings.modal.obsidian.searching')
                            : t('settings.modal.obsidian.search')}
                        </button>
                      </div>
                      {obsidianSearchResults.length > 0 ? (
                        <div className="max-h-40 overflow-auto rounded-md border border-[var(--line-1)] bg-[var(--bg-2)]">
                          {obsidianSearchResults.map((note) => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => {
                                setObsidianNotePath(note);
                                setObsidianSearchResults([]);
                                requestAnimationFrame(() => obsidianNotePathRef.current?.focus());
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-[var(--ink-2)] hover:bg-white/5"
                            >
                              {note}
                            </button>
                          ))}
                        </div>
                      ) : (
                        obsidianSearchQuery.trim() &&
                        !obsidianSearchLoading && (
                          <div className="text-[11px] text-[var(--ink-3)]">
                            {t('settings.modal.obsidian.search.empty')}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-[var(--ink-3)]">
                    {t('settings.modal.obsidian.notePath')}
                  </label>
                  <input
                    type="text"
                    value={obsidianNotePath}
                    onChange={(e) => setObsidianNotePath(e.target.value)}
                    placeholder={t('settings.modal.obsidian.notePath.placeholder')}
                    className={fullInputClass}
                    list={obsidianMode === 'vault' ? 'obsidian-note-list' : undefined}
                    autoComplete="off"
                    ref={obsidianNotePathRef}
                  />
                  {obsidianMode === 'vault' && (
                    <datalist id="obsidian-note-list">
                      {obsidianNotes.map((note) => (
                        <option key={note} value={note} />
                      ))}
                    </datalist>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-[var(--ink-3)]">
                      {t('settings.modal.obsidian.readMode')}
                    </label>
                    <Dropdown
                      value={obsidianReadMode}
                      options={obsidianReadOptions}
                      onChange={(value) =>
                        setObsidianReadMode(value as import('../types').ObsidianReadMode)
                      }
                      widthClassName="sm:w-full"
                      portalContainer={portalContainer}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-[var(--ink-3)]">
                      {t('settings.modal.obsidian.writeMode')}
                    </label>
                    <Dropdown
                      value={obsidianWriteMode}
                      options={getObsidianWriteOptions()}
                      onChange={(value) =>
                        setObsidianWriteMode(value as import('../types').ObsidianWriteMode)
                      }
                      widthClassName="sm:w-full"
                      portalContainer={portalContainer}
                    />
                  </div>
                </div>

                {obsidianWriteMode === 'insert-heading' && (
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--ink-3)]">
                      {t('settings.modal.obsidian.writeHeading')}
                    </label>
                    <input
                      type="text"
                      value={obsidianWriteHeading}
                      onChange={(e) => setObsidianWriteHeading(e.target.value)}
                      placeholder="## AI Draft"
                      className={fullInputClass}
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
                  <input
                    type="checkbox"
                    checked={obsidianPreviewBeforeWrite}
                    onChange={(e) => setObsidianPreviewBeforeWrite(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-1)] accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink-3)] focus-visible:ring-offset-0"
                  />
                  {t('settings.modal.obsidian.preview')}
                </label>
              </div>
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
