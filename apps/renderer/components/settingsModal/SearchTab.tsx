import React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { TavilyConfig } from '../../types';
import { t } from '../../utils/i18n';
import Dropdown from '../settings/Dropdown';
import { fullInputClass, getTavilySearchDepthOptions, getTavilyTopicOptions } from './constants';
import { Button, Field, Input, Toggle } from '../ui';

type SearchTabProps = {
  tavily: TavilyConfig;
  showTavilyKey: boolean;
  portalContainer: HTMLElement | null;
  onSetTavilyField: <K extends keyof TavilyConfig>(key: K, value: TavilyConfig[K]) => void;
  onToggleTavilyKeyVisibility: () => void;
};

const SearchTab: React.FC<SearchTabProps> = ({
  tavily,
  showTavilyKey,
  portalContainer,
  onSetTavilyField,
  onToggleTavilyKeyVisibility,
}) => {
  return (
    <div className="space-y-4">
      <Field label={t('settings.modal.tavily.title')}>
        <div className="space-y-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[var(--ink-3)]">
              {t('settings.modal.tavily.apiKey')}
            </label>
            <div className="relative">
              <Input
                type={showTavilyKey ? 'text' : 'password'}
                value={tavily.apiKey ?? ''}
                onChange={(event) => onSetTavilyField('apiKey', event.target.value)}
                className={`${fullInputClass} pr-20`}
                compact
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                <Button
                  onClick={onToggleTavilyKeyVisibility}
                  variant="ghost"
                  size="sm"
                  className="!px-0 !py-0 h-auto"
                  aria-label={showTavilyKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')}
                >
                  {showTavilyKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
                <Button
                  onClick={() => onSetTavilyField('apiKey', '')}
                  variant="ghost"
                  size="sm"
                  className="!px-0 !py-0 h-auto hover:text-red-400"
                  aria-label={t('settings.apiKey.clear')}
                  title={t('settings.apiKey.clear')}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-[var(--ink-3)]">
              {t('settings.modal.tavily.projectId')}
            </label>
            <Input
              type="text"
              value={tavily.projectId ?? ''}
              onChange={(event) => onSetTavilyField('projectId', event.target.value)}
              className={fullInputClass}
              compact
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--ink-3)]">
                {t('settings.modal.tavily.searchDepth')}
              </label>
              <Dropdown
                value={tavily.searchDepth ?? 'basic'}
                options={getTavilySearchDepthOptions()}
                onChange={(value) =>
                  onSetTavilyField('searchDepth', value as import('../../types').TavilySearchDepth)
                }
                widthClassName="sm:w-full"
                portalContainer={portalContainer}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--ink-3)]">
                {t('settings.modal.tavily.maxResults')}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={tavily.maxResults ?? 5}
                onChange={(event) =>
                  onSetTavilyField(
                    'maxResults',
                    event.target.value ? Number(event.target.value) : undefined
                  )
                }
                className={fullInputClass}
                compact
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--ink-3)]">
                {t('settings.modal.tavily.topic')}
              </label>
              <Dropdown
                value={tavily.topic ?? 'general'}
                options={getTavilyTopicOptions()}
                onChange={(value) =>
                  onSetTavilyField('topic', value as import('../../types').TavilyTopic)
                }
                widthClassName="sm:w-full"
                portalContainer={portalContainer}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
            <Toggle
              checked={tavily.includeAnswer ?? true}
              onChange={(event) => onSetTavilyField('includeAnswer', event.target.checked)}
            />
            {t('settings.modal.tavily.includeAnswer')}
          </label>
        </div>
      </Field>
    </div>
  );
};

export default SearchTab;
