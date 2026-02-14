import { ChatSession } from '../types';
import { formatMessageTime } from '../utils/time';
import { AppStorageKey, readAppStorage, removeAppStorage, writeAppStorage } from './storageKeys';

const DEFAULT_PROVIDER_ID = 'gemini' as const;
const DEFAULT_MODEL_NAME = 'gemini-2.5-flash';

const SESSIONS_STORAGE_KEY: AppStorageKey = 'sessions';
const ACTIVE_SESSION_STORAGE_KEY: AppStorageKey = 'activeSessionId';

type StoredSession = Partial<ChatSession> &
  Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>;

const memoryStore = new Map<AppStorageKey, string>();
let sessionsCache: ChatSession[] | null = null;

const storageGetItem = (key: AppStorageKey): string | null => {
  const storageValue = readAppStorage(key);
  if (storageValue !== null) {
    memoryStore.set(key, storageValue);
    return storageValue;
  }
  return memoryStore.get(key) ?? null;
};

const storageSetItem = (key: AppStorageKey, value: string): void => {
  writeAppStorage(key, value);
  memoryStore.set(key, value);
};

const storageRemoveItem = (key: AppStorageKey): void => {
  removeAppStorage(key);
  memoryStore.delete(key);
};

const normalizeSession = (session: StoredSession): ChatSession => {
  return {
    ...session,
    provider: session.provider ?? DEFAULT_PROVIDER_ID,
    model: session.model ?? DEFAULT_MODEL_NAME,
    messages: (session.messages ?? []).map((message) => ({
      ...message,
      timeLabel: message.timeLabel ?? formatMessageTime(message.timestamp),
    })),
  };
};

const cloneSessions = (sessions: ChatSession[]): ChatSession[] =>
  sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  }));

const loadSessionsFromStorage = (): ChatSession[] => {
  try {
    const stored = storageGetItem(SESSIONS_STORAGE_KEY);
    const parsed: StoredSession[] = stored ? JSON.parse(stored) : [];
    return parsed.map((session) => normalizeSession(session));
  } catch (error) {
    console.error('Failed to load sessions from storage:', error);
    return [];
  }
};

const getCachedSessions = (): ChatSession[] => {
  if (!sessionsCache) {
    sessionsCache = loadSessionsFromStorage();
  }
  return sessionsCache;
};

const persistSessions = (sessions: ChatSession[]): void => {
  storageSetItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  sessionsCache = sessions;
};

export const getSessions = (): ChatSession[] => {
  return cloneSessions(getCachedSessions());
};

export const getActiveSessionId = (): string | null => {
  try {
    return storageGetItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load active session id:', error);
    return null;
  }
};

export const setActiveSessionId = (sessionId: string): void => {
  try {
    storageSetItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  } catch (error) {
    console.error('Failed to persist active session id:', error);
  }
};

export const clearActiveSessionId = (): void => {
  try {
    storageRemoveItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear active session id:', error);
  }
};

export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = cloneSessions(getCachedSessions());
    const normalized = normalizeSession(session);
    const index = sessions.findIndex((s) => s.id === normalized.id);

    if (index >= 0) {
      sessions[index] = normalized;
    } else {
      sessions.unshift(normalized);
    }

    // Sort by updated at desc
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    persistSessions(sessions);
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

export const updateSessionTitle = (sessionId: string, newTitle: string): ChatSession[] => {
  try {
    const sessions = cloneSessions(getCachedSessions());
    const index = sessions.findIndex((s) => s.id === sessionId);

    if (index >= 0) {
      sessions[index].title = newTitle;
      // We do not update 'updatedAt' here to prevent the session from jumping to the top of the list just for a rename
      persistSessions(sessions);
      return sessions;
    }
    return sessions;
  } catch (error) {
    console.error('Failed to update session title:', error);
    return [];
  }
};

export const deleteSession = (sessionId: string): ChatSession[] => {
  try {
    const sessions = cloneSessions(getCachedSessions()).filter((s) => s.id !== sessionId);
    persistSessions(sessions);
    return sessions;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return [];
  }
};
