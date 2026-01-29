import React from 'react';
import { Menu } from 'lucide-react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import WelcomeScreen from './WelcomeScreen';
import { ChatMessage, Role } from '../types';
import { t } from '../utils/i18n';

type ChatMainProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSendMessage: (text: string) => void;
  onOpenSidebar: () => void;
  onStopStreaming: () => void;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleSearch: () => void;
  onReadObsidian?: () => void;
  onWriteObsidian?: () => void;
  obsidianReadDisabled?: boolean;
  obsidianWriteDisabled?: boolean;
};

const ChatMain: React.FC<ChatMainProps> = ({
  messages,
  isStreaming,
  isLoading,
  messagesContainerRef,
  messagesEndRef,
  onSendMessage,
  onOpenSidebar,
  onStopStreaming,
  searchEnabled,
  searchAvailable,
  onToggleSearch,
  onReadObsidian,
  onWriteObsidian,
  obsidianReadDisabled,
  obsidianWriteDisabled,
}) => {
  const chatInput = (
    <ChatInput
      onSend={onSendMessage}
      disabled={isLoading}
      isStreaming={isStreaming}
      onStop={onStopStreaming}
      searchEnabled={searchEnabled}
      searchAvailable={searchAvailable}
      onToggleSearch={onToggleSearch}
      onReadObsidian={onReadObsidian}
      onWriteObsidian={onWriteObsidian}
      obsidianReadDisabled={obsidianReadDisabled}
      obsidianWriteDisabled={obsidianWriteDisabled}
    />
  );
  const hasMessages = messages.length > 0;

  return (
    <main className="chat-main flex-1 flex flex-col h-full relative bg-transparent pt-0">
      {/* Header (Mobile Only) */}
      <header className="flex lg:hidden items-center justify-between p-4 border-b border-[var(--line-1)] bg-[var(--bg-0)] absolute top-0 left-0 right-0 z-10 backdrop-blur">
        <button
          onClick={onOpenSidebar}
          className="p-2 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
        >
          <Menu size={20} />
        </button>
        <span className="font-medium text-[var(--ink-2)]">{t('header.mobileTitle')}</span>
        <div className="w-8" />
      </header>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth pt-16 lg:pt-0"
        style={{ scrollPaddingBottom: 'calc(var(--chat-input-height, 120px) + 8px)' }}
      >
        <div
          className="mx-auto w-full max-w-[min(64rem,100%)] px-4 py-8 min-h-full flex flex-col"
          style={{ paddingBottom: 'calc(var(--chat-input-height, 120px) + 8px)' }}
        >
          {!hasMessages ? (
            <WelcomeScreen
              input={React.cloneElement(chatInput, {
                containerClassName: 'px-0 pb-0 max-w-[min(80rem,100%)]',
              })}
            />
          ) : (
            <>
              {messages.map((msg, index) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming && index === messages.length - 1 && msg.role === Role.Model
                  }
                />
              ))}
              {isStreaming && <div className="flex justify-start mb-6"></div>}
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      {hasMessages && <div className="absolute bottom-0 left-0 right-0 z-20">{chatInput}</div>}
    </main>
  );
};

export default ChatMain;
