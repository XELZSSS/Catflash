import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ChatService } from './services/chatService';
import { ChatMessage, ProviderId } from './types';
import { t, getLanguage, setLanguage, applyLanguageToDocument, Language } from './utils/i18n';
import { useChatSessions } from './hooks/useChatSessions';
import { useStreamingMessages } from './hooks/useStreamingMessages';
import { useSearchToggle } from './hooks/useSearchToggle';
import { useObsidianActions } from './hooks/useObsidianActions';
import Sidebar from './components/Sidebar';
import ChatMain from './components/ChatMain';
import TitleBar from './components/TitleBar';
import { loadObsidianSettings, saveObsidianSettings } from './utils/obsidian';

const SettingsModal = lazy(() => import('./components/SettingsModal'));

// Instantiate service outside component
const chatService = new ChatService();
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
  const { searchEnabled, setSearchEnabled } = useSearchToggle({
    chatService,
    tavilyAvailable,
    currentProviderId,
  });

  const { obsidianAvailable, obsidianBusy, handleReadObsidian, handleWriteObsidian } =
    useObsidianActions({
      obsidianSettings,
      messages,
      setMessages,
      handleSendMessage: streaming.handleSendMessage,
    });

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
