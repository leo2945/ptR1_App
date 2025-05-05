const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robotControl', {
  sendKeyCommand: (command) => ipcRenderer.send('key-command', {command}),
  sendServoCommand: (command) => ipcRenderer.send('servo-command', {command}),
  sendCommand: (command) => ipcRenderer.send('uint32-command', {command}),
});

contextBridge.exposeInMainWorld('api', {
  getWebSocketPort: () => ipcRenderer.invoke('get-ws-port'), // ฟังก์ชันขอพอร์ต
});

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  loadVideosFromFolder: (customPath) => ipcRenderer.invoke('load:videos', customPath),
  //onImage: (callback) => ipcRenderer.on('camera:image', (event, data) => callback(data)),
  connectROSBridge: (ip) => ipcRenderer.send('connect-rosbridge', ip),
  sendRelayCommand: (relayId, command) => ipcRenderer.send('relay-command', { relayId, command }),
  setManualMode: (state) => ipcRenderer.send('set-manual-mode', { state }),
  saveVideo: ({ buffer, date, filename }) => {
    const nodeBuffer = Buffer.from(buffer);
    ipcRenderer.send('save-video', { buffer: nodeBuffer, date, filename });
  },
  connectCameraWS: (ip) => ipcRenderer.send('connect-camera-ws', ip),
  onImage: (callback) => ipcRenderer.on('camera:image', (_, data) => callback(data)),

});