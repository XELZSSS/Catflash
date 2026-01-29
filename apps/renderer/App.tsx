import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from './services/chatService';
import { ChatMessage, ProviderId, Role } from './types';
import { t, getLanguage, setLanguage, applyLanguageToDocument, Language } from './utils/i18n';
import { useChatSessions } from './hooks/useChatSessions';
import { useStreamingMessages } from './hooks/useStreamingMessages';
import Sidebar from './components/Sidebar';
import ChatMain from './components/ChatMain';
import TitleBar from './components/TitleBar';
import { insertUnderHeading, loadObsidianSettings, saveObsidianSettings } from './utils/obsidian';

const SettingsModal = lazy(() => import('./components/SettingsModal'));

// Instantiate service outside component
const chatService = new ChatService();
const SEARCH_ENABLED_KEY = 'gemini_chat_search_enabled';

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providerSettings, setProviderSettings] = useState(() =>
    chatService.getAllProviderSettings()
  );
  const [currentProviderId, setCurrentProviderId] = useState(chatService.getProviderId());
  const [currentModelName, setCurrentModelName] = useState(chatService.getModelName());
  const [currentApiKey, setCurrentApiKey] = useState(chatService.getApiKey() ?? '');
  const [language, setLanguageState] = useState<Language>(() => getLanguage());
  const [obsidianSettings, setObsidianSettings] = useState(loadObsidianSettings());
  const [obsidianBusy, setObsidianBusy] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(() => {
    try {
      const stored = window.localStorage.getItem(SEARCH_ENABLED_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      console.warn('Failed to load search toggle from storage:', error);
    }
    return true;
  });
  const defaultSessionTitle = t('sidebar.newChat');

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.gero;
    document.body.classList.toggle('electron', isElectron);
  }, []);

  const streaming = useStreamingMessages({
    chatService,
    messages,
    setMessages,
  });

  const {
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
  } = useChatSessions({
    chatService,
    messages,
    setMessages,
    defaultSessionTitle,
    scrollToBottom: streaming.scrollToBottom,
    setProviderSettings,
    setCurrentProviderId,
    setCurrentModelName,
    setCurrentApiKey,
    isStreaming: streaming.isStreaming,
    isLoading: streaming.isLoading,
    onCloseSidebar: () => setIsSidebarOpen(false),
  });

  useEffect(() => {
    applyLanguageToDocument();
    document.title = t('app.title');
    window.gero?.setTrayLanguage?.(language);
    window.gero?.setTrayLabels?.({
      open: t('tray.open'),
      hide: t('tray.hide'),
      toggleDevTools: t('tray.toggleDevTools'),
      quit: t('tray.quit'),
    });
  }, [language]);

  const tavilyAvailable = Boolean(providerSettings[currentProviderId]?.tavily?.apiKey);
  const obsidianAvailable =
    obsidianSettings.mode === 'plugin'
      ? Boolean(obsidianSettings.apiUrl)
      : typeof window !== 'undefined' && !!window.gero?.obsidian;

  useEffect(() => {
    if (!tavilyAvailable) {
      setSearchEnabled(false);
      chatService.setSearchEnabled(false);
      return;
    }
    chatService.setSearchEnabled(searchEnabled);
    try {
      window.localStorage.setItem(SEARCH_ENABLED_KEY, String(searchEnabled));
    } catch (error) {
      console.warn('Failed to persist search toggle:', error);
    }
  }, [tavilyAvailable, searchEnabled, currentProviderId]);

  const handleNewChatClick = useCallback(() => {
    if (streaming.isStreaming || streaming.isLoading) return;
    startNewChat();
  }, [startNewChat, streaming.isLoading, streaming.isStreaming]);

  const handleSaveSettings = (value: {
    providerId: ProviderId;
    modelName: string;
    apiKey: string;
    baseUrl?: string;
    customHeaders?: Array<{ key: string; value: string }>;
    tavily?: import('./types').TavilyConfig;
  }) => {
    chatService.setProvider(value.providerId);
    const updatedSettings = chatService.updateProviderSettings(value.providerId, {
      apiKey: value.apiKey,
      modelName: value.modelName,
      baseUrl: value.baseUrl,
      customHeaders: value.customHeaders,
      tavily: value.tavily,
    });
    setProviderSettings(chatService.getAllProviderSettings());
    setCurrentProviderId(value.providerId);
    setCurrentModelName(updatedSettings.modelName);
    setCurrentApiKey(updatedSettings.apiKey ?? '');
    const prev = providerSettings[value.providerId];
    const shouldRestart =
      value.providerId !== currentProviderId ||
      !prev ||
      prev.modelName !== updatedSettings.modelName ||
      (prev.apiKey ?? '') !== (updatedSettings.apiKey ?? '') ||
      (prev.baseUrl ?? '') !== (updatedSettings.baseUrl ?? '') ||
      JSON.stringify(prev.customHeaders ?? []) !==
        JSON.stringify(updatedSettings.customHeaders ?? []) ||
      JSON.stringify(prev.tavily ?? {}) !== JSON.stringify(updatedSettings.tavily ?? {});
    if (shouldRestart) {
      startNewChat(); // Apply settings by starting a new chat
    }
  };

  const handleSaveObsidian = (value: import('./types').ObsidianSettings) => {
    setObsidianSettings(value);
    saveObsidianSettings(value);
  };

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    window.gero?.setTrayLanguage?.(nextLanguage);
    window.gero?.setTrayLabels?.({
      open: t('tray.open'),
      hide: t('tray.hide'),
      toggleDevTools: t('tray.toggleDevTools'),
      quit: t('tray.quit'),
    });
  };

  const pushObsidianMessage = (text: string, isError = false) => {
    setMessages((prev) => [
      ...prev,
      {
        id: uuidv4(),
        role: Role.Model,
        text,
        timestamp: Date.now(),
        isError,
      },
    ]);
  };

  const getObsidianApiConfig = () => {
    const baseUrl = obsidianSettings.apiUrl?.trim();
    if (!baseUrl) {
      throw new Error('Missing Obsidian API URL');
    }
    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      headers: obsidianSettings.apiKey
        ? { Authorization: `Bearer ${obsidianSettings.apiKey}` }
        : undefined,
    };
  };

  const fetchObsidianApi = async (path: string, init?: RequestInit) => {
    const { baseUrl, headers } = getObsidianApiConfig();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(headers ?? {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Obsidian API error: ${response.status}`);
    }
    return response;
  };

  const getActiveNote = async () => {
    const response = await fetchObsidianApi('/active/', {
      headers: { Accept: 'application/vnd.olrapi.note+json' },
    });
    const payload = (await response.json()) as {
      path?: string;
      content?: string;
      data?: string;
      text?: string;
    };
    return {
      path: payload.path ?? '',
      content: payload.content ?? payload.data ?? payload.text ?? '',
    };
  };

  const resolveObsidianNotePath = async (): Promise<string | null> => {
    if (obsidianSettings.mode === 'plugin') {
      if (obsidianSettings.readMode === 'active') {
        const active = await getActiveNote();
        return active.path || null;
      }
      return obsidianSettings.notePath?.trim() || null;
    }
    if (!obsidianSettings.vaultPath) return null;
    if (obsidianSettings.readMode === 'recent') {
      if (!window.gero?.obsidian?.getRecentNote) return null;
      return window.gero.obsidian.getRecentNote(obsidianSettings.vaultPath);
    }
    return obsidianSettings.notePath?.trim() || null;
  };

  const handleReadObsidian = async () => {
    if (obsidianBusy) return;
    setObsidianBusy(true);
    try {
      if (obsidianSettings.mode === 'plugin') {
        if (!obsidianSettings.apiUrl) {
          pushObsidianMessage(t('obsidian.error.noApiUrl'), true);
          return;
        }
        const notePath = await resolveObsidianNotePath();
        if (!notePath) {
          pushObsidianMessage(t('obsidian.error.noNote'), true);
          return;
        }
        const content =
          obsidianSettings.readMode === 'active'
            ? (await getActiveNote()).content
            : await (await fetchObsidianApi(`/vault/${encodeURIComponent(notePath)}`)).text();
        const prompt = `${t('obsidian.prompt.prefix')}: ${notePath}\n\n${content}`;
        await streaming.handleSendMessage(prompt);
        return;
      }

      if (!obsidianSettings.vaultPath) {
        pushObsidianMessage(t('obsidian.error.noVault'), true);
        return;
      }
      if (!window.gero?.obsidian?.readNote) {
        pushObsidianMessage(t('obsidian.error.readFailed'), true);
        return;
      }
      const notePath = await resolveObsidianNotePath();
      if (!notePath) {
        pushObsidianMessage(t('obsidian.error.noNote'), true);
        return;
      }
      const content = await window.gero.obsidian.readNote(obsidianSettings.vaultPath, notePath);
      const prompt = `${t('obsidian.prompt.prefix')}: ${notePath}\n\n${content}`;
      await streaming.handleSendMessage(prompt);
    } catch (error) {
      console.error('Failed to read Obsidian note:', error);
      pushObsidianMessage(t('obsidian.error.readFailed'), true);
    } finally {
      setObsidianBusy(false);
    }
  };

  const handleWriteObsidian = async () => {
    if (obsidianBusy) return;
    const lastReply = [...messages]
      .reverse()
      .find((msg) => msg.role === Role.Model && !msg.isError)?.text;
    if (!lastReply) {
      pushObsidianMessage(t('obsidian.error.noReply'), true);
      return;
    }
    setObsidianBusy(true);
    try {
      if (obsidianSettings.mode === 'plugin') {
        if (!obsidianSettings.apiUrl) {
          pushObsidianMessage(t('obsidian.error.noApiUrl'), true);
          return;
        }
        const notePath = await resolveObsidianNotePath();
        if (!notePath) {
          pushObsidianMessage(t('obsidian.error.noNote'), true);
          return;
        }
        const activeNote =
          obsidianSettings.readMode === 'active' ? await getActiveNote() : undefined;
        const current =
          activeNote?.content ??
          (await (await fetchObsidianApi(`/vault/${encodeURIComponent(notePath)}`)).text());
        const trimmedReply = lastReply.trim();
        let nextContent = current;
        if (obsidianSettings.writeMode === 'replace') {
          nextContent = `${trimmedReply}\n`;
        } else if (obsidianSettings.writeMode === 'append') {
          nextContent = `${current.trimEnd()}\n\n${trimmedReply}\n`;
        } else {
          nextContent = insertUnderHeading(current, obsidianSettings.writeHeading, trimmedReply);
        }

        if (obsidianSettings.previewBeforeWrite) {
          const preview =
            nextContent.length > 1200 ? `${nextContent.slice(0, 1200)}...` : nextContent;
          const confirmed = window.confirm(`${t('obsidian.confirm.write')}\n\n${preview}`);
          if (!confirmed) {
            return;
          }
        }

        await fetchObsidianApi(`/vault/${encodeURIComponent(notePath)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/markdown' },
          body: nextContent,
        });
        pushObsidianMessage(`${t('obsidian.info.saved')} ${notePath}`);
        return;
      }

      if (!obsidianSettings.vaultPath) {
        pushObsidianMessage(t('obsidian.error.noVault'), true);
        return;
      }
      if (!window.gero?.obsidian?.readNote || !window.gero?.obsidian?.writeNote) {
        pushObsidianMessage(t('obsidian.error.writeFailed'), true);
        return;
      }
      const notePath = await resolveObsidianNotePath();
      if (!notePath) {
        pushObsidianMessage(t('obsidian.error.noNote'), true);
        return;
      }
      const current = await window.gero.obsidian.readNote(obsidianSettings.vaultPath, notePath);
      const trimmedReply = lastReply.trim();
      let nextContent = current;
      if (obsidianSettings.writeMode === 'replace') {
        nextContent = `${trimmedReply}\n`;
      } else if (obsidianSettings.writeMode === 'append') {
        nextContent = `${current.trimEnd()}\n\n${trimmedReply}\n`;
      } else {
        nextContent = insertUnderHeading(current, obsidianSettings.writeHeading, trimmedReply);
      }

      if (obsidianSettings.previewBeforeWrite) {
        const preview =
          nextContent.length > 1200 ? `${nextContent.slice(0, 1200)}...` : nextContent;
        const confirmed = window.confirm(`${t('obsidian.confirm.write')}\n\n${preview}`);
        if (!confirmed) {
          return;
        }
      }

      await window.gero.obsidian.writeNote(obsidianSettings.vaultPath, notePath, nextContent);
      pushObsidianMessage(`${t('obsidian.info.saved')} ${notePath}`);
    } catch (error) {
      console.error('Failed to write Obsidian note:', error);
      pushObsidianMessage(t('obsidian.error.writeFailed'), true);
    } finally {
      setObsidianBusy(false);
    }
  };

  return (
    <div className="app-shell flex h-screen text-[var(--ink-1)] overflow-hidden">
      <TitleBar />
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Settings Modal */}
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          providerSettings={providerSettings}
          providerId={currentProviderId}
          modelName={currentModelName}
          apiKey={currentApiKey}
          baseUrl={providerSettings[currentProviderId]?.baseUrl}
          customHeaders={providerSettings[currentProviderId]?.customHeaders}
          tavily={providerSettings[currentProviderId]?.tavily}
          obsidianSettings={obsidianSettings}
          onSave={handleSaveSettings}
          onSaveObsidian={handleSaveObsidian}
        />
      </Suspense>

      {/* Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        currentSessionId={currentSessionId}
        sessions={sessions}
        filteredSessions={filteredSessions}
        searchQuery={searchQuery}
        sortBy={sortBy}
        sortOrder={sortOrder}
        editingSessionId={editingSessionId}
        editTitleInput={editTitleInput}
        language={language}
        onNewChatClick={handleNewChatClick}
        onSearchChange={setSearchQuery}
        onSortByChange={setSortBy}
        onSortOrderToggle={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
        onLoadSession={handleLoadSession}
        onStartEdit={handleStartEdit}
        onDeleteSession={handleDeleteSession}
        onEditTitleInputChange={setEditTitleInput}
        onEditInputClick={handleEditInputClick}
        onEditKeyDown={handleEditKeyDown}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onLanguageChange={handleLanguageChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ChatMain
        messages={messages}
        isStreaming={streaming.isStreaming}
        isLoading={streaming.isLoading}
        messagesContainerRef={streaming.messagesContainerRef}
        messagesEndRef={streaming.messagesEndRef}
        onMessagesScroll={streaming.handleMessagesScroll}
        onSendMessage={streaming.handleSendMessage}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onStopStreaming={streaming.stopStreaming}
        searchEnabled={searchEnabled}
        searchAvailable={tavilyAvailable}
        onToggleSearch={() => setSearchEnabled((prev) => !prev)}
        onReadObsidian={obsidianAvailable ? handleReadObsidian : undefined}
        onWriteObsidian={obsidianAvailable ? handleWriteObsidian : undefined}
        obsidianReadDisabled={
          !obsidianAvailable ||
          obsidianBusy ||
          (obsidianSettings.mode === 'vault' && !obsidianSettings.vaultPath) ||
          (obsidianSettings.readMode === 'selected' && !obsidianSettings.notePath) ||
          streaming.isStreaming ||
          streaming.isLoading
        }
        obsidianWriteDisabled={
          !obsidianAvailable ||
          obsidianBusy ||
          (obsidianSettings.mode === 'vault' && !obsidianSettings.vaultPath) ||
          (obsidianSettings.readMode === 'selected' && !obsidianSettings.notePath) ||
          streaming.isStreaming ||
          streaming.isLoading
        }
      />
    </div>
  );
}

export default App;
