const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iniMergerAPI', {
  openFiles: () => ipcRenderer.invoke('files:open'),
  loadFilesByPath: (filePaths) => ipcRenderer.invoke('files:loadPaths', filePaths),
  saveFile: (content) => ipcRenderer.invoke('files:save', content),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config)
});
