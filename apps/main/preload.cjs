/* global process */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gero', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  getProxyToken: () => process.env.CATFLASH_PROXY_TOKEN,
  getProxyPort: () => process.env.MINIMAX_PROXY_PORT ?? '4010',
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
