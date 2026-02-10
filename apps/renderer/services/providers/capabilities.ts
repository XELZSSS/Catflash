import { ProviderId } from '../../types';

export type ProviderCapabilities = {
  supportsTavily: boolean;
  supportsImageGeneration: boolean;
  supportsBaseUrl: boolean;
  supportsCustomHeaders: boolean;
  supportsRegion: boolean;
};

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsTavily: false,
  supportsImageGeneration: false,
  supportsBaseUrl: false,
  supportsCustomHeaders: false,
  supportsRegion: false,
};

export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  openai: {
    supportsTavily: true,
    supportsImageGeneration: true,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: false,
  },
  'openai-compatible': {
    supportsTavily: true,
    supportsImageGeneration: true,
    supportsBaseUrl: true,
    supportsCustomHeaders: true,
    supportsRegion: false,
  },
  ollama: {
    supportsTavily: false,
    supportsImageGeneration: true,
    supportsBaseUrl: true,
    supportsCustomHeaders: false,
    supportsRegion: false,
  },
  xai: {
    supportsTavily: true,
    supportsImageGeneration: true,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: false,
  },
  gemini: {
    supportsTavily: true,
    supportsImageGeneration: true,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: false,
  },
  deepseek: {
    supportsTavily: true,
    supportsImageGeneration: false,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: false,
  },
  glm: {
    supportsTavily: true,
    supportsImageGeneration: true,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: true,
  },
  minimax: {
    supportsTavily: true,
    supportsImageGeneration: true,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: true,
  },
  moonshot: {
    supportsTavily: true,
    supportsImageGeneration: false,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: true,
  },
  iflow: {
    supportsTavily: true,
    supportsImageGeneration: false,
    supportsBaseUrl: false,
    supportsCustomHeaders: false,
    supportsRegion: false,
  },
};

export const getProviderCapabilities = (providerId: ProviderId): ProviderCapabilities => {
  return PROVIDER_CAPABILITIES[providerId] ?? DEFAULT_CAPABILITIES;
};

export const supportsProviderTavily = (providerId: ProviderId): boolean => {
  return getProviderCapabilities(providerId).supportsTavily;
};

export const supportsProviderImageGeneration = (providerId: ProviderId): boolean => {
  return getProviderCapabilities(providerId).supportsImageGeneration;
};
