export type Language = 'en' | 'zh-CN';

const DEFAULT_LANGUAGE: Language = 'en';
const LANGUAGE_STORAGE_KEY = 'gemini_chat_language';

const getSystemLanguage = (): Language => {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('zh') ? 'zh-CN' : 'en';
};

const getStoredLanguage = (): Language | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'en' || stored === 'zh-CN' ? stored : null;
};

let currentLanguage: Language = getStoredLanguage() ?? getSystemLanguage();

export const getLanguage = (): Language => currentLanguage;

export const applyLanguageToDocument = (): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
  }
};

export const setLanguage = (language: Language): void => {
  currentLanguage = language;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
  applyLanguageToDocument();
};

export const DEFAULT_SESSION_TITLES = {
  en: 'New Chat',
  'zh-CN': '新对话',
} as const;

export const isDefaultSessionTitle = (title?: string | null): boolean => {
  if (!title) return true;
  return Object.values(DEFAULT_SESSION_TITLES).includes(
    title as (typeof DEFAULT_SESSION_TITLES)[Language]
  );
};

const translations: Record<Language, Record<string, string>> = {
  en: {
    'app.title': 'Catflash',
    'header.mobileTitle': 'Catflash',
    'sidebar.newChat': 'New Chat',
    'sidebar.searchPlaceholder': 'Search...',
    'sidebar.history': 'History',
    'sidebar.noConversations': 'No conversations yet.',
    'sidebar.noMatching': 'No matching chats.',
    'sidebar.sort.oldest': 'Oldest',
    'sidebar.sort.newest': 'Newest',
    'sidebar.sort.updatedAtTitle': 'Sort by Last Updated',
    'sidebar.sort.createdAtTitle': 'Sort by Date Created',
    'sidebar.settings': 'Settings',
    'sidebar.editTitle': 'Edit title',
    'sidebar.deleteTitle': 'Delete session',
    'sidebar.language': 'Language',
    'tray.open': 'Open',
    'tray.hide': 'Hide',
    'tray.toggleDevTools': 'Toggle DevTools',
    'tray.quit': 'Quit',
    'role.user': 'User',
    'role.model': 'Catflash',
    'copy.copy': 'Copy',
    'copy.copied': 'Copied',
    'code.copyCode': 'Copy code',
    'reasoning.streaming': 'Thinking',
    'reasoning.title': 'Reasoning',
    'reasoning.collapse': 'Collapse',
    'reasoning.expand': 'Expand',
    'language.en': 'EN',
    'language.zhCN': '中文',
    'settings.apiKey.show': 'Show API key',
    'settings.apiKey.hide': 'Hide API key',
    'settings.apiKey.clear': 'Clear API key',
    'settings.modal.title': 'Configuration',
    'settings.modal.info': 'Applying these settings will start a fresh conversation.',
    'settings.modal.provider': 'Provider',
    'settings.modal.model': 'Model',
    'settings.modal.apiKey': 'API Key',
    'settings.modal.baseUrl': 'Base URL',
    'settings.modal.region': 'Region',
    'settings.modal.region.international': 'International',
    'settings.modal.region.china': 'China',
    'settings.modal.customHeaders': 'Custom Headers',
    'settings.modal.customHeaders.add': 'Add header',
    'settings.modal.customHeaders.empty': 'No custom headers configured.',
    'settings.modal.customHeaders.key': 'Header key',
    'settings.modal.customHeaders.value': 'Header value',
    'settings.modal.customHeaders.remove': 'Remove header',
    'settings.modal.tavily.title': 'Search Engine',
    'settings.modal.tavily.apiKey': 'Tavily API Key',
    'settings.modal.tavily.projectId': 'Project ID (optional)',
    'settings.modal.tavily.searchDepth': 'Search depth',
    'settings.modal.tavily.searchDepth.basic': 'Basic',
    'settings.modal.tavily.searchDepth.advanced': 'Advanced',
    'settings.modal.tavily.searchDepth.fast': 'Fast',
    'settings.modal.tavily.searchDepth.ultraFast': 'Ultra-fast',
    'settings.modal.tavily.maxResults': 'Max results',
    'settings.modal.tavily.topic': 'Topic',
    'settings.modal.tavily.topic.general': 'General',
    'settings.modal.tavily.topic.news': 'News',
    'settings.modal.tavily.topic.finance': 'Finance',
    'settings.modal.tavily.includeAnswer': 'Include answer summary',
    'settings.modal.cancel': 'Cancel',
    'settings.modal.save': 'Save Changes',
    'input.search.enable': 'Enable search',
    'input.search.disable': 'Disable search',
    'input.placeholder': 'Message Gemini...',
    'error.generic': "I'm sorry, I encountered an error while processing your request.",
    'error.auth': 'Authentication failed. Please check your API key configuration.',
    'error.quota': 'API quota exceeded. Please check your usage limits or billing.',
    'error.safety': 'The response was blocked due to safety filters.',
    'error.network': 'Network error. Please check your internet connection.',
    'error.overloaded': 'The service is temporarily overloaded. Please try again later.',
    'error.troubleshooting': 'Troubleshooting:',
    'error.step1': 'Check your internet connection.',
    'error.step2': 'Verify your API key is valid.',
    'error.step3': 'If the error persists, try refreshing the page.',
    'error.technicalDetails': 'Technical Details',
  },
  'zh-CN': {
    'app.title': 'Catflash',
    'header.mobileTitle': 'Catflash',
    'sidebar.newChat': '新对话',
    'sidebar.searchPlaceholder': '搜索...',
    'sidebar.history': '历史记录',
    'sidebar.noConversations': '还没有对话记录。',
    'sidebar.noMatching': '没有匹配的对话。',
    'sidebar.sort.oldest': '最早',
    'sidebar.sort.newest': '最新',
    'sidebar.sort.updatedAtTitle': '按最近更新排序',
    'sidebar.sort.createdAtTitle': '按创建时间排序',
    'sidebar.settings': '设置',
    'sidebar.editTitle': '编辑标题',
    'sidebar.deleteTitle': '删除对话',
    'sidebar.language': '语言',
    'tray.open': '打开',
    'tray.hide': '隐藏',
    'tray.toggleDevTools': '切换开发者工具',
    'tray.quit': '退出',
    'role.user': '用户',
    'role.model': 'Catflash',
    'copy.copy': '复制',
    'copy.copied': '已复制',
    'code.copyCode': '复制代码',
    'reasoning.streaming': '思考中',
    'reasoning.title': '思考过程',
    'reasoning.collapse': '收起',
    'reasoning.expand': '展开',
    'language.en': 'EN',
    'language.zhCN': '中文',
    'settings.apiKey.show': '显示 API Key',
    'settings.apiKey.hide': '隐藏 API Key',
    'settings.apiKey.clear': '清除 API Key',
    'settings.modal.title': '配置',
    'settings.modal.info': '应用这些设置将会开始一段新的对话。',
    'settings.modal.provider': '供应商',
    'settings.modal.model': '模型',
    'settings.modal.apiKey': 'API 密钥',
    'settings.modal.baseUrl': 'API 地址',
    'settings.modal.region': '区域',
    'settings.modal.region.international': '国际版',
    'settings.modal.region.china': '国内版',
    'settings.modal.customHeaders': '自定义 Header',
    'settings.modal.customHeaders.add': '添加一条',
    'settings.modal.customHeaders.empty': '暂无自定义 Header。',
    'settings.modal.customHeaders.key': 'Header 键',
    'settings.modal.customHeaders.value': 'Header 值',
    'settings.modal.customHeaders.remove': '删除',
    'settings.modal.tavily.title': '搜索引擎',
    'settings.modal.tavily.apiKey': 'Tavily API Key',
    'settings.modal.tavily.projectId': '项目 ID（可选）',
    'settings.modal.tavily.searchDepth': '搜索深度',
    'settings.modal.tavily.searchDepth.basic': '基础',
    'settings.modal.tavily.searchDepth.advanced': '深入',
    'settings.modal.tavily.searchDepth.fast': '快速',
    'settings.modal.tavily.searchDepth.ultraFast': '极速',
    'settings.modal.tavily.maxResults': '最大结果数',
    'settings.modal.tavily.topic': '主题',
    'settings.modal.tavily.topic.general': '通用',
    'settings.modal.tavily.topic.news': '新闻',
    'settings.modal.tavily.topic.finance': '财经',
    'settings.modal.tavily.includeAnswer': '包含摘要答案',
    'settings.modal.cancel': '取消',
    'settings.modal.save': '保存更改',
    'input.search.enable': '启用搜索',
    'input.search.disable': '关闭搜索',
    'input.placeholder': '给 Gemini 发送消息...',
    'error.generic': '抱歉，处理你的请求时出现了错误。',
    'error.auth': '认证失败。请检查你的 API Key 配置。',
    'error.quota': 'API 配额已超出。请检查用量限制或计费信息。',
    'error.safety': '由于安全策略，响应被拦截。',
    'error.network': '网络错误。请检查你的网络连接。',
    'error.overloaded': '服务暂时过载，请稍后再试。',
    'error.troubleshooting': '排查建议：',
    'error.step1': '检查你的网络连接。',
    'error.step2': '确认 API Key 是否有效。',
    'error.step3': '如果问题仍然存在，尝试刷新页面。',
    'error.technicalDetails': '技术细节',
  },
};

export const t = (key: string): string =>
  translations[currentLanguage][key] ?? translations.en[key] ?? key;
