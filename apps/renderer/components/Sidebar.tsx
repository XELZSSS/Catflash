import React from 'react';
import {
  Trash2,
  Settings,
  Search,
  Edit2,
  Check,
  X,
  Calendar,
  Clock,
  Plus,
  Globe,
} from 'lucide-react';
import { ChatSession } from '../types';
import { Language, t } from '../utils/i18n';
import { useRef } from 'react';
import { useVirtualList } from '../hooks/useVirtualList';

type SidebarProps = {
  isSidebarOpen: boolean;
  currentSessionId: string;
  sessions: ChatSession[];
  filteredSessions: ChatSession[];
  searchQuery: string;
  sortBy: 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  editingSessionId: string | null;
  editTitleInput: string;
  language: Language;
  onNewChatClick: () => void;
  onSearchChange: (value: string) => void;
  onSortByChange: (value: 'createdAt' | 'updatedAt') => void;
  onSortOrderToggle: () => void;
  onLoadSession: (session: ChatSession) => void;
  onStartEdit: (e: React.MouseEvent, session: ChatSession) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onEditTitleInputChange: (value: string) => void;
  onEditInputClick: (e: React.MouseEvent) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onSaveEdit: (e: React.FormEvent | React.MouseEvent) => void;
  onCancelEdit: (e: React.MouseEvent) => void;
  onLanguageChange: (nextLanguage: Language) => void;
  onOpenSettings: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({
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
  onNewChatClick,
  onSearchChange,
  onSortByChange,
  onSortOrderToggle,
  onLoadSession,
  onStartEdit,
  onDeleteSession,
  onEditTitleInputChange,
  onEditInputClick,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onLanguageChange,
  onOpenSettings,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const { visibleItems, topSpacerHeight, bottomSpacerHeight, measureItem } = useVirtualList({
    items: filteredSessions,
    containerRef: listContainerRef as React.RefObject<HTMLElement>,
    estimateSize: () => 44,
    overscan: 10,
  });

  const sortButtonClass = (active: boolean) =>
    `p-1.5 rounded-md transition-all ${
      active
        ? 'bg-[var(--bg-2)] text-[var(--ink-1)] shadow-sm'
        : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
    }`;

  return (
    <aside
      className={`sidebar fixed lg:relative z-30 w-72 h-full bg-[var(--bg-1)] border-r border-[var(--line-1)] transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex flex-col h-full p-4">
        <button
          onClick={onNewChatClick}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-[#1a1a1a] rounded-lg transition-colors mb-6 text-sm font-medium"
        >
          <Plus size={16} />
          <span>{t('sidebar.newChat')}</span>
        </button>

        {/* Search Bar */}
        <div className="px-1 mb-3">
          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--ink-3)] group-focus-within:text-[var(--ink-2)] transition-colors"
              size={14}
            />
            <input
              type="text"
              placeholder={t('sidebar.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg bg-[var(--bg-2)] pl-9 pr-3 py-2 text-sm text-[var(--ink-2)] outline-none ring-1 ring-[var(--line-1)] transition-all placeholder-[var(--ink-3)] focus:ring-[color:var(--ink-3)]"
            />
          </div>
        </div>

        {/* Sort Controls */}
        <div className="px-1 mb-4 flex items-center justify-between">
          <div className="flex rounded-lg p-0.5 gap-0.5 ring-1 ring-[var(--line-1)]">
            <button
              onClick={() => onSortByChange('updatedAt')}
              className={sortButtonClass(sortBy === 'updatedAt')}
              title={t('sidebar.sort.updatedAtTitle')}
            >
              <Clock size={14} />
            </button>
            <button
              onClick={() => onSortByChange('createdAt')}
              className={sortButtonClass(sortBy === 'createdAt')}
              title={t('sidebar.sort.createdAtTitle')}
            >
              <Calendar size={14} />
            </button>
          </div>

          <button
            onClick={onSortOrderToggle}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-3)] hover:text-[var(--ink-2)] px-2 py-1.5 rounded-lg hover:bg-[var(--bg-2)] transition-colors"
          >
            <span>{sortOrder === 'asc' ? t('sidebar.sort.oldest') : t('sidebar.sort.newest')}</span>
          </button>
        </div>

        <div ref={listContainerRef} className="flex-1 overflow-y-auto pr-1">
          <div className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider mb-2 px-2">
            {t('sidebar.history')}
          </div>

          {sessions.length === 0 ? (
            <div className="px-2 py-2 text-sm text-[var(--ink-3)] italic">
              {t('sidebar.noConversations')}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-2 py-2 text-sm text-[var(--ink-3)] italic">
              {t('sidebar.noMatching')}
            </div>
          ) : (
            <div className="space-y-0.5">
              <div style={{ height: `${topSpacerHeight}px` }} />
              {visibleItems.map(({ item: session, index }) => (
                <div key={session.id} ref={(node) => measureItem(index, node as HTMLDivElement)}>
                  <div
                    onClick={() => onLoadSession(session)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm border border-transparent ${
                      currentSessionId === session.id && editingSessionId !== session.id
                        ? 'bg-[var(--bg-2)] text-[var(--ink-1)] border-[var(--line-1)]'
                        : 'text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      <div className="flex items-center gap-1 w-full" onClick={onEditInputClick}>
                        <input
                          type="text"
                          autoFocus
                          value={editTitleInput}
                          onChange={(e) => onEditTitleInputChange(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          className="flex-1 bg-[var(--bg-0)] text-[var(--ink-1)] text-xs px-2 py-1.5 rounded border border-[var(--line-1)] focus:outline-none focus:border-[var(--ink-3)]"
                        />
                        <button
                          onClick={onSaveEdit}
                          className="p-1 hover:text-[var(--ink-1)] text-[var(--ink-3)] transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="p-1 hover:text-red-400 text-[var(--ink-3)] transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 truncate flex-1">
                          <span className="truncate">{session.title}</span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => onStartEdit(e, session)}
                            className="p-1.5 text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors rounded hover:bg-[var(--bg-2)]"
                            title={t('sidebar.editTitle')}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={(e) => onDeleteSession(e, session.id)}
                            className="p-1.5 text-[var(--ink-3)] hover:text-red-400 transition-colors rounded hover:bg-[var(--bg-2)]"
                            title={t('sidebar.deleteTitle')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ height: `${bottomSpacerHeight}px` }} />
            </div>
          )}
        </div>

        <div className="mt-auto px-1 space-y-1">
          <button
            onClick={() => onLanguageChange(language === 'en' ? 'zh-CN' : 'en')}
            className="flex items-center gap-3 text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors text-sm w-full p-2 rounded-lg hover:bg-[var(--bg-2)]"
          >
            <Globe size={16} />
            <span>{language === 'en' ? t('language.en') : t('language.zhCN')}</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-3 text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors text-sm w-full p-2 rounded-lg hover:bg-[var(--bg-2)]"
          >
            <Settings size={16} />
            <span>{t('sidebar.settings')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
