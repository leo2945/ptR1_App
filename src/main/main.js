/** main.js (src/main/main.js) - ปรับให้รองรับ dev/build */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');
const { exec } = require('child_process');

let rosWorker;
let mainWindow;

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = 'http://localhost:5173';
const VITE_DIST_PATH = path.join(__dirname, '../../dist');

// Quick Fix ชั่วคราวตอน dev ทำ proxy ไฟล์ผ่าน express หรือ http server
if (isDev) {
  const express = require('express');
  const serveStatic = require('serve-static');
  const appServer = express();
  appServer.use('/videos', serveStatic('/home/leoss/Videos/ptR1'));

  appServer.listen(3001, () => {
    console.log('🎥 Video static server running on http://localhost:3001/videos');
  });
}

//////////////////////////////////////////////////////////////////

function createWindow(ip) {
  const wsURL = `ws://${ip}:8181`;
  const mediaURL = `http://${"127.0.0.1"}:3001`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,

      contentSecurityPolicy: `
        default-src 'self';
        script-src 'self';
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: blob:;
        connect-src 'self' ws: http:;
        media-src 'self' blob: http:;
      `
    
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
      switch (message.type) {
        case 'image':
          mainWindow?.webContents.send('camera:image', message.data);
          break;
        case 'power':
          mainWindow?.webContents.send('power', message.data);
          break;
        case 'log':
          console.log('Worker Log:', message.data);
          break;
        case 'error':
          console.error('Worker Error:', message.data);
          break;
        case 'connection':
          mainWindow?.webContents.send('connection-status', message.data);
          break;
        default:
          console.warn('Unknown message from worker:', message);
      }
    });
  
    rosWorker.on('error', (error) => {
      console.error('❌ Worker Error:', error);
    });
  
    rosWorker.on('exit', (code) => {
      console.log(`🛑 Worker exited with code ${code}`);
    });
  
    ipcMain.on('uint32-command', (event, message) => {
    const variableId = message.variableId & 0xFF;
    const value = message.value & 0xFFFFFF;
    const command = (variableId << 24) | value;

    console.log(`📦 sendCommand: ID=${variableId}, Value=${value}, UInt32=0x${command.toString(16)}`);

    rosWorker.postMessage({ type: 'command', command });
  });

    //rosWorker.postMessage({ type: 'connectROS', url: 'ws://127.0.0.1:9090' });
    //rosWorker.postMessage({ type: 'startWSS', port: 8080 });
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

ipcMain.on('servo-command', (_, { command }) => {
  if (rosWorker) {
    rosWorker.postMessage({ type: 'sendServo', command: command });
  } else {
    console.error('❌ Worker not initialized when sending servo-command');
  }
});

ipcMain.on('uint32-command', (_, { command }) => {
  if (!rosWorker) {
    console.error('❌ Worker not initialized when sending uint32-command');
    return;
  }
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

const getAllVideoFiles = (dirPath, arrayOfFiles = []) => {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllVideoFiles(fullPath, arrayOfFiles);
    } else if (/\.(mp4|webm|mov)$/i.test(file)) {
      arrayOfFiles.push({
        path: fullPath,
        relativePath: path.relative(path.join(app.getPath('videos'), 'ptR1'), fullPath),
        name: file,
        mtime: stat.mtimeMs
      });
    }
  });
  return arrayOfFiles;
};

ipcMain.handle('load:videos', async (event, customPath = null) => {
  const baseDir = customPath || path.join(app.getPath('videos'), 'ptR1');
  if (!fs.existsSync(baseDir)) return [];

  const allVideos = getAllVideoFiles(baseDir);
  allVideos.sort((a, b) => b.mtime - a.mtime); // เรียงจากใหม่ → เก่า

  return allVideos;
});

ipcMain.on('relay-command', (_, { relayId, command }) => {
  if (!rosWorker) {
    console.error('❌ Worker not initialized when sending relay-command');
    return;
  }
  console.log(`🔧 Received relay command: ${relayId} → ${command}`);
  rosWorker.postMessage({
    type: 'sendRelay',
    relayId,
    command
  });
});

ipcMain.on('set-manual-mode', (event, { state }) => {
  if (state) {
    const command = 0x05000001; // เปิด MANUAL
    console.log(`Main: Switching MANUAL MODE ON → Send: 0x${command.toString(16)}`);
    rosWorker.postMessage({ type: 'sendCmd', command });
  } else {
    console.log('Main: Switching MANUAL MODE OFF → (no command sent)');
    // ไม่ส่งอะไร
  }
});

ipcMain.on('save-video', (event, { buffer, date, filename }) => {
  const baseDir = path.join(app.getPath('videos'), 'ptR1', date);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const webmPath = path.join(baseDir, filename);
  const mp4Path = webmPath.replace(/\.webm$/, '.mp4');

  // เขียนไฟล์ .webm
  fs.writeFile(webmPath, buffer, (err) => {
    if (err) {
      console.error(`❌ Write .webm failed: ${err}`);
      return;
    }
  
    // ✅ หลังเขียนเสร็จแน่นอน ค่อยแปลง
    const cmd = `ffmpeg -y -i "${webmPath}" -c:v libx264 -c:a aac "${mp4Path}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ FFmpeg error: ${error.message}`);
        console.error(stderr); // 🟡 ดูรายละเอียดเพิ่ม
        return;
      }
      console.log(`✅ Saved MP4: ${mp4Path}`);
    });
  });
});

ipcMain.on('connect-camera-ws', (event, ip) => {
  const camUrl = `ws://${ip}:8181`;
  rosWorker.postMessage({ type: 'connectCameraWS', url: camUrl });
  console.log(`Main: 🎥 Connecting to camera at ${camUrl}`);
});

app.on('before-quit', () => {
  if (rosWorker) {
    rosWorker.terminate();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('connect-rosbridge', (event, ip) => {
  const url = `ws://${ip}:9090`;
  rosWorker.postMessage({ type: 'connectROS', url: url });
  console.log(`Main: 🔌 Connecting to ROSBridge at ${url}`);
});
