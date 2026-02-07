import { ObsidianSettings, ProviderId } from '../types';
import { ProviderSettings } from './providers/defaults';

export type ProviderSettingsMap = Record<ProviderId, ProviderSettings>;

export type SaveSettingsPayload = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: ProviderSettings['customHeaders'];
  tavily?: ProviderSettings['tavily'];
};

export type SaveObsidianPayload = ObsidianSettings;
