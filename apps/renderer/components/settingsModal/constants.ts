import { ProviderId } from '../../types';
import { t } from '../../utils/i18n';
import { DropdownOption } from '../settings/Dropdown';

export const MINIMAX_BASE_URL_INTL = 'http://localhost:4010/proxy/minimax-intl';
export const MINIMAX_BASE_URL_CN = 'http://localhost:4010/proxy/minimax-cn';
export const MOONSHOT_BASE_URL_INTL = 'http://localhost:4010/proxy/moonshot-intl';
export const MOONSHOT_BASE_URL_CN = 'http://localhost:4010/proxy/moonshot-cn';
export const GLM_BASE_URL_INTL = 'http://localhost:4010/proxy/glm-intl/chat/completions';
export const GLM_BASE_URL_CN = 'http://localhost:4010/proxy/glm-cn/chat/completions';

export const resolveBaseUrlForProvider = (
  providerId: ProviderId,
  override?: string
): string | undefined => {
  if (override) return override;
  if (providerId === 'minimax') return MINIMAX_BASE_URL_INTL;
  if (providerId === 'moonshot') return MOONSHOT_BASE_URL_INTL;
  if (providerId === 'glm') return GLM_BASE_URL_CN;
  return undefined;
};

export const resolveBaseUrlForRegion = (providerId: ProviderId, region: 'intl' | 'cn'): string => {
  if (providerId === 'moonshot') {
    return region === 'intl' ? MOONSHOT_BASE_URL_INTL : MOONSHOT_BASE_URL_CN;
  }
  if (providerId === 'glm') {
    return region === 'intl' ? GLM_BASE_URL_INTL : GLM_BASE_URL_CN;
  }
  return region === 'intl' ? MINIMAX_BASE_URL_INTL : MINIMAX_BASE_URL_CN;
};

export const providerMeta: Record<
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

export const getTavilySearchDepthOptions = (): DropdownOption[] => [
  { value: 'basic', label: t('settings.modal.tavily.searchDepth.basic') },
  { value: 'advanced', label: t('settings.modal.tavily.searchDepth.advanced') },
  { value: 'fast', label: t('settings.modal.tavily.searchDepth.fast') },
  { value: 'ultra-fast', label: t('settings.modal.tavily.searchDepth.ultraFast') },
];

export const getTavilyTopicOptions = (): DropdownOption[] => [
  { value: 'general', label: t('settings.modal.tavily.topic.general') },
  { value: 'news', label: t('settings.modal.tavily.topic.news') },
  { value: 'finance', label: t('settings.modal.tavily.topic.finance') },
];

export const getObsidianReadOptions = (): DropdownOption[] => [
  { value: 'selected', label: t('settings.modal.obsidian.read.selected') },
  { value: 'recent', label: t('settings.modal.obsidian.read.recent') },
  { value: 'active', label: t('settings.modal.obsidian.read.active') },
];

export const getObsidianWriteOptions = (): DropdownOption[] => [
  { value: 'insert-heading', label: t('settings.modal.obsidian.write.heading') },
  { value: 'append', label: t('settings.modal.obsidian.write.append') },
  { value: 'replace', label: t('settings.modal.obsidian.write.replace') },
];

export const getObsidianModeOptions = (): DropdownOption[] => [
  { value: 'vault', label: t('settings.modal.obsidian.mode.vault') },
  { value: 'plugin', label: t('settings.modal.obsidian.mode.plugin') },
];

const inputBaseClass =
  'rounded-md bg-[var(--bg-2)] [background-image:none] shadow-none px-2.5 py-1.5 text-sm font-sans text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[color:var(--ink-3)]';

export const fullInputClass = `w-full ${inputBaseClass}`;
export const smInputClass = `w-full sm:w-72 ${inputBaseClass}`;
