const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robotControl', {
  sendKeyCommand: (command) => ipcRenderer.send('key-command', {command}),
  sendCommand: (command) => ipcRenderer.send('uint32-command', { command }),
});

contextBridge.exposeInMainWorld('api', {
  getWebSocketPort: () => ipcRenderer.invoke('get-ws-port'), // ✅ ฟังก์ชันขอพอร์ต
});

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  loadVideosFromFolder: (folderPath) => ipcRenderer.invoke('load:videos', folderPath),
  onImage: (callback) => ipcRenderer.on('camera:image', (event, data) => callback(data))
});