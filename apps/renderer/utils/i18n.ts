import { EN_TRANSLATIONS } from './i18n-locales/en';
import { ZH_CN_TRANSLATIONS } from './i18n-locales/zh-CN';
import { readAppStorage, writeAppStorage } from '../services/storageKeys';

export type Language = 'en' | 'zh-CN';

const DEFAULT_LANGUAGE: Language = 'en';

const getSystemLanguage = (): Language => {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('zh') ? 'zh-CN' : 'en';
};

const getStoredLanguage = (): Language | null => {
  const stored = readAppStorage('language');
  return stored === 'en' || stored === 'zh-CN' ? stored : null;
};

let currentLanguage: Language = getStoredLanguage() ?? getSystemLanguage();

export const getLanguage = (): Language => currentLanguage;

export const applyLanguageToDocument = (): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
  }
};

export const setLanguage = (language: Language): void => {
  currentLanguage = language;
  writeAppStorage('language', language);
  applyLanguageToDocument();
};

export const DEFAULT_SESSION_TITLES = {
  en: 'New Chat',
  'zh-CN': '新对话',
} as const;

export const isDefaultSessionTitle = (title?: string | null): boolean => {
  if (!title) return true;
  return Object.values(DEFAULT_SESSION_TITLES).includes(
    title as (typeof DEFAULT_SESSION_TITLES)[Language]
  );
};

const translations: Record<Language, Record<string, string>> = {
  en: EN_TRANSLATIONS as unknown as Record<string, string>,
  'zh-CN': ZH_CN_TRANSLATIONS as unknown as Record<string, string>,
};

export const t = (key: string): string =>
  translations[currentLanguage][key] ?? translations.en[key] ?? key;
