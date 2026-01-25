import { ChatSession } from '../types';
import { GEMINI_MODEL_NAME, GEMINI_PROVIDER_ID } from '../services/providers/geminiProvider';

const STORAGE_KEY = 'gemini_chat_sessions';
const ACTIVE_SESSION_KEY = 'gemini_chat_active_session_id';

type StoredSession = Partial<ChatSession> &
  Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>;

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
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: StoredSession[] = stored ? JSON.parse(stored) : [];
    return parsed.map((session) => normalizeSession(session));
  } catch (error) {
    console.error('Failed to load sessions from storage:', error);
    return [];
  }
};

export const getActiveSessionId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    console.error('Failed to load active session id:', error);
    return null;
  }
};

export const setActiveSessionId = (sessionId: string): void => {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } catch (error) {
    console.error('Failed to persist active session id:', error);
  }
};

export const clearActiveSessionId = (): void => {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return [];
  }
};
