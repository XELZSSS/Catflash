import { ObsidianSettings, ProviderId, TavilyConfig } from '../../types';

export type ProviderSetting = {
  apiKey?: string;
  modelName: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
};

export type ProviderSettingsMap = Record<ProviderId, ProviderSetting>;

export type SaveSettingsPayload = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
};

export type SaveObsidianPayload = ObsidianSettings;
