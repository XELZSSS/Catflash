const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gero', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
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
});
