const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const WINDOW_BOUNDS = {
  width: 1440,
  height: 960,
  minWidth: 1120,
  minHeight: 760
};

const ALLOWED_PROTOCOLS = new Set(['file:', 'devtools:', 'data:']);

let mainWindow = null;

function isAllowedUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function registerSessionGuards() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedUrl(details.url) });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...WINDOW_BOUNDS,
    show: false,
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function readIniFiles(filePaths) {
  const files = [];

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, 'utf8');
    files.push({
      id: filePath,
      path: filePath,
      name: path.basename(filePath),
      content
    });
  }

  return files;
}

app.whenReady().then(() => {
  registerSessionGuards();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('files:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'INI Files', extensions: ['ini', 'cfg', 'txt'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  try {
    return await readIniFiles(result.filePaths);
  } catch (error) {
    return {
      error: error.message
    };
  }
});

ipcMain.handle('files:save', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save merged INI file',
    defaultPath: 'merged_engine.ini',
    filters: [
      { name: 'INI Files', extensions: ['ini'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  try {
    await fs.writeFile(result.filePath, content, 'utf8');
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
