const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let trayLanguage = 'en';
let trayLabels = null;
let isDev = false;
let getMainWindow = null;
let showWindow = null;
let onQuit = null;

const getTrayIcon = () => {
  const root = app.getAppPath();
  const icoPath = path.join(root, 'assets', 'icons', 'app.ico');
  const pngPath = path.join(root, 'assets', 'icons', 'app.png');
  if (fs.existsSync(icoPath)) return nativeImage.createFromPath(icoPath);
  if (fs.existsSync(pngPath)) return nativeImage.createFromPath(pngPath);
  return nativeImage.createEmpty();
};

const getTrayLabels = (language) => {
  if (language === 'zh-CN') {
    return {
      open: '打开',
      hide: '隐藏',
      toggleDevTools: '切换开发者工具',
      quit: '退出',
    };
  }
  return {
    open: 'Open',
    hide: 'Hide',
    toggleDevTools: 'Toggle DevTools',
    quit: 'Quit',
  };
};

const buildTrayMenu = () => {
  const labels = trayLabels ?? getTrayLabels(trayLanguage);
  return Menu.buildFromTemplate([
    { label: labels.open, click: () => showWindow?.() },
    { label: labels.hide, click: () => getMainWindow?.()?.hide() },
    {
      label: labels.toggleDevTools,
      enabled: isDev,
      click: () => {
        const window = getMainWindow?.();
        if (!isDev || !window) return;
        if (window.webContents.isDevToolsOpened()) {
          window.webContents.closeDevTools();
        } else {
          window.webContents.openDevTools({ mode: 'detach' });
        }
      },
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        onQuit?.();
        app.quit();
      },
    },
  ]);
};

const updateTrayMenu = () => {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
};

const createTray = (options) => {
  if (tray) return;
  isDev = Boolean(options?.isDev);
  getMainWindow = options?.getMainWindow ?? null;
  showWindow = options?.showWindow ?? null;
  onQuit = options?.onQuit ?? null;
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Catflash');
  updateTrayMenu();
  tray.on('click', () => {
    const window = getMainWindow?.();
    if (!window) return;
    if (window.isVisible()) {
      window.hide();
    } else {
      showWindow?.();
    }
  });
};

const setTrayLanguage = (language) => {
  trayLanguage = language === 'zh-CN' ? 'zh-CN' : 'en';
  trayLabels = null;
  updateTrayMenu();
};

const setTrayLabels = (labels) => {
  trayLabels = labels && typeof labels === 'object' ? labels : null;
  updateTrayMenu();
};

module.exports = {
  createTray,
  setTrayLanguage,
  setTrayLabels,
  updateTrayMenu,
};
