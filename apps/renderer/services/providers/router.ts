import { ProviderId } from '../../types';
import { createProvider } from './registry';
import { ProviderChat } from './types';

export class ProviderRouter {
  private activeProviderId: ProviderId;
  private activeProvider: ProviderChat;

  constructor(initialProvider: ProviderId = 'gemini') {
    this.activeProviderId = initialProvider;
    this.activeProvider = createProvider(initialProvider);
  }

  getActiveProviderId(): ProviderId {
    return this.activeProviderId;
  }

  getActiveProvider(): ProviderChat {
    return this.activeProvider;
  }

  setActiveProvider(id: ProviderId): ProviderChat {
    if (id === this.activeProviderId) {
      return this.activeProvider;
    }

    this.activeProviderId = id;
    this.activeProvider = createProvider(id);
    return this.activeProvider;
  }
}
