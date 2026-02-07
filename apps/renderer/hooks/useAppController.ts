import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatMessage } from '../types';
import { ChatService } from '../services/chatService';
import { t, getLanguage, applyLanguageToDocument, Language } from '../utils/i18n';
import { useChatSessions } from './useChatSessions';
import { useStreamingMessages } from './useStreamingMessages';
import { useSearchToggle } from './useSearchToggle';
import { useObsidianActions } from './useObsidianActions';
import { useAppSettings } from './useAppSettings';
import { loadObsidianSettings } from '../utils/obsidian';

const chatService = new ChatService();

export const useAppController = () => {
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

  const streaming = useStreamingMessages({ chatService, messages, setMessages });

  const chatSessions = useChatSessions({
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
    chatSessions.startNewChat();
  }, [chatSessions, streaming.isLoading, streaming.isStreaming]);

  const handleSortOrderToggle = useCallback(() => {
    chatSessions.setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, [chatSessions]);

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
      startNewChat: chatSessions.startNewChat,
    });

  useEffect(() => {
    syncTrayLabels(language);
  }, [language, syncTrayLabels]);

  const settingsModalProps = useMemo(
    () => ({
      isOpen: isSettingsOpen,
      onClose: () => setIsSettingsOpen(false),
      providerSettings,
      providerId: currentProviderId,
      modelName: currentModelName,
      apiKey: currentApiKey,
      baseUrl: providerSettings[currentProviderId]?.baseUrl,
      customHeaders: providerSettings[currentProviderId]?.customHeaders,
      tavily: providerSettings[currentProviderId]?.tavily,
      obsidianSettings,
      onSave: handleSaveSettings,
      onSaveObsidian: handleSaveObsidian,
    }),
    [
      currentApiKey,
      currentModelName,
      currentProviderId,
      handleSaveObsidian,
      handleSaveSettings,
      isSettingsOpen,
      obsidianSettings,
      providerSettings,
    ]
  );

  const sidebarProps = useMemo(
    () => ({
      isSidebarOpen,
      currentSessionId: chatSessions.currentSessionId,
      sessions: chatSessions.sessions,
      filteredSessions: chatSessions.filteredSessions,
      searchQuery: chatSessions.searchQuery,
      sortBy: chatSessions.sortBy,
      sortOrder: chatSessions.sortOrder,
      editingSessionId: chatSessions.editingSessionId,
      editTitleInput: chatSessions.editTitleInput,
      language,
      onNewChatClick: handleNewChatClick,
      onSearchChange: chatSessions.setSearchQuery,
      onSortByChange: chatSessions.setSortBy,
      onSortOrderToggle: handleSortOrderToggle,
      onLoadSession: chatSessions.handleLoadSession,
      onStartEdit: chatSessions.handleStartEdit,
      onDeleteSession: chatSessions.handleDeleteSession,
      onEditTitleInputChange: chatSessions.setEditTitleInput,
      onEditInputClick: chatSessions.handleEditInputClick,
      onEditKeyDown: chatSessions.handleEditKeyDown,
      onSaveEdit: chatSessions.handleSaveEdit,
      onCancelEdit: chatSessions.handleCancelEdit,
      onLanguageChange: handleLanguageChange,
      onOpenSettings: () => setIsSettingsOpen(true),
    }),
    [
      chatSessions,
      handleLanguageChange,
      handleNewChatClick,
      handleSortOrderToggle,
      isSidebarOpen,
      language,
    ]
  );

  const chatMainProps = useMemo(
    () => ({
      messages,
      isStreaming: streaming.isStreaming,
      isLoading: streaming.isLoading,
      messagesContainerRef: streaming.messagesContainerRef,
      messagesEndRef: streaming.messagesEndRef,
      onSendMessage: streaming.handleSendMessage,
      onOpenSidebar: () => setIsSidebarOpen(true),
      onStopStreaming: streaming.stopStreaming,
      searchEnabled,
      searchAvailable: tavilyAvailable,
      onToggleSearch: handleToggleSearch,
      onReadObsidian: obsidianAvailable ? handleReadObsidian : undefined,
      onWriteObsidian: obsidianAvailable ? handleWriteObsidian : undefined,
      obsidianReadDisabled: isObsidianReadDisabled,
      obsidianWriteDisabled: isObsidianWriteDisabled,
    }),
    [
      handleReadObsidian,
      handleToggleSearch,
      handleWriteObsidian,
      isObsidianReadDisabled,
      isObsidianWriteDisabled,
      messages,
      obsidianAvailable,
      searchEnabled,
      streaming.handleSendMessage,
      streaming.isLoading,
      streaming.isStreaming,
      streaming.messagesContainerRef,
      streaming.messagesEndRef,
      streaming.stopStreaming,
      tavilyAvailable,
    ]
  );

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    settingsModalProps,
    sidebarProps,
    chatMainProps,
  };
};
