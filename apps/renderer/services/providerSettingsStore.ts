import { ProviderId } from '../types';
import { buildDefaultProviderSettings, ProviderSettings } from './providers/defaults';
import { getProviderDefaultModel, listProviderIds } from './providers/registry';
import { normalizeTavilyConfig } from './providers/tavily';

const PROVIDER_SETTINGS_KEY = 'gemini_chat_provider_settings';
const ACTIVE_PROVIDER_KEY = 'gemini_chat_active_provider';

const sanitizeApiKey = (value?: string): string | undefined => {
  if (!value || value === 'undefined') return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^PLACEHOLDER_/i.test(trimmed)) return undefined;
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeModelName = (providerId: ProviderId, value?: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : getProviderDefaultModel(providerId);
};

const normalizeBaseUrl = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeCustomHeaders = (
  headers?: Array<{ key?: string; value?: string }>
): Array<{ key: string; value: string }> | undefined => {
  if (!headers) return undefined;
  const sanitized = headers
    .map((header) => ({
      key: header.key?.trim(),
      value: header.value?.trim(),
    }))
    .filter((header) => header.key && header.value) as Array<{ key: string; value: string }>;
  return sanitized.length > 0 ? sanitized : [];
};

const resolveGlobalTavilyConfig = (
  settings: Record<ProviderId, ProviderSettings>
): ProviderSettings['tavily'] => {
  for (const id of listProviderIds()) {
    const tavily = normalizeTavilyConfig(settings[id]?.tavily);
    if (tavily) return tavily;
  }
  return undefined;
};

export const applyGlobalTavilyConfig = (
  settings: Record<ProviderId, ProviderSettings>,
  tavily: ProviderSettings['tavily']
): Record<ProviderId, ProviderSettings> => {
  const next = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    next[id] = { ...settings[id], tavily };
  }
  return next;
};

export const loadActiveProviderId = (): ProviderId => {
  const available = listProviderIds();
  if (typeof window === 'undefined') {
    return available[0] ?? 'gemini';
  }
  try {
    const stored = window.localStorage.getItem(ACTIVE_PROVIDER_KEY) as ProviderId | null;
    if (stored && available.includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.error('Failed to load active provider:', error);
  }
  return available[0] ?? 'gemini';
};

export const persistActiveProviderId = (providerId: ProviderId): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_PROVIDER_KEY, providerId);
  } catch (error) {
    console.error('Failed to persist active provider:', error);
  }
};

export const loadProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  let defaults = buildDefaultProviderSettings();
  if (typeof window === 'undefined') {
    const globalTavily = resolveGlobalTavilyConfig(defaults);
    return applyGlobalTavilyConfig(defaults, globalTavily);
  }

  try {
    const stored = window.localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (!stored) {
      const globalTavily = resolveGlobalTavilyConfig(defaults);
      return applyGlobalTavilyConfig(defaults, globalTavily);
    }

    const parsed = JSON.parse(stored) as Partial<Record<ProviderId, Partial<ProviderSettings>>>;
    for (const id of listProviderIds()) {
      const storedSettings = parsed[id];
      if (!storedSettings) continue;
      defaults[id] = {
        apiKey: sanitizeApiKey(storedSettings.apiKey) ?? defaults[id].apiKey,
        modelName: normalizeModelName(id, storedSettings.modelName),
        baseUrl: normalizeBaseUrl(storedSettings.baseUrl) ?? defaults[id].baseUrl,
        customHeaders:
          normalizeCustomHeaders(storedSettings.customHeaders) ?? defaults[id].customHeaders,
        tavily: normalizeTavilyConfig(storedSettings.tavily) ?? defaults[id].tavily,
      };
    }
    const globalTavily = resolveGlobalTavilyConfig(defaults);
    defaults = applyGlobalTavilyConfig(defaults, globalTavily);
    return defaults;
  } catch (error) {
    console.error('Failed to load provider settings:', error);
    const globalTavily = resolveGlobalTavilyConfig(defaults);
    return applyGlobalTavilyConfig(defaults, globalTavily);
  }
};

export const persistProviderSettings = (settings: Record<ProviderId, ProviderSettings>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist provider settings:', error);
  }
};

export const normalizeProviderSettingsUpdate = (
  providerId: ProviderId,
  current: ProviderSettings,
  updates: Partial<ProviderSettings>
): ProviderSettings => {
  return {
    apiKey: updates.apiKey !== undefined ? sanitizeApiKey(updates.apiKey) : current.apiKey,
    modelName:
      updates.modelName !== undefined
        ? normalizeModelName(providerId, updates.modelName)
        : current.modelName,
    baseUrl: updates.baseUrl !== undefined ? normalizeBaseUrl(updates.baseUrl) : current.baseUrl,
    customHeaders:
      updates.customHeaders !== undefined
        ? normalizeCustomHeaders(updates.customHeaders)
        : current.customHeaders,
    tavily: updates.tavily !== undefined ? normalizeTavilyConfig(updates.tavily) : current.tavily,
  };
};
