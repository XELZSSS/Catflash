import type { ObsidianReadMode, ObsidianSettings, ObsidianWriteMode } from '../types';
import { readAppStorage, writeAppStorage } from '../services/storageKeys';

export const DEFAULT_OBSIDIAN_READ_MODE: ObsidianReadMode = 'selected';
export const DEFAULT_OBSIDIAN_WRITE_MODE: ObsidianWriteMode = 'insert-heading';
export const DEFAULT_OBSIDIAN_HEADING = '## AI Draft';
export const DEFAULT_OBSIDIAN_API_URL = 'http://127.0.0.1:27123';

export const DEFAULT_OBSIDIAN_SETTINGS: ObsidianSettings = {
  mode: 'vault',
  vaultPath: '',
  notePath: '',
  apiUrl: DEFAULT_OBSIDIAN_API_URL,
  apiKey: '',
  readMode: DEFAULT_OBSIDIAN_READ_MODE,
  writeMode: DEFAULT_OBSIDIAN_WRITE_MODE,
  writeHeading: DEFAULT_OBSIDIAN_HEADING,
  previewBeforeWrite: true,
};

const normalizeSettings = (value?: Partial<ObsidianSettings>): ObsidianSettings => {
  return {
    ...DEFAULT_OBSIDIAN_SETTINGS,
    ...value,
    vaultPath: value?.vaultPath?.trim() ?? DEFAULT_OBSIDIAN_SETTINGS.vaultPath,
    notePath: value?.notePath?.trim() ?? DEFAULT_OBSIDIAN_SETTINGS.notePath,
    apiUrl: value?.apiUrl?.trim() ?? DEFAULT_OBSIDIAN_SETTINGS.apiUrl,
    apiKey: value?.apiKey?.trim() ?? DEFAULT_OBSIDIAN_SETTINGS.apiKey,
    writeHeading: value?.writeHeading?.trim() ?? DEFAULT_OBSIDIAN_HEADING,
    previewBeforeWrite:
      typeof value?.previewBeforeWrite === 'boolean'
        ? value.previewBeforeWrite
        : DEFAULT_OBSIDIAN_SETTINGS.previewBeforeWrite,
  };
};

export const loadObsidianSettings = (): ObsidianSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_OBSIDIAN_SETTINGS;
  }
  try {
    const stored = readAppStorage('obsidianSettings');
    if (!stored) return DEFAULT_OBSIDIAN_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<ObsidianSettings>;
    return normalizeSettings(parsed);
  } catch (error) {
    console.warn('Failed to load Obsidian settings:', error);
    return DEFAULT_OBSIDIAN_SETTINGS;
  }
};

export const saveObsidianSettings = (settings: ObsidianSettings): void => {
  if (typeof window === 'undefined') return;
  try {
    writeAppStorage('obsidianSettings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to persist Obsidian settings:', error);
  }
};

export const insertUnderHeading = (source: string, heading: string, addition: string): string => {
  const trimmedHeading = heading.trim();
  if (!trimmedHeading) {
    return `${source.trimEnd()}\n\n${addition.trim()}\n`;
  }

  const normalizedSource = source ?? '';
  const headingRegex = new RegExp(`^${escapeRegex(trimmedHeading)}\\s*$`, 'm');
  const match = normalizedSource.match(headingRegex);

  if (!match || match.index === undefined) {
    return `${normalizedSource.trimEnd()}\n\n${trimmedHeading}\n${addition.trim()}\n`;
  }

  const insertAt = match.index + match[0].length;
  const before = normalizedSource.slice(0, insertAt);
  const after = normalizedSource.slice(insertAt);
  const needsLeadingNewline = !after.startsWith('\n');
  const prefix = needsLeadingNewline ? '\n' : '';
  return `${before}${prefix}${addition.trim()}\n${after.replace(/^\n+/, '\n')}`;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
