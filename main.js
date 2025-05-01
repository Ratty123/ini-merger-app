const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Handle file dialogs and operations
ipcMain.handle('open-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'INI Files', extensions: ['ini', 'txt'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const fileContents = {};
    
    // Read all selected files
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
    filters: [
      { name: 'INI Files', extensions: ['ini'] }
    ]
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