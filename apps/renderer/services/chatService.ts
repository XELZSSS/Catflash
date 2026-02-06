import { ChatMessage, ProviderId } from '../types';
import { ProviderRouter } from './providers/router';
import { getProviderDefaultModel, getProviderModels, listProviderIds } from './providers/registry';
import { getDefaultProviderSettings, ProviderSettings } from './providers/defaults';
import { ProviderChat } from './providers/types';
import {
  applyGlobalTavilyConfig,
  loadActiveProviderId,
  loadProviderSettings,
  normalizeProviderSettingsUpdate,
  persistActiveProviderId,
  persistProviderSettings,
} from './providerSettingsStore';

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
    this.provider.setModelName(settings?.modelName ?? getProviderDefaultModel(providerId));
    if (this.provider.setBaseUrl) {
      this.provider.setBaseUrl(settings?.baseUrl);
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
    const next = normalizeProviderSettingsUpdate(providerId, current, updates);
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
