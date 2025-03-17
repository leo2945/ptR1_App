const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robotControl', {
  sendKeyCommand: (command) => ipcRenderer.send('key-command', {command}),
  sendCommand: (command) => ipcRenderer.send('uint32-command', { command }),
});

contextBridge.exposeInMainWorld('api', {
  getWebSocketPort: () => ipcRenderer.invoke('get-ws-port'), // ✅ ฟังก์ชันขอพอร์ต
});