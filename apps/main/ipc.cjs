const { ipcMain } = require('electron');

const registerAppIpcHandlers = ({
  registerWindowIpcHandlers,
  registerObsidianIpcHandlers,
  setTrayLanguage,
  setTrayLabels,
}) => {
  registerWindowIpcHandlers();

  ipcMain.handle('tray:set-language', (_event, language) => {
    setTrayLanguage(language);
  });

  ipcMain.handle('tray:set-labels', (_event, labels) => {
    setTrayLabels(labels);
  });

  registerObsidianIpcHandlers();
};

module.exports = {
  registerAppIpcHandlers,
};
