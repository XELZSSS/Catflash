/* global process */
const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_PROXY_PORT = '4010';
const DEFAULT_PROXY_HOST = '127.0.0.1';

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== 'undefined' ? normalized : undefined;
};

const resolveProxyPort = (value) => {
  const parsed = Number.parseInt(normalizeString(value) ?? DEFAULT_PROXY_PORT, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PROXY_PORT;
  }
  return String(parsed);
};

const resolveProxyHost = (value) => normalizeString(value) ?? DEFAULT_PROXY_HOST;

contextBridge.exposeInMainWorld('gero', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  getProxyToken: () => process.env.CATFLASH_PROXY_TOKEN,
  getProxyPort: () => resolveProxyPort(process.env.MINIMAX_PROXY_PORT),
  getProxyHost: () => resolveProxyHost(process.env.MINIMAX_PROXY_HOST),
  onMaximizeChanged: (callback) => {
    const onMax = () => callback(true);
    const onUnmax = () => callback(false);
    ipcRenderer.on('window:maximize', onMax);
    ipcRenderer.on('window:unmaximize', onUnmax);
    return () => {
      ipcRenderer.removeListener('window:maximize', onMax);
      ipcRenderer.removeListener('window:unmaximize', onUnmax);
    };
  },
  setTrayLanguage: (language) => ipcRenderer.invoke('tray:set-language', language),
  setTrayLabels: (labels) => ipcRenderer.invoke('tray:set-labels', labels),
  obsidian: {
    listMarkdown: (vaultPath) => ipcRenderer.invoke('obsidian:list-markdown', vaultPath),
    getRecentNote: (vaultPath) => ipcRenderer.invoke('obsidian:get-recent-note', vaultPath),
    readNote: (vaultPath, notePath) =>
      ipcRenderer.invoke('obsidian:read-note', { vaultPath, notePath }),
    writeNote: (vaultPath, notePath, content) =>
      ipcRenderer.invoke('obsidian:write-note', { vaultPath, notePath, content }),
  },
});
