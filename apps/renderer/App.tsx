import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ChatService } from './services/chatService';
import { ChatMessage } from './types';
import { t, getLanguage, applyLanguageToDocument, Language } from './utils/i18n';
import { useChatSessions } from './hooks/useChatSessions';
import { useStreamingMessages } from './hooks/useStreamingMessages';
import { useSearchToggle } from './hooks/useSearchToggle';
import { useObsidianActions } from './hooks/useObsidianActions';
import { useAppSettings } from './hooks/useAppSettings';
import Sidebar from './components/Sidebar';
import ChatMain from './components/ChatMain';
import TitleBar from './components/TitleBar';
import { loadObsidianSettings } from './utils/obsidian';

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
  const handleSortOrderToggle = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, [setSortOrder]);
  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);
  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);
  const handleToggleSearch = useCallback(() => {
    setSearchEnabled((prev) => !prev);
  }, [setSearchEnabled]);
  const isObsidianReadDisabled =
    !obsidianAvailable ||
    obsidianBusy ||
    (obsidianSettings.mode === 'vault' && !obsidianSettings.vaultPath) ||
    (obsidianSettings.readMode === 'selected' && !obsidianSettings.notePath) ||
    streaming.isStreaming ||
    streaming.isLoading;
  const isObsidianWriteDisabled =
    !obsidianAvailable ||
    obsidianBusy ||
    (obsidianSettings.mode === 'vault' && !obsidianSettings.vaultPath) ||
    (obsidianSettings.readMode === 'selected' && !obsidianSettings.notePath) ||
    streaming.isStreaming ||
    streaming.isLoading;

  const { syncTrayLabels, handleSaveSettings, handleSaveObsidian, handleLanguageChange } =
    useAppSettings({
      chatService,
      providerSettings,
      currentProviderId,
      setProviderSettings,
      setCurrentProviderId,
      setCurrentModelName,
      setCurrentApiKey,
      setObsidianSettings,
      setLanguageState,
      startNewChat,
    });

  useEffect(() => {
    syncTrayLabels(language);
  }, [language, syncTrayLabels]);

  return (
    <div className="app-shell flex h-screen text-[var(--ink-1)] overflow-hidden">
      <TitleBar />
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-20 lg:hidden" onClick={handleCloseSidebar} />
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
        onSortOrderToggle={handleSortOrderToggle}
        onLoadSession={handleLoadSession}
        onStartEdit={handleStartEdit}
        onDeleteSession={handleDeleteSession}
        onEditTitleInputChange={setEditTitleInput}
        onEditInputClick={handleEditInputClick}
        onEditKeyDown={handleEditKeyDown}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onLanguageChange={handleLanguageChange}
        onOpenSettings={handleOpenSettings}
      />

      <ChatMain
        messages={messages}
        isStreaming={streaming.isStreaming}
        isLoading={streaming.isLoading}
        messagesContainerRef={streaming.messagesContainerRef}
        messagesEndRef={streaming.messagesEndRef}
        onSendMessage={streaming.handleSendMessage}
        onOpenSidebar={handleOpenSidebar}
        onStopStreaming={streaming.stopStreaming}
        searchEnabled={searchEnabled}
        searchAvailable={tavilyAvailable}
        onToggleSearch={handleToggleSearch}
        onReadObsidian={obsidianAvailable ? handleReadObsidian : undefined}
        onWriteObsidian={obsidianAvailable ? handleWriteObsidian : undefined}
        obsidianReadDisabled={isObsidianReadDisabled}
        obsidianWriteDisabled={isObsidianWriteDisabled}
      />
    </div>
  );
}

export default App;
