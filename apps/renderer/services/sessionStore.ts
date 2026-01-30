import { ChatSession } from '../types';
import { GEMINI_MODEL_NAME, GEMINI_PROVIDER_ID } from './providers/geminiProvider';

const STORAGE_KEY = 'gemini_chat_sessions';
const ACTIVE_SESSION_KEY = 'gemini_chat_active_session_id';

type StoredSession = Partial<ChatSession> &
  Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>;

const memoryStore = new Map<string, string>();

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.error('Failed to access localStorage:', error);
    return null;
  }
};

const storageGetItem = (key: string): string | null => {
  const storage = getStorage();
  if (storage) return storage.getItem(key);
  return memoryStore.get(key) ?? null;
};

const storageSetItem = (key: string, value: string): void => {
  const storage = getStorage();
  if (storage) {
    storage.setItem(key, value);
  } else {
    memoryStore.set(key, value);
  }
};

const storageRemoveItem = (key: string): void => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
  } else {
    memoryStore.delete(key);
  }
};

const normalizeSession = (session: StoredSession): ChatSession => {
  return {
    ...session,
    provider: session.provider ?? GEMINI_PROVIDER_ID,
    model: session.model ?? GEMINI_MODEL_NAME,
    messages: session.messages ?? [],
  };
};

export const getSessions = (): ChatSession[] => {
  try {
    const stored = storageGetItem(STORAGE_KEY);
    const parsed: StoredSession[] = stored ? JSON.parse(stored) : [];
    return parsed.map((session) => normalizeSession(session));
  } catch (error) {
    console.error('Failed to load sessions from storage:', error);
    return [];
  }
};

export const getActiveSessionId = (): string | null => {
  try {
    return storageGetItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    console.error('Failed to load active session id:', error);
    return null;
  }
};

export const setActiveSessionId = (sessionId: string): void => {
  try {
    storageSetItem(ACTIVE_SESSION_KEY, sessionId);
  } catch (error) {
    console.error('Failed to persist active session id:', error);
  }
};

export const clearActiveSessionId = (): void => {
  try {
    storageRemoveItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear active session id:', error);
  }
};

export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = getSessions();
    const normalized = normalizeSession(session);
    const index = sessions.findIndex((s) => s.id === normalized.id);

    if (index >= 0) {
      sessions[index] = normalized;
    } else {
      sessions.unshift(normalized);
    }

    // Sort by updated at desc
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    storageSetItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

export const updateSessionTitle = (sessionId: string, newTitle: string): ChatSession[] => {
  try {
    const sessions = getSessions();
    const index = sessions.findIndex((s) => s.id === sessionId);

    if (index >= 0) {
      sessions[index].title = newTitle;
      // We do not update 'updatedAt' here to prevent the session from jumping to the top of the list just for a rename
      storageSetItem(STORAGE_KEY, JSON.stringify(sessions));
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
    const sessions = getSessions().filter((s) => s.id !== sessionId);
    storageSetItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return [];
  }
};
