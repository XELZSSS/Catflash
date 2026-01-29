/* global setTimeout, clearTimeout, process */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  ipcMain,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_WINDOW_STATE = { width: 1200, height: 760 };

let mainWindow = null;
let tray = null;
let proxyProcess = null;
let isQuitting = false;
let saveTimer = null;
let trayLanguage = 'en';
let trayLabels = null;

const normalizeVaultPath = (vaultPath) => {
  if (!vaultPath || typeof vaultPath !== 'string') {
    throw new Error('Missing Obsidian vault path');
  }
  return path.resolve(vaultPath);
};

const resolveNotePath = (vaultRoot, notePath) => {
  if (!notePath || typeof notePath !== 'string') {
    throw new Error('Missing Obsidian note path');
  }
  const resolvedVault = normalizeVaultPath(vaultRoot);
  const resolvedNote = path.isAbsolute(notePath)
    ? path.resolve(notePath)
    : path.resolve(resolvedVault, notePath);
  const normalizedVault = resolvedVault.endsWith(path.sep)
    ? resolvedVault
    : `${resolvedVault}${path.sep}`;
  if (!resolvedNote.startsWith(normalizedVault)) {
    throw new Error('Note path must be inside the vault');
  }
  return { vault: resolvedVault, note: resolvedNote };
};

const listMarkdownFiles = async (vaultPath) => {
  const root = normalizeVaultPath(vaultPath);
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.obsidian') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (!lower.endsWith('.md') && !lower.endsWith('.markdown')) continue;
      results.push(fullPath);
    }
  }
  return results;
};

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

const getProxyScriptPath = () => {
  if (isDev) {
    return path.join(app.getAppPath(), 'apps', 'server', 'llm-proxy.mjs');
  }
  return path.join(process.resourcesPath, 'server', 'llm-proxy.mjs');
};

const startProxy = () => {
  const scriptPath = getProxyScriptPath();
  proxyProcess = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      MINIMAX_PROXY_PORT: process.env.MINIMAX_PROXY_PORT ?? '4010',
    },
    stdio: isDev ? 'inherit' : 'ignore',
  });

  proxyProcess.on('exit', () => {
    proxyProcess = null;
  });
};

const stopProxy = () => {
  if (!proxyProcess) return;
  proxyProcess.kill();
  proxyProcess = null;
};

const showWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

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
    { label: labels.open, click: showWindow },
    { label: labels.hide, click: () => mainWindow?.hide() },
    {
      label: labels.toggleDevTools,
      enabled: isDev,
      click: () => {
        if (!isDev || !mainWindow) return;
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      },
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
};

const updateTrayMenu = () => {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
};

const createTray = () => {
  if (tray) return;
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Catflash');
  updateTrayMenu();
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
};

const getWindowIcon = () => {
  const root = app.getAppPath();
  return path.join(root, 'assets', 'icons', 'app.png');
};

const createWindow = async () => {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    show: false,
    backgroundColor: '#09090b',
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
  mainWindow.setBackgroundColor('#09090b');
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
    if (!isQuitting) {
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
  mainWindow.on('resize', () => mainWindow.setBackgroundColor('#09090b'));

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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  stopProxy();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('activate', () => {
  if (mainWindow) {
    showWindow();
  } else {
    createWindow();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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
  ipcMain.handle('tray:set-language', (_event, language) => {
    trayLanguage = language === 'zh-CN' ? 'zh-CN' : 'en';
    trayLabels = null;
    updateTrayMenu();
  });
  ipcMain.handle('tray:set-labels', (_event, labels) => {
    trayLabels = labels && typeof labels === 'object' ? labels : null;
    updateTrayMenu();
  });
  ipcMain.handle('obsidian:list-markdown', async (_event, vaultPath) => {
    const files = await listMarkdownFiles(vaultPath);
    const root = normalizeVaultPath(vaultPath);
    return files
      .map((filePath) => path.relative(root, filePath))
      .sort((a, b) => a.localeCompare(b));
  });
  ipcMain.handle('obsidian:get-recent-note', async (_event, vaultPath) => {
    const files = await listMarkdownFiles(vaultPath);
    if (files.length === 0) return null;
    const stats = await Promise.all(
      files.map(async (filePath) => ({
        filePath,
        stat: await fs.promises.stat(filePath),
      }))
    );
    stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    const root = normalizeVaultPath(vaultPath);
    return path.relative(root, stats[0].filePath);
  });
  ipcMain.handle('obsidian:read-note', async (_event, payload) => {
    const { vaultPath, notePath } = payload ?? {};
    const resolved = resolveNotePath(vaultPath, notePath);
    return fs.promises.readFile(resolved.note, 'utf-8');
  });
  ipcMain.handle('obsidian:write-note', async (_event, payload) => {
    const { vaultPath, notePath, content } = payload ?? {};
    const resolved = resolveNotePath(vaultPath, notePath);
    await fs.promises.mkdir(path.dirname(resolved.note), { recursive: true });
    await fs.promises.writeFile(resolved.note, content ?? '', 'utf-8');
  });
  startProxy();
  createTray();
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (!mainWindow) return;
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });
});
