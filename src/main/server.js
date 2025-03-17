const { parentPort } = require('worker_threads');
const ROSLIB = require('roslib');
const WebSocket = require('ws');

let ros;
let wsServer;
let reconnectInterval = 5000; // ระยะเวลาในการลองเชื่อมต่อใหม่ (ms)
let rosbridgeURL = '';
let reconnectTimer = null;
let currentPort = 8080;


parentPort.on('message', (message) => {
  switch (message.type) {
      case 'connectROS':
          connectROSBridge(message.url);
          break;
      case 'startWSS':
          startWebSocketServer(message.port);
          break;
      case 'sendDrive':
          sendDrive(message.command);
          break;
      case 'sendCmd':
          sendCommand(message.command);
          break;
      default:
          console.log(`❌ Unknown command: ${message.type}`);
  }
});

// 🌐 ฟังก์ชันเชื่อมต่อ ROSBridge
function connectROSBridge(url) {
  if (ros && ros.isConnected) {
    console.log('✅ Already connected to ROSBridge');
    parentPort.postMessage({ type: 'log', data: 'Connected to ROSBridge' });
    return;
  }

  if (ros) {
    console.log('🔄 Closing previous ROSBridge connection before reconnecting...');
    parentPort.postMessage({ type: 'log', data: 'Closing previous ROSBridge connection before reconnecting...' });
    ros.close();
  }

  rosbridgeURL = url;
  ros = new ROSLIB.Ros({ 
    url: url,
    encoding: 'ascii'
  });

  ros.on('connection', () => {
    console.log('✅ Connected to ROSBridge');
    //subscrib function
    subscribeVideoStream();
    subscribeMapData();
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      console.log('🛑 Reconnect attempts stopped after successful connection.');
    }
  });

  ros.on('error', (error) => {
    console.log('❌ Error connecting to ROSBridge:', error);
    startReconnect();
  });

  ros.on('close', () => {
    console.log('🔌 Connection to ROSBridge closed');
    startReconnect();
  });
}

function startReconnect() {
  if (!reconnectTimer) {
    console.log(`🔄 Attempting to reconnect to ROSBridge every ${reconnectInterval / 1000} seconds...`);
    reconnectTimer = setInterval(() => {
      if (!ros.isConnected) {
        console.log('🔗 Reconnecting to ROSBridge...');
        connectROSBridge(rosbridgeURL);
      } else {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    }, reconnectInterval);
  }
}

// 🔗 สร้าง WebSocket Server สำหรับส่งข้อมูลวิดีโอ
function startWebSocketServer(port) {
  wsServer = new WebSocket.Server({ port });
  currentPort = port;
  wsServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`⚡ Port ${port} in use, trying port ${port + 1}...`);
      startWebSocketServer(port + 1);
    } else {
      console.error('❌ WebSocket server error:', error);
    }
  });
  wsServer.on('connection', (ws) => {
    console.log(`✅ WebSocket client connected on port ${port}`);
  });
  
}

// 📹 subscribe ภาพวิดีโอจาก ROS และส่งไปยัง WebSocket Client
function subscribeVideoStream() {
  try {
    const videoTopic = new ROSLIB.Topic({
      ros: ros,
      name: '/camera/image/compressed',
      messageType: 'sensor_msgs/CompressedImage',
    });

    videoTopic.subscribe((message) => {
      const base64Image = message.data;
      const payload = JSON.stringify({ type: 'video', data: base64Image });
      wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    });
  } catch (error) {
    console.error('❌ Error in subscribeVideoStream:', error);
  }
}

// 📤 ส่งคำสั่ง UInt32 Command ไปยัง ROSBridge
function sendCommand(command) {
  if (!ros || !ros.isConnected) {
    console.error('❌ Cannot send command: ROSBridge is not connected.');
    return;
  }
  const uint32Value = command >>> 0;
  console.log(`📤 Sending UInt32 Command: ${uint32Value}`);

  const cmdEditTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/rb/cm/ed',
    messageType: 'std_msgs/UInt32',
  });

  const message = new ROSLIB.Message({
    data: uint32Value,
  });

  cmdEditTopic.publish(message);
}

function sendDrive(command) {
  const uint16Value = command & 0xFFFF; // ให้แน่ใจว่าอยู่ในช่วง 16-bit
  console.log(`Sending uint16 Command: ${uint16Value}`);
  const cmdVelTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/rb/cm/dr',
    messageType: 'std_msgs/UInt16'
  });

  const message = new ROSLIB.Message({
    data: uint16Value
  });

  cmdVelTopic.publish(message);
}

// 🗺️ Subscribe ข้อมูลแผนที่จาก ROS
function subscribeMapData() {
  const mapTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/map',
    messageType: 'nav_msgs/OccupancyGrid',
  });

  mapTopic.subscribe((message) => {
    const payload = JSON.stringify({ type: 'map', data: message });
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  });
}

setTimeout(() => {
  connectROSBridge('ws://127.0.0.1:9090');
  //connectROSBridge('ws://100.65.44.67:9090');
}, 3000); // เพิ่มเวลา wait 3 วินาที

startWebSocketServer(8080);

process.on('SIGINT', () => {
  if (wsServer) {
    wsServer.close(() => {
      console.log('🛑 WebSocket server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

parentPort.postMessage({ type: 'log', data: 'Worker Initialized' });

module.exports = {
  connectROSBridge,
  startWebSocketServer,
  subscribeVideoStream,
  sendDrive,
  sendCommand,
  wsServer,
  getCurrentPort: () => currentPort,
};
