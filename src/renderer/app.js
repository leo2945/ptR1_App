
console.log('👷 app.js started');

let cameraSocket = null;

function connectCameraSocket() {
  console.log('app: Connecting to camera socket...');

  const ipInput = document.getElementById('ipInput');
  const ip = ipInput?.value || 'localhost'; // ถ้าไม่มี ipInput ให้ fallback เป็น localhost
  const wsURL = `ws://${ip}:8181`;

  cameraSocket = new WebSocket(wsURL);
  cameraSocket.binaryType = 'blob';

  cameraSocket.onopen = () => {
    console.log(`app: Camera socket connected to ${wsURL}`);
  };

  cameraSocket.onmessage = (event) => {
    const streamElement = document.getElementById('stream');
    if (event.data instanceof Blob) {
      const url = URL.createObjectURL(event.data);
      streamElement.src = url;
      streamElement.onload = () => {
        URL.revokeObjectURL(url);
      };
    }
  };

  cameraSocket.onclose = () => {
    console.warn('Camera socket closed. Reconnecting in 3 seconds...');
    setTimeout(connectCameraSocket, 3000);
  };

  cameraSocket.onerror = (error) => {
    console.error('Camera socket error:', error);
    cameraSocket.close();
  };
}


document.addEventListener('DOMContentLoaded', () => {
  console.log("app: DOMContentLoaded fired!");
  const keyboardToggle = document.getElementById('keyboard-toggle');
  const pwmInput = document.getElementById('pwm-value');
  const cmdDropdown = document.getElementById('cmd-dropdown');
  const sendSelectedCmdButton = document.getElementById('send-selected-cmd-button');
  const cmdInput = document.getElementById('cmd-input');
  const sendCustomCmdButton = document.getElementById('send-custom-cmd-button');
  const modeLabel = document.getElementById('mode-label');
  const connectButton = document.getElementById('connectButton');

  // connect image ws ip
  connectButton.addEventListener('click', () => {
    connectCameraSocket();
  });

  // ถ้าอยาก auto-connect ตอนแรกก็เปิดบรรทัดนี้ได้
  // connectCameraSocket();

  if (!keyboardToggle || !pwmInput || !cmdDropdown || !sendSelectedCmdButton || !cmdInput || !sendCustomCmdButton || !modeLabel) {
    console.error("❌ UI elements not found! Check HTML structure.");
    return;
  }

  // ✅ เมื่อสลับสวิตช์ keyboard toggle → เปลี่ยน label
  keyboardToggle.addEventListener('change', (event) => {
    const isManual = event.target.checked;
    modeLabel.textContent = isManual ? 'MANUAL' : 'AUTO';

    if (isManual) {
      console.log('🛠 Mode switched to MANUAL');
    } else {
      console.log('🚗 Mode switched to AUTO');
    }
  });

  let intervalId = null;
  let activeKey = null;

  // ✅ กดคีย์เพื่อส่ง Drive Command
  document.addEventListener('keydown', (event) => {
    if (activeKey === event.key) return;

    activeKey = event.key;
    sendKeyDrive(activeKey);

    intervalId = setInterval(() => {
      sendKeyDrive(activeKey);
    }, 100);
  });

  document.addEventListener('keyup', () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      activeKey = null;
    }
  });

  // ✅ ฟังก์ชันส่ง UInt32 command
  const sendUInt32Command = (command) => {
    if (isNaN(command) || command < 0 || command > 0xFFFFFFFF) {
      console.error('❌ Invalid UInt32 value');
      return;
    }
    console.log(`Sending UInt32 Command: ${command}`);
    window.robotControl.sendCommand(command);
  };

  // ✅ กดปุ่มส่งจาก Dropdown
  sendSelectedCmdButton.addEventListener('click', () => {
    const selectedCmd = parseInt(cmdDropdown.value);
    sendUInt32Command(selectedCmd);
  });

  // ✅ กดปุ่มส่งจาก Text Input
  sendCustomCmdButton.addEventListener('click', () => {
    const customCmd = parseInt(cmdInput.value, 16);
    sendUInt32Command(customCmd);
  });
});

// ✅ ฟังก์ชันส่ง Drive command เฉพาะตอน MANUAL
const sendKeyDrive = (key) => {
  if (!key) return; 
  const keyboardToggle = document.getElementById('keyboard-toggle');
  const pwmInput = document.getElementById('pwm-value');
  const modeLabel = document.getElementById('mode-label');

  if (!keyboardToggle || !pwmInput || !modeLabel) return;
  if (modeLabel.textContent.trim().toUpperCase() !== 'MANUAL') return; // ✅ ต้องเป็น MANUAL เท่านั้น

  let command;
  let pwm = parseInt(pwmInput.value) || 70;
  if (pwm > 255) pwm = 255;
  if (pwm < 0) pwm = 0;

  switch (key.toLowerCase()) {
    case 'w': command = 0x0100 + pwm; break;//forward
    case 's': command = 0x0400 + pwm; break;//backward
    case 'a': command = 0x0200 + pwm; break;//left
    case 'd': command = 0x0300 + pwm; break;//right
    case 'r': command = 0x0500 + pwm; break;//turn left
    case 'f': command = 0x0600 + pwm; break;//turn right
    case 'e': command = 0x0700 + pwm; break;//forward left
    case 'q': command = 0x0800 + pwm; break;//forward right
    default: return;
  }

  command = command & 0xFFFF;
  console.log(`Key pressed: ${key} -> Command: ${command.toString(16).toUpperCase()}, PWM: ${pwm}`);
  window.robotControl.sendKeyCommand(command);
};



