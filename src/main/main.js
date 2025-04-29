/** main.js (src/main/main.js) - ปรับให้รองรับ dev/build */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');




let rosWorker;

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = 'http://localhost:5173';
const VITE_DIST_PATH = path.join(__dirname, '../../dist');

// Quick Fix ชั่วคราวตอน dev ทำ proxy ไฟล์ผ่าน express หรือ http server
if (isDev) {
  const express = require('express');
  const serveStatic = require('serve-static');
  const appServer = express();
  appServer.use('/videos', serveStatic('/home/leoss/Videos/dummy'));

  appServer.listen(3001, () => {
    console.log('🎥 Video static server running on http://localhost:3001/videos');
  });
}

//////////////////////////////////////////////////////////////////

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

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(VITE_DIST_PATH, 'index.html'));
  }
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

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

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

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('load:videos', async (event, folderPath) => {
  if (!folderPath) return [];
  const files = fs.readdirSync(folderPath);
  return files.filter(f => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov'));
});

app.on('before-quit', () => {
  if (rosWorker) {
    rosWorker.terminate();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
