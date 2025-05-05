const { parentPort } = require('worker_threads');
const ROSLIB = require('roslib');
const WebSocket = require('ws');

let ros;
let reconnectInterval = 5000; // ระยะเวลาในการลองเชื่อมต่อใหม่ (ms)
let rosbridgeURL = '';
let reconnectTimer = null;
let rosAutoConnected = false;

let cameraSocket = null;


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
      case 'sendServo':
          sendServo(message.command);
          break;
      case 'sendRelay':
        sendRelayViaCommand(message.relayId, message.command);
        break;
      case 'connectCameraWS':
        connectCameraSocket(message.url);
        break;
      default:
          console.log(`Server : ❌ Unknown command: ${message.type}`);
  }
});

// 🌐 ฟังก์ชันเชื่อมต่อ ROSBridge
function connectROSBridge(url) {
  rosAutoConnected = true;
  
  
  if (ros && ros.isConnected && rosbridgeURL === url) {
    console.log('Server : ✅ Already connected to ROSBridge at ', url);
    //parentPort.postMessage({ type: 'log', data: 'Connected to ROSBridge' });
    return;
  }

  if (ros) {
    console.log('Server : 🔄 Closing previous ROSBridge connection before reconnecting...');
    //parentPort.postMessage({ type: 'log', data: 'Server : Closing previous ROSBridge connection before reconnecting...' });
    ros.close();
  }


  rosbridgeURL = url;
  ros = new ROSLIB.Ros({ 
    url: url,
    encoding: 'ascii'
  });

  ros.on('connection', () => {
    console.log('Server : ✅ Connected to ROSBridge at', url);
    //subscribe function
    subscribeMapData();
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      console.log('Server : 🛑 Reconnect attempts stopped after successful connection at', url);
    }
  });

  ros.on('error', (error) => {
    console.log('Server : ❌ Error connecting to ROSBridge:');
    //console.log('Server : ❌ Error connecting to ROSBridge:', error);
    startReconnect();
  });

  ros.on('close', () => {
    console.log('Server : 🔌❌ Connection to ROSBridge closed url : ',url);
    startReconnect();
  });
}

function startReconnect() {
  if (!reconnectTimer) {
    console.log(`Server : 🔄 Attempting to reconnect to ROSBridge every ${reconnectInterval / 1000} seconds...`);
    reconnectTimer = setInterval(() => {
      if (!ros.isConnected) {
        console.log('Server : 🔗 Reconnecting to ROSBridge at', rosbridgeURL);
        connectROSBridge(rosbridgeURL); // ✅ ใช้ IP ล่าสุดที่รับเข้ามา
      } else {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    }, reconnectInterval);
  }
}

function sendRelayViaCommand(relayId, command) {
  const relayCommandMap = {
    relay1: {
      on:  0x08000000,
      off: 0x08000001
    },
    relay2: {
      on:  0x08000002,
      off: 0x08000003
    }
  };

  const cmdValue = relayCommandMap[relayId]?.[command];
  if (cmdValue === undefined) {
    console.error(`Server : ❌ Unknown relay command: ${relayId}, ${command}`);
    return;
  }

  console.log(`Server : 📤 Relay ${relayId} ${command.toUpperCase()} → HEX: ${cmdValue.toString(16)} → DEC: ${cmdValue}`);
  sendCommand(cmdValue);
}


// 📤 ส่งคำสั่ง UInt32 Command ไปยัง ROSBridge สำหรับคำสั่งต่างๆ
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

// 📤 ส่งคำสั่ง UInt16 Command ไปยัง ROSBridge สำหรับการเคลื่อนไหวของล้อ
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

// 📤 ส่งคำสั่ง UInt8 Command ไปยัง ROSBridge สำหรับการเคลื่อนไหวของ servo
function sendServo(command) {
  const uint8Value = command & 0xFF; // ให้แน่ใจว่าอยู่ในช่วง 8-bit
  console.log(`Server : Sending uint8 Command: ${uint8Value}`);
  const cmdVelTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/rb/cm/sv',
    messageType: 'std_msgs/UInt8'
  });

  const message = new ROSLIB.Message({
    data: uint8Value
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


function connectCameraSocket(wsUrl) {
  if (cameraSocket) {
    cameraSocket.close();
    cameraSocket = null;
  }

  console.log(`[Camera] Connecting to ${wsUrl}`);

  cameraSocket = new WebSocket(wsUrl);
  cameraSocket.binaryType = 'arraybuffer';

  cameraSocket.onopen = () => {
    console.log('[Camera] Connected');
  };

  cameraSocket.onmessage = (event) => {
    const jpegBuffer = Buffer.from(event.data);
    //debug jpegBuffer response
    parentPort.postMessage({ type: 'image', data: jpegBuffer });
  };

  cameraSocket.onclose = () => {
    console.warn('[Camera] Disconnected, retrying in 3s...');
    setTimeout(() => connectCameraSocket(wsUrl), 3000);
  };

  cameraSocket.onerror = (err) => {
    console.error('[Camera] Error:', err);
    cameraSocket.close();
  };
}


setTimeout((url) => {
  if (!rosAutoConnected) {
    console.log('Server : ⏳ No IP received in 3s, connecting to localhost fallback...');
  }
}, 3000);




parentPort.postMessage({ type: 'log', data: 'Worker Initialized' });

module.exports = {
  connectROSBridge,
  sendDrive,
  sendCommand,
  sendServo
};
