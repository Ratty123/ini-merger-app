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
const CONFIG_FILENAME = 'inimerger.cfg';

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
    icon: path.join(__dirname, 'build', 'icon.png'),
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

async function readIniFilesWithMissing(filePaths) {
  const files = [];
  const missingPaths = [];

  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      files.push({
        id: filePath,
        path: filePath,
        name: path.basename(filePath),
        content
      });
    } catch (error) {
      missingPaths.push(filePath);
    }
  }

  return {
    files,
    missingPaths
  };
}

function getConfigPath() {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), CONFIG_FILENAME);
  }

  return path.join(app.getAppPath(), CONFIG_FILENAME);
}

async function loadAppConfig() {
  try {
    const configPath = getConfigPath();
    const raw = await fs.readFile(configPath, 'utf8');
    return {
      success: true,
      path: configPath,
      config: JSON.parse(raw)
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: true,
        path: getConfigPath(),
        config: null
      };
    }

    return {
      success: false,
      error: error.message,
      path: getConfigPath()
    };
  }
}

async function saveAppConfig(config) {
  try {
    const configPath = getConfigPath();
    const serialized = JSON.stringify(config ?? {}, null, 2);
    await fs.writeFile(configPath, serialized, 'utf8');
    return {
      success: true,
      path: configPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: getConfigPath()
    };
  }
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

ipcMain.handle('files:loadPaths', async (event, filePaths) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { files: [], missingPaths: [] };
  }

  try {
    return await readIniFilesWithMissing(filePaths);
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

ipcMain.handle('config:load', async () => {
  return loadAppConfig();
});

ipcMain.handle('config:save', async (event, config) => {
  return saveAppConfig(config);
});
