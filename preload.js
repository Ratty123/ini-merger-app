const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iniMergerAPI', {
  openFiles: () => ipcRenderer.invoke('files:open'),
  saveFile: (content) => ipcRenderer.invoke('files:save', content)
});
