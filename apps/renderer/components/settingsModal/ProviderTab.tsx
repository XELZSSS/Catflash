import React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { ProviderId } from '../../types';
import { t } from '../../utils/i18n';
import { getProviderDefaultModel } from '../../services/providers/registry';
import Dropdown, { DropdownOption } from '../settings/Dropdown';
import { DEFAULT_MAX_TOOL_CALL_ROUNDS } from '../../services/providers/utils';
import { fullInputClass, resolveBaseUrlForRegion, smInputClass } from './constants';

type ProviderTabProps = {
  providerId: ProviderId;
  providerOptions: DropdownOption[];
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders: Array<{ key: string; value: string }>;
  showApiKey: boolean;
  toolCallMaxRounds: string;
  supportsBaseUrl?: boolean;
  supportsCustomHeaders?: boolean;
  supportsRegion?: boolean;
  portalContainer: HTMLElement | null;
  onProviderChange: (providerId: ProviderId) => void;
  onModelNameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onToggleApiKeyVisibility: () => void;
  onClearApiKey: () => void;
  onToolCallMaxRoundsChange: (value: string) => void;
  onToolCallMaxRoundsBlur: () => void;
  onBaseUrlChange: (value: string) => void;
  onAddCustomHeader: () => void;
  onSetCustomHeaderKey: (index: number, value: string) => void;
  onSetCustomHeaderValue: (index: number, value: string) => void;
  onRemoveCustomHeader: (index: number) => void;
  onSetRegionBaseUrl: (region: 'intl' | 'cn') => void;
};

const ProviderTab: React.FC<ProviderTabProps> = ({
  providerId,
  providerOptions,
  modelName,
  apiKey,
  baseUrl,
  customHeaders,
  showApiKey,
  toolCallMaxRounds,
  supportsBaseUrl,
  supportsCustomHeaders,
  supportsRegion,
  portalContainer,
  onProviderChange,
  onModelNameChange,
  onApiKeyChange,
  onToggleApiKeyVisibility,
  onClearApiKey,
  onToolCallMaxRoundsChange,
  onToolCallMaxRoundsBlur,
  onBaseUrlChange,
  onAddCustomHeader,
  onSetCustomHeaderKey,
  onSetCustomHeaderValue,
  onRemoveCustomHeader,
  onSetRegionBaseUrl,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-xs font-medium text-[var(--ink-2)]">{t('settings.modal.provider')}</label>
          <Dropdown
            value={providerId}
            options={providerOptions}
            onChange={(value) => onProviderChange(value as ProviderId)}
            portalContainer={portalContainer}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-xs font-medium text-[var(--ink-2)]">{t('settings.modal.model')}</label>
          <input
            type="text"
            value={modelName}
            onChange={(event) => onModelNameChange(event.target.value)}
            placeholder={getProviderDefaultModel(providerId)}
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
            onChange={(event) => onToolCallMaxRoundsChange(event.target.value.replace(/[^\d]/g, ''))}
            onBlur={onToolCallMaxRoundsBlur}
            placeholder={String(DEFAULT_MAX_TOOL_CALL_ROUNDS)}
            className={smInputClass}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--ink-2)]">{t('settings.modal.apiKey')}</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              className={`${fullInputClass} pr-20`}
              autoComplete="off"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleApiKeyVisibility}
                className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                aria-label={showApiKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={onClearApiKey}
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

      {(supportsBaseUrl || supportsCustomHeaders) && (
        <div className="space-y-3">
          {supportsBaseUrl && (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-xs font-medium text-[var(--ink-2)]">
                  {t('settings.modal.baseUrl')}
                </label>
                <input
                  type="text"
                  value={baseUrl ?? ''}
                  onChange={(event) => onBaseUrlChange(event.target.value)}
                  placeholder="https://api.example.com/v1"
                  className={smInputClass}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {supportsCustomHeaders && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--ink-2)]">
                  {t('settings.modal.customHeaders')}
                </label>
                <button
                  type="button"
                  onClick={onAddCustomHeader}
                  className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                >
                  {t('settings.modal.customHeaders.add')}
                </button>
              </div>

              <div className="space-y-1.5">
                {customHeaders.length === 0 && (
                  <div className="text-xs text-[var(--ink-3)]">
                    {t('settings.modal.customHeaders.empty')}
                  </div>
                )}
                {customHeaders.map((header, index) => (
                  <div
                    key={`${header.key}-${index}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <input
                      type="text"
                      value={header.key}
                      onChange={(event) => onSetCustomHeaderKey(index, event.target.value)}
                      placeholder={t('settings.modal.customHeaders.key')}
                      className={fullInputClass}
                      autoComplete="off"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(event) => onSetCustomHeaderValue(index, event.target.value)}
                      placeholder={t('settings.modal.customHeaders.value')}
                      className={fullInputClass}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveCustomHeader(index)}
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
          )}
        </div>
      )}

      {supportsRegion && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-[var(--ink-2)]">{t('settings.modal.region')}</label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSetRegionBaseUrl('intl')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1 ${
                baseUrl === resolveBaseUrlForRegion(providerId, 'intl')
                  ? 'bg-[var(--accent)] text-[#1a1a1a] ring-[var(--accent)]'
                  : 'text-[var(--ink-3)] ring-[var(--line-1)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
              }`}
            >
              {t('settings.modal.region.international')}
            </button>
            <button
              type="button"
              onClick={() => onSetRegionBaseUrl('cn')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1 ${
                baseUrl === resolveBaseUrlForRegion(providerId, 'cn')
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
  );
};

export default ProviderTab;
