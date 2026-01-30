/* global setTimeout, clearTimeout, process */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_WINDOW_STATE = { width: 1200, height: 760 };
const WINDOW_BG_COLOR = '#09090b';

let mainWindow = null;
let saveTimer = null;

const loadWindowState = () => {
  try {
    const raw = fs.readFileSync(WINDOW_STATE_FILE, 'utf-8');
    return { ...DEFAULT_WINDOW_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }
};

const scheduleWindowStateSave = (win) => {
  if (!win) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (!win || win.isDestroyed()) return;
      const bounds = win.getBounds();
      const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized(),
      };
      fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state));
    } catch {
      // ignore destroyed window or persistence errors
    }
  }, 250);
};

const getWindowIcon = () => {
  const root = app.getAppPath();
  return path.join(root, 'assets', 'icons', 'app.png');
};

const showWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

const getMainWindow = () => mainWindow;

const createMainWindow = async ({ isDev, shouldPreventClose }) => {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    show: false,
    backgroundColor: WINDOW_BG_COLOR,
    transparent: false,
    autoHideMenuBar: true,
    frame: false,
    icon: getWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(app.getAppPath(), 'apps', 'main', 'preload.cjs'),
    },
  });
  mainWindow.setBackgroundColor(WINDOW_BG_COLOR);
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (shouldPreventClose?.()) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    scheduleWindowStateSave(mainWindow);
  });
  mainWindow.on('closed', () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    mainWindow = null;
  });

  mainWindow.on('resize', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('move', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('resize', () => mainWindow.setBackgroundColor(WINDOW_BG_COLOR));

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximize');
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:unmaximize');
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:3000';
    try {
      await mainWindow.loadURL(devUrl);
    } catch {
      setTimeout(() => mainWindow?.loadURL(devUrl), 500);
    }
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
};

const registerWindowIpcHandlers = () => {
  ipcMain.handle('window:minimize', () => {
    if (!mainWindow) return;
    mainWindow.minimize();
  });
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle('window:close', () => {
    if (!mainWindow) return;
    mainWindow.hide();
  });
  ipcMain.handle('window:is-maximized', () => {
    if (!mainWindow) return false;
    return mainWindow.isMaximized();
  });
};

module.exports = {
  createMainWindow,
  getMainWindow,
  registerWindowIpcHandlers,
  showWindow,
};
