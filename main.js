const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile('index.html');

  // Prevent all external internet requests
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    // Allow only file:// protocol and local devtools resources
    if (url.startsWith('file://') || url.startsWith('devtools://')) {
      callback({ cancel: false });
    } else {
      callback({ cancel: true });
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

ipcMain.handle('open-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'INI Files', extensions: ['ini', 'txt'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const fileContents = {};
    for (const filePath of result.filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        fileContents[filePath] = {
          content,
          name: path.basename(filePath)
        };
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }
    return fileContents;
  }
  return {};
});

ipcMain.handle('save-file', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Merged INI File',
    defaultPath: 'merged_engine.ini',
    filters: [{ name: 'INI Files', extensions: ['ini'] }]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('Error saving file:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: false };
});
