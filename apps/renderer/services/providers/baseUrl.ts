import { ProviderId } from '../../types';
import { buildProxyUrl } from './proxy';

export type ProviderRegion = 'intl' | 'cn';

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1/';
const IFLOW_PROXY_BASE_URL = buildProxyUrl('/proxy/iflow');

const MINIMAX_BASE_URLS = {
  intl: buildProxyUrl('/proxy/minimax-intl'),
  cn: buildProxyUrl('/proxy/minimax-cn'),
} as const;

const MOONSHOT_BASE_URLS = {
  intl: buildProxyUrl('/proxy/moonshot-intl'),
  cn: buildProxyUrl('/proxy/moonshot-cn'),
} as const;

const GLM_BASE_URLS = {
  intl: buildProxyUrl('/proxy/glm-intl/chat/completions'),
  cn: buildProxyUrl('/proxy/glm-cn/chat/completions'),
} as const;

const normalizeEnvBaseUrl = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'undefined') return undefined;
  return resolveBaseUrl(trimmed);
};

const prefersChinaEndpoint = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const lang = navigator.language?.toLowerCase() ?? '';
  return lang.startsWith('zh');
};

export const resolveBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (typeof window !== 'undefined') {
    return new URL(trimmed, window.location.origin).toString();
  }
  return trimmed;
};

const resolveRegionalDefaultBaseUrl = (
  envOverride: string | undefined,
  urls: { intl: string; cn: string }
): string => {
  const resolvedOverride = normalizeEnvBaseUrl(envOverride);
  if (resolvedOverride) return resolvedOverride;
  if (prefersChinaEndpoint()) return resolveBaseUrl(urls.cn);
  return resolveBaseUrl(urls.intl);
};

export const getMinimaxBaseUrlForRegion = (region: ProviderRegion): string => {
  return resolveBaseUrl(region === 'cn' ? MINIMAX_BASE_URLS.cn : MINIMAX_BASE_URLS.intl);
};

export const getDefaultMinimaxBaseUrl = (): string => {
  return resolveRegionalDefaultBaseUrl(process.env.MINIMAX_BASE_URL, MINIMAX_BASE_URLS);
};

export const getMoonshotBaseUrlForRegion = (region: ProviderRegion): string => {
  return resolveBaseUrl(region === 'cn' ? MOONSHOT_BASE_URLS.cn : MOONSHOT_BASE_URLS.intl);
};

export const getDefaultMoonshotBaseUrl = (): string => {
  return resolveRegionalDefaultBaseUrl(process.env.MOONSHOT_BASE_URL, MOONSHOT_BASE_URLS);
};

export const getGlmBaseUrlForRegion = (region: ProviderRegion): string => {
  return resolveBaseUrl(region === 'cn' ? GLM_BASE_URLS.cn : GLM_BASE_URLS.intl);
};

export const getDefaultGlmBaseUrl = (): string => {
  return resolveRegionalDefaultBaseUrl(process.env.GLM_BASE_URL, GLM_BASE_URLS);
};

export const getDefaultIflowBaseUrl = (): string => {
  const resolvedOverride = normalizeEnvBaseUrl(process.env.IFLOW_BASE_URL);
  if (resolvedOverride) return resolvedOverride;
  return resolveBaseUrl(IFLOW_PROXY_BASE_URL);
};

export const getDefaultOpenAICompatibleBaseUrl = (): string | undefined => {
  return normalizeEnvBaseUrl(process.env.OPENAI_COMPATIBLE_BASE_URL);
};

export const getDefaultOllamaBaseUrl = (): string => {
  const resolvedOverride = normalizeEnvBaseUrl(process.env.OLLAMA_BASE_URL);
  if (resolvedOverride) return resolvedOverride;
  return OLLAMA_DEFAULT_BASE_URL;
};

export const resolveDefaultBaseUrlForProvider = (
  providerId: ProviderId
): string | undefined => {
  if (providerId === 'minimax') return getDefaultMinimaxBaseUrl();
  if (providerId === 'moonshot') return getDefaultMoonshotBaseUrl();
  if (providerId === 'glm') return getDefaultGlmBaseUrl();
  if (providerId === 'iflow') return getDefaultIflowBaseUrl();
  if (providerId === 'openai-compatible') return getDefaultOpenAICompatibleBaseUrl();
  if (providerId === 'ollama') return getDefaultOllamaBaseUrl();
  return undefined;
};

export const resolveBaseUrlForProvider = (
  providerId: ProviderId,
  override?: string
): string | undefined => {
  const nextUrl = override?.trim();
  if (nextUrl) return resolveBaseUrl(nextUrl);
  return resolveDefaultBaseUrlForProvider(providerId);
};

export const resolveBaseUrlForRegion = (providerId: ProviderId, region: ProviderRegion): string => {
  if (providerId === 'moonshot') return getMoonshotBaseUrlForRegion(region);
  if (providerId === 'glm') return getGlmBaseUrlForRegion(region);
  return getMinimaxBaseUrlForRegion(region);
};

