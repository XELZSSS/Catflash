import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, FormEvent, KeyboardEvent, MouseEvent, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/chatService';
import { ChatMessage, ChatSession, ProviderId, Role } from '../types';
import { ProviderSettingsMap } from '../services/settingsTypes';
import {
  clearActiveSessionId,
  deleteSession,
  getActiveSessionId,
  getSessions,
  saveSession,
  setActiveSessionId,
  updateSessionTitle,
} from '../utils/storage';
import { isDefaultSessionTitle } from '../utils/i18n';

type UseChatSessionsOptions = {
  chatService: ChatService;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  defaultSessionTitle: string;
  scrollToBottom: (behavior?: ScrollBehavior, force?: boolean) => void;
  setProviderSettings: Dispatch<SetStateAction<ProviderSettingsMap>>;
  setCurrentProviderId: Dispatch<SetStateAction<ProviderId>>;
  setCurrentModelName: Dispatch<SetStateAction<string>>;
  setCurrentApiKey: Dispatch<SetStateAction<string>>;
  isStreaming: boolean;
  isLoading: boolean;
  onCloseSidebar?: () => void;
};

export const useChatSessions = ({
  chatService,
  messages,
  setMessages,
  defaultSessionTitle,
  scrollToBottom,
  setProviderSettings,
  setCurrentProviderId,
  setCurrentModelName,
  setCurrentApiKey,
  isStreaming,
  isLoading,
  onCloseSidebar,
}: UseChatSessionsOptions) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => uuidv4());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const sessionsRef = useRef<ChatSession[]>([]);
  const saveSessionTimerRef = useRef<number | null>(null);

  const activateSessionContext = useCallback(
    (session: ChatSession) => {
      setCurrentSessionId(session.id);
      setMessages(session.messages);

      chatService.setProvider(session.provider);
      chatService.setModelName(session.model);
      setProviderSettings(chatService.getAllProviderSettings());
      setCurrentProviderId(session.provider);
      setCurrentModelName(session.model);
      setCurrentApiKey(chatService.getApiKey() ?? '');

      chatService.startChatWithHistory(session.messages);
    },
    [
      chatService,
      setCurrentApiKey,
      setCurrentModelName,
      setCurrentProviderId,
      setMessages,
      setProviderSettings,
    ]
  );

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    return () => {
      if (saveSessionTimerRef.current !== null) {
        window.clearTimeout(saveSessionTimerRef.current);
      }
    };
  }, []);

  const scheduleSessionSave = useCallback((session: ChatSession) => {
    if (saveSessionTimerRef.current !== null) {
      window.clearTimeout(saveSessionTimerRef.current);
    }
    saveSessionTimerRef.current = window.setTimeout(() => {
      saveSession(session);
      saveSessionTimerRef.current = null;
    }, 400);
  }, []);

  const upsertSessionState = useCallback((session: ChatSession) => {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === session.id);
      const next = [...prev];
      if (index >= 0) {
        next[index] = session;
      } else {
        next.unshift(session);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const loadedSessions = getSessions();
    setSessions(loadedSessions);

    const activeId = getActiveSessionId();
    const activeSession =
      (activeId && loadedSessions.find((s) => s.id === activeId)) ?? loadedSessions[0];

    if (!activeSession) {
      const newId = uuidv4();
      setCurrentSessionId(newId);
      setActiveSessionId(newId);
      return;
    }

    activateSessionContext(activeSession);
    requestAnimationFrame(() => scrollToBottom('auto', true));
  }, [activateSessionContext, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0) {
      const existingSession = sessionsRef.current.find((s) => s.id === currentSessionId);

      let title = existingSession?.title || defaultSessionTitle;
      const firstUserMessage = messages.find((msg) => msg.role === Role.User);
      if (firstUserMessage && (!existingSession || isDefaultSessionTitle(existingSession.title))) {
        title = firstUserMessage.text.trim() || defaultSessionTitle;
      }

      const session: ChatSession = {
        id: currentSessionId,
        title: title,
        messages,
        provider: existingSession?.provider ?? chatService.getProviderId(),
        model: existingSession?.model ?? chatService.getModelName(),
        createdAt: existingSession?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      upsertSessionState(session);
      scheduleSessionSave(session);
    }
  }, [
    chatService,
    currentSessionId,
    defaultSessionTitle,
    messages,
    scheduleSessionSave,
    upsertSessionState,
  ]);

  const startNewChat = useCallback(() => {
    chatService.resetChat();
    const newId = uuidv4();
    setCurrentSessionId(newId);
    setActiveSessionId(newId);
    setMessages([]);
    setSearchQuery('');
    if (onCloseSidebar) {
      onCloseSidebar();
    }
  }, [chatService, onCloseSidebar, setMessages]);

  const handleLoadSession = useCallback(
    (session: ChatSession) => {
      if (isStreaming || isLoading) return;
      if (editingSessionId === session.id) return;

      if (session.id === currentSessionId) {
        if (onCloseSidebar) {
          onCloseSidebar();
        }
        return;
      }

      setActiveSessionId(session.id);
      activateSessionContext(session);

      if (onCloseSidebar) {
        onCloseSidebar();
      }
      requestAnimationFrame(() => scrollToBottom('auto', true));
    },
    [
      activateSessionContext,
      currentSessionId,
      editingSessionId,
      isLoading,
      isStreaming,
      onCloseSidebar,
      scrollToBottom,
    ]
  );

  const handleDeleteSession = useCallback(
    (e: MouseEvent, sessionId: string) => {
      e.stopPropagation();
      const updatedSessions = deleteSession(sessionId);
      setSessions(updatedSessions);

      if (sessionId === currentSessionId) {
        clearActiveSessionId();
        startNewChat();
      }
    },
    [currentSessionId, startNewChat]
  );

  const handleStartEdit = useCallback((e: MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleInput(session.title);
  }, []);

  const handleCancelEdit = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setEditTitleInput('');
  }, []);

  const handleSaveEdit = useCallback(
    (e: FormEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (editingSessionId && editTitleInput.trim()) {
        const updated = updateSessionTitle(editingSessionId, editTitleInput.trim());
        setSessions(updated);
        setEditingSessionId(null);
        setEditTitleInput('');
      }
    },
    [editTitleInput, editingSessionId]
  );

  const handleEditInputClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (editingSessionId && editTitleInput.trim()) {
          const updated = updateSessionTitle(editingSessionId, editTitleInput.trim());
          setSessions(updated);
          setEditingSessionId(null);
          setEditTitleInput('');
        }
      } else if (e.key === 'Escape') {
        setEditingSessionId(null);
      }
    },
    [editTitleInput, editingSessionId]
  );

  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [sessions, searchQuery, sortBy, sortOrder]);

  return {
    sessions,
    filteredSessions,
    currentSessionId,
    searchQuery,
    sortBy,
    sortOrder,
    editingSessionId,
    editTitleInput,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    setEditTitleInput,
    startNewChat,
    handleLoadSession,
    handleDeleteSession,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditInputClick,
    handleEditKeyDown,
  };
};
