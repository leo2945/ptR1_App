console.log('👷 app.js started');

let cameraSocket = null;

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
  loadVideos(); 

  // connect image ws ip
  connectButton.addEventListener('click', () => {
    const ip = document.getElementById('ipInput')?.value || 'localhost';
    window.electronAPI.connectCameraWS(ip);
  });

  if (!keyboardToggle || !pwmInput || !cmdDropdown || !sendSelectedCmdButton || !cmdInput || !sendCustomCmdButton || !modeLabel) {
    console.error("❌ UI elements not found! Check HTML structure.");
    return;
  }

  const pressedKeys = new Set();
  const intervalMap = new Map();

  document.addEventListener('keydown', (event) => {
    const code = event.code;

    if (pressedKeys.has(code)) return; // กำลังถูกกดอยู่

    pressedKeys.add(code);

    const isServoKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);

    const intervalId = setInterval(() => {
      if (isServoKey) {
        sendServoControl(event);
      } else {
        sendKeyDrive(event);
      }
    }, isServoKey ? 150 : 100);

    intervalMap.set(code, intervalId);
  });

  document.addEventListener('keyup', (event) => {
    const code = event.code;

    if (intervalMap.has(code)) {
      clearInterval(intervalMap.get(code));
      intervalMap.delete(code);
    }

    pressedKeys.delete(code);
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

// ✅ ฟังก์ชันส่ง Drive command เฉพาะตอน MANUAL ON
const sendKeyDrive = (event) => {
  if (!event || !event.code) return;
  const keyboardToggle = document.getElementById('keyboard-toggle');
  const pwmInput = document.getElementById('pwm-value');
  const modeLabel = document.getElementById('mode-label');

  if (!keyboardToggle || !pwmInput || !modeLabel) return;
  if (modeLabel.textContent.trim().toUpperCase() !== 'MANUAL ON') return;

  let command;
  let pwm = parseInt(pwmInput.value) || 70;
  if (pwm > 255) pwm = 255;
  if (pwm < 0) pwm = 0;

  switch (event.code) {
    case 'KeyW': command = 0x0100 + pwm; break;
    case 'KeyS': command = 0x0400 + pwm; break;
    case 'KeyA': command = 0x0200 + pwm; break;
    case 'KeyD': command = 0x0300 + pwm; break;
    case 'KeyR': command = 0x0500 + pwm; break;
    case 'KeyF': command = 0x0600 + pwm; break;
    case 'KeyE': command = 0x0700 + pwm; break;
    case 'KeyQ': command = 0x0800 + pwm; break;
    default: return;
  }
  command = command & 0xFFFF;
  console.log(`Key pressed: ${event.code} -> Command: ${command.toString(16).toUpperCase()}, PWM: ${pwm}`);
  window.robotControl.sendKeyCommand(command);
};

const sendServoControl = (event) => {
  if (!event || !event.code) return;

  const keyboardToggle = document.getElementById('keyboard-toggle');
  const modeLabel = document.getElementById('mode-label');

  if (!keyboardToggle || !modeLabel) return;
  if (modeLabel.textContent.trim().toUpperCase() !== 'MANUAL ON') return;

  let command;

  switch (event.code) {
    case 'ArrowUp':    command = 0x01; break;
    case 'ArrowDown':  command = 0x02; break;
    case 'ArrowLeft':  command = 0x03; break;
    case 'ArrowRight': command = 0x04; break;
    default: return;
  }

  console.log(`Servo key: ${event.code} -> Command: ${command}`);
  window.robotControl.sendServoCommand(command);
};
