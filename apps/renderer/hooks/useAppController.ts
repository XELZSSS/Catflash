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
  const [inputMode, setInputMode] = useState<'chat' | 'image'>('chat');
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
    handleStartEdit,
    handleDeleteSession,
    handleEditInputClick,
    handleEditKeyDown,
    handleSaveEdit,
    handleCancelEdit,
  } = chatSessions;

  useEffect(() => {
    applyLanguageToDocument();
    document.title = t('app.title');
  }, [language]);

  const tavilyAvailable = Boolean(providerSettings[currentProviderId]?.tavily?.apiKey);
  const imageGenerationAvailable = chatService.supportsImageGeneration(currentProviderId);
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

  useEffect(() => {
    if (inputMode === 'image' && !imageGenerationAvailable) {
      setInputMode('chat');
    }
  }, [imageGenerationAvailable, inputMode]);

  const handleNewChatClick = useCallback(() => {
    if (streaming.isStreaming || streaming.isLoading) return;
    startNewChat();
  }, [startNewChat, streaming.isLoading, streaming.isStreaming]);

  const handleSortOrderToggle = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, [setSortOrder]);

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
      imageGeneration: providerSettings[currentProviderId]?.imageGeneration,
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
      currentSessionId,
      sessions,
      filteredSessions,
      searchQuery,
      sortBy,
      sortOrder,
      editingSessionId,
      editTitleInput,
      language,
      onNewChatClick: handleNewChatClick,
      onSearchChange: setSearchQuery,
      onSortByChange: setSortBy,
      onSortOrderToggle: handleSortOrderToggle,
      onLoadSession: handleLoadSession,
      onStartEdit: handleStartEdit,
      onDeleteSession: handleDeleteSession,
      onEditTitleInputChange: setEditTitleInput,
      onEditInputClick: handleEditInputClick,
      onEditKeyDown: handleEditKeyDown,
      onSaveEdit: handleSaveEdit,
      onCancelEdit: handleCancelEdit,
      onLanguageChange: handleLanguageChange,
      onOpenSettings: () => setIsSettingsOpen(true),
    }),
    [
      currentSessionId,
      editTitleInput,
      editingSessionId,
      filteredSessions,
      handleCancelEdit,
      handleDeleteSession,
      handleEditInputClick,
      handleEditKeyDown,
      handleLoadSession,
      handleSaveEdit,
      handleStartEdit,
      handleLanguageChange,
      handleNewChatClick,
      handleSortOrderToggle,
      isSidebarOpen,
      language,
      searchQuery,
      sessions,
      setEditTitleInput,
      setSearchQuery,
      setSortBy,
      sortBy,
      sortOrder,
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
      inputMode,
      onToggleInputMode: () => {
        setInputMode((prev) => (prev === 'chat' ? 'image' : 'chat'));
      },
      imageGenerationAvailable,
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
      inputMode,
      imageGenerationAvailable,
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
