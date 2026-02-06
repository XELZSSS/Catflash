import { ProviderId, TavilyConfig } from '../../types';

export type ActiveSettingsTab = 'provider' | 'search' | 'obsidian';

export type SettingsModalState = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders: Array<{ key: string; value: string }>;
  tavily: TavilyConfig;
  showApiKey: boolean;
  showTavilyKey: boolean;
  obsidianMode: import('../../types').ObsidianMode;
  obsidianVaultPath: string;
  obsidianNotePath: string;
  obsidianApiUrl: string;
  obsidianApiKey: string;
  obsidianReadMode: import('../../types').ObsidianReadMode;
  obsidianWriteMode: import('../../types').ObsidianWriteMode;
  obsidianWriteHeading: string;
  obsidianPreviewBeforeWrite: boolean;
  obsidianNotes: string[];
  obsidianNotesLoading: boolean;
  obsidianTesting: boolean;
  obsidianTestStatus: 'idle' | 'ok' | 'fail';
  obsidianSearchQuery: string;
  obsidianSearchResults: string[];
  obsidianSearchLoading: boolean;
  toolCallMaxRounds: string;
  activeTab: ActiveSettingsTab;
};

export type SettingsModalAction =
  | { type: 'replace'; payload: SettingsModalState }
  | { type: 'patch'; payload: Partial<SettingsModalState> }
  | {
      type: 'set_tavily';
      payload: { key: keyof TavilyConfig; value: TavilyConfig[keyof TavilyConfig] };
    }
  | { type: 'add_custom_header' }
  | { type: 'remove_custom_header'; payload: { index: number } }
  | { type: 'set_custom_header_key'; payload: { index: number; value: string } }
  | { type: 'set_custom_header_value'; payload: { index: number; value: string } };

export const settingsModalReducer = (
  state: SettingsModalState,
  action: SettingsModalAction
): SettingsModalState => {
  switch (action.type) {
    case 'replace':
      return action.payload;
    case 'patch':
      return { ...state, ...action.payload };
    case 'set_tavily':
      return {
        ...state,
        tavily: {
          ...state.tavily,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'add_custom_header':
      return {
        ...state,
        customHeaders: [...state.customHeaders, { key: '', value: '' }],
      };
    case 'remove_custom_header':
      return {
        ...state,
        customHeaders: state.customHeaders.filter((_, index) => index !== action.payload.index),
      };
    case 'set_custom_header_key':
      return {
        ...state,
        customHeaders: state.customHeaders.map((header, index) =>
          index === action.payload.index ? { ...header, key: action.payload.value } : header
        ),
      };
    case 'set_custom_header_value':
      return {
        ...state,
        customHeaders: state.customHeaders.map((header, index) =>
          index === action.payload.index ? { ...header, value: action.payload.value } : header
        ),
      };
    default:
      return state;
  }
};
