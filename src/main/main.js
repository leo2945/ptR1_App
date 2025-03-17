// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads'); // นำเข้า Worker
let rosWorker; // Store the worker here

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  try {
    rosWorker = new Worker(path.join(__dirname, 'server.js'));

    rosWorker.on('message', (message) => {
      console.log('👷 Worker Response:', message);
    });

    rosWorker.on('error', (error) => {
      console.error('❌ Worker Error:', error);
    });

    rosWorker.on('exit', (code) => {
      console.log(`🛑 Worker exited with code ${code}`);
    });

    rosWorker.postMessage({ type: 'connectROS', url: 'ws://127.0.0.1:9090' });
    rosWorker.postMessage({ type: 'startWSS', port: 8080 });
  } catch (error) {
    console.error('❌ Failed to create Worker:', error);
  }

  //listen from worker process
  rosWorker.on('message', (message) => {
    switch (message.type) {
      case 'log':
        console.log(message.data);
        break;
    }
  });
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// รับข้อมูลจาก Renderer แล้วส่งไป ROSBridge
ipcMain.on('key-command', (_, { command }) => {
  if (rosWorker) {
    rosWorker.postMessage({ type: 'sendDrive', command: command });
  } else {
    console.error('❌ Worker not initialized when sending key-command');
  }
});

ipcMain.on('uint32-command', (_, { command }) => {
  console.log(`🎮 Received uint32 Command: ${command} (main log)`);
  rosWorker.postMessage({ type: 'sendCmd', command: command });
});

ipcMain.handle('get-ws-port', async () => {
    return 8080;
});

app.on('before-quit', () => {
  if (rosWorker) {
    rosWorker.terminate();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
