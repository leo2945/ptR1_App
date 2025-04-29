const { parentPort } = require('worker_threads');
const ROSLIB = require('roslib');
const WebSocket = require('ws');

let ros;
let reconnectInterval = 5000; // ระยะเวลาในการลองเชื่อมต่อใหม่ (ms)
let rosbridgeURL = '';
let reconnectTimer = null;


parentPort.on('message', (message) => {
  switch (message.type) {
      case 'connectROS':
          connectROSBridge(message.url);
          break;
      case 'sendDrive':
          sendDrive(message.command);
          break;
      case 'sendCmd':
          sendCommand(message.command);
          break;
      default:
          console.log(`Server : ❌ Unknown command: ${message.type}`);
  }
});

// 🌐 ฟังก์ชันเชื่อมต่อ ROSBridge
function connectROSBridge(url) {
  if (ros && ros.isConnected) {
    console.log('Server : ✅ Already connected to ROSBridge');
    parentPort.postMessage({ type: 'log', data: 'Connected to ROSBridge' });
    return;
  }

  if (ros) {
    console.log('Server : 🔄 Closing previous ROSBridge connection before reconnecting...');
    parentPort.postMessage({ type: 'log', data: 'Server : Closing previous ROSBridge connection before reconnecting...' });
    ros.close();
  }

  rosbridgeURL = url;
  ros = new ROSLIB.Ros({ 
    url: url,
    encoding: 'ascii'
  });

  ros.on('connection', () => {
    console.log('Server : ✅ Connected to ROSBridge');
    //subscribe function
    subscribeMapData();
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      console.log('Server : 🛑 Reconnect attempts stopped after successful connection.');
    }
  });

  ros.on('error', (error) => {
    console.log('Server : ❌ Error connecting to ROSBridge:');
    //console.log('Server : ❌ Error connecting to ROSBridge:', error);
    startReconnect();
  });

  ros.on('close', () => {
    console.log('Server : 🔌 Connection to ROSBridge closed');
    startReconnect();
  });
}

function startReconnect() {
  if (!reconnectTimer) {
    console.log(`Server : 🔄 Attempting to reconnect to ROSBridge every ${reconnectInterval / 1000} seconds...`);
    reconnectTimer = setInterval(() => {
      if (!ros.isConnected) {
        console.log('Server : 🔗 Reconnecting to ROSBridge...');
        connectROSBridge(rosbridgeURL);
      } else {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    }, reconnectInterval);
  }
}



// 📤 ส่งคำสั่ง UInt32 Command ไปยัง ROSBridge
function sendCommand(command) {
  if (!ros || !ros.isConnected) {
    console.error('Server : ❌ Cannot send command: ROSBridge is not connected.');
    return;
  }
  const uint32Value = command >>> 0;
  console.log(`Server : 📤 Sending UInt32 Command: ${uint32Value}`);

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
  console.log(`Server : Sending uint16 Command: ${uint16Value}`);
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

parentPort.postMessage({ type: 'log', data: 'Worker Initialized' });

module.exports = {
  connectROSBridge,
  sendDrive,
  sendCommand
};
