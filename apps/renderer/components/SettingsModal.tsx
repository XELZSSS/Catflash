import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Eye, EyeOff, Trash2 } from 'lucide-react';
import { ProviderId } from '../types';
import { t } from '../utils/i18n';
import { getProviderDefaultModel, listProviderIds } from '../services/providers/registry';

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

type DropdownOption = {
  value: string;
  label: string;
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

type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  widthClassName?: string;
  portalContainer?: HTMLElement | null;
};

const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  widthClassName,
  portalContainer,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    openUp: boolean;
  } | null>(null);
  const [menuHeight, setMenuHeight] = useState<number | null>(null);
  const [menuReady, setMenuReady] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxMenuHeight = 224; // matches max-h-56
    const spaceBelow = window.innerHeight - rect.bottom;
    const effectiveMenuHeight = menuHeight ?? maxMenuHeight;
    const openUp = spaceBelow < effectiveMenuHeight + 12 && rect.top > effectiveMenuHeight + 12;
    setPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      openUp,
    });
  }, [menuHeight]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    updatePosition();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setMenuHeight(null);
      setMenuReady(false);
      return;
    }
    return undefined;
  }, [open, menuHeight]);

  useLayoutEffect(() => {
    if (!open) return;
    const height = menuRef.current?.getBoundingClientRect().height ?? null;
    if (!height) return;
    if (height !== menuHeight) {
      setMenuHeight(height);
      return;
    }
    if (!menuReady) {
      updatePosition();
      setMenuReady(true);
    }
  }, [open, menuHeight, menuReady, updatePosition]);

  const current = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div ref={containerRef} className={`relative w-full ${widthClassName ?? 'sm:w-56'}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-xs font-sans text-[var(--ink-2)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current}</span>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 max-h-56 overflow-auto scrollbar-hide rounded-md border border-[var(--line-1)] bg-[var(--bg-2)] p-1.5 shadow-none"
              style={{
                left: position.left,
                width: position.width,
                top: position.openUp ? position.top - 8 : position.top + position.height + 8,
                transform: position.openUp ? 'translateY(-100%)' : undefined,
                opacity: menuReady ? 1 : 0,
                pointerEvents: menuReady ? 'auto' : 'none',
              }}
              role="listbox"
            >
              {options.map((option) => (
                <div key={option.value} className="px-1.5 py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-sans transition-colors ${
                      option.value === value
                        ? 'bg-white/10 text-[var(--ink-1)]'
                        : 'text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]'
                    }`}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    {option.label}
                  </button>
                </div>
              ))}
            </div>,
            portalContainer ?? document.body
          )
        : null}
    </div>
  );
};

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
  onSave: (value: {
    providerId: ProviderId;
    modelName: string;
    apiKey: string;
    baseUrl?: string;
    customHeaders?: Array<{ key: string; value: string }>;
    tavily?: import('../types').TavilyConfig;
  }) => void;
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
  onSave,
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
    }
  }, [isOpen, providerId, modelName, apiKey, baseUrl, customHeaders, tavily]);

  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }
    setPortalContainer(overlayRef.current);
  }, [isOpen]);

  if (!isOpen) return null;

  const providerOptions = listProviderIds().map((id) => ({
    value: id,
    label: providerMeta[id]?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
  }));

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

  const handleSave = () => {
    onSave({
      providerId: localProviderId,
      modelName: localModelName,
      apiKey: localApiKey,
      baseUrl: localBaseUrl,
      customHeaders: localHeaders,
      tavily: localTavily,
    });
    onClose();
  };

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

        <div className="p-4 space-y-4">
          {/* Provider */}
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

          {/* Model */}
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

          {/* API Key */}
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
                    aria-label={showApiKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')}
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

          {activeMeta?.supportsTavily && (
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
                  onClick={() => setLocalBaseUrl(resolveBaseUrlForRegion(localProviderId, 'intl'))}
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
                  onClick={() => setLocalBaseUrl(resolveBaseUrlForRegion(localProviderId, 'cn'))}
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
