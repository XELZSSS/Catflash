import { ChatMessage, ProviderId } from '../types';
import { ProviderRouter } from './providers/router';
import { getProviderDefaultModel, getProviderModels, listProviderIds } from './providers/registry';
import {
  buildDefaultProviderSettings,
  getDefaultProviderSettings,
  ProviderSettings,
} from './providers/defaults';
import { normalizeTavilyConfig } from './providers/tavily';
import { ProviderChat } from './providers/types';

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

const applyGlobalTavilyConfig = (
  settings: Record<ProviderId, ProviderSettings>,
  tavily: ProviderSettings['tavily']
): Record<ProviderId, ProviderSettings> => {
  const next = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    next[id] = { ...settings[id], tavily };
  }
  return next;
};

const loadActiveProviderId = (): ProviderId => {
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

const persistActiveProviderId = (providerId: ProviderId): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_PROVIDER_KEY, providerId);
  } catch (error) {
    console.error('Failed to persist active provider:', error);
  }
};

const loadProviderSettings = (): Record<ProviderId, ProviderSettings> => {
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

const persistProviderSettings = (settings: Record<ProviderId, ProviderSettings>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist provider settings:', error);
  }
};

export class ChatService {
  private router: ProviderRouter;
  private provider: ProviderChat;
  private providerSettings: Record<ProviderId, ProviderSettings>;
  private searchEnabled = true;

  constructor() {
    this.providerSettings = loadProviderSettings();
    const initialProviderId = loadActiveProviderId();
    this.router = new ProviderRouter(initialProviderId);
    this.provider = this.router.getActiveProvider();
    this.applyProviderSettings(this.getProviderId());
  }

  private applyProviderSettings(providerId: ProviderId): void {
    const settings = this.providerSettings[providerId];
    this.provider.setApiKey(settings?.apiKey);
    this.provider.setModelName(normalizeModelName(providerId, settings?.modelName));
    if (this.provider.setBaseUrl) {
      this.provider.setBaseUrl(normalizeBaseUrl(settings?.baseUrl));
    }
    if (this.provider.setCustomHeaders) {
      this.provider.setCustomHeaders(settings?.customHeaders ?? []);
    }
    if (this.provider.setTavilyConfig) {
      this.provider.setTavilyConfig(this.searchEnabled ? settings?.tavily : undefined);
    }
  }

  private updateSettings(
    providerId: ProviderId,
    updates: Partial<ProviderSettings>
  ): ProviderSettings {
    const current = this.providerSettings[providerId] ?? getDefaultProviderSettings(providerId);
    const next: ProviderSettings = {
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
    if (updates.tavily !== undefined) {
      this.providerSettings = applyGlobalTavilyConfig(
        { ...this.providerSettings, [providerId]: next },
        next.tavily
      );
    } else {
      this.providerSettings = { ...this.providerSettings, [providerId]: next };
    }
    persistProviderSettings(this.providerSettings);
    if (providerId === this.getProviderId()) {
      this.applyProviderSettings(providerId);
    }
    return next;
  }

  getProviderId(): ProviderId {
    return this.provider.getId();
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  setProvider(id: ProviderId): void {
    this.provider = this.router.setActiveProvider(id);
    this.applyProviderSettings(id);
    persistActiveProviderId(id);
  }

  setSearchEnabled(enabled: boolean): void {
    this.searchEnabled = enabled;
    this.applyProviderSettings(this.getProviderId());
  }

  setModelName(model: string): void {
    this.updateSettings(this.getProviderId(), { modelName: model });
  }

  getApiKey(): string | undefined {
    return this.provider.getApiKey();
  }

  setApiKey(apiKey?: string): void {
    this.updateSettings(this.getProviderId(), { apiKey });
  }

  getProviderSettings(providerId: ProviderId = this.getProviderId()): ProviderSettings {
    const settings = this.providerSettings[providerId];
    return { ...settings };
  }

  getAllProviderSettings(): Record<ProviderId, ProviderSettings> {
    const result = {} as Record<ProviderId, ProviderSettings>;
    for (const id of listProviderIds()) {
      result[id] = { ...this.providerSettings[id] };
    }
    return result;
  }

  updateProviderSettings(
    providerId: ProviderId,
    updates: Partial<ProviderSettings>
  ): ProviderSettings {
    return this.updateSettings(providerId, updates);
  }

  getAvailableProviders(): ProviderId[] {
    return listProviderIds();
  }

  getAvailableModels(id: ProviderId = this.getProviderId()): string[] {
    return getProviderModels(id);
  }

  /**
   * Resets the current chat session using the current configuration.
   */
  resetChat() {
    this.provider.resetChat();
  }

  /**
   * Starts a chat session with previous history.
   */
  async startChatWithHistory(messages: ChatMessage[]) {
    await this.provider.startChatWithHistory(messages);
  }

  /**
   * Generates a concise title for the chat based on the first message.
   */
  /**
   * Sends a message to the model and yields chunks of the response text as they stream in.
   */
  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    yield* this.provider.sendMessageStream(message);
  }
}

// Singleton-ish instance for simple usage, though App can instantiate its own
export const chatService = new ChatService();
