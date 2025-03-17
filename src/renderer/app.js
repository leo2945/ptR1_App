const sendKeyDrive = (key) => {
  const keyboardToggle = document.getElementById('keyboard-toggle');
  const pwmInput = document.getElementById('pwm-value');

  if (!keyboardToggle || !pwmInput || !keyboardToggle.checked) return;

  let command;
  let pwm = parseInt(pwmInput.value) || 70;
  if (pwm > 255) pwm = 255;
  if (pwm < 0) pwm = 0;

  switch (key.toLowerCase()) {
    case 'w': command = 0x0100 + pwm; break;
    case 's': command = 0x0400 + pwm; break;
    case 'a': command = 0x0200 + pwm; break;
    case 'd': command = 0x0300 + pwm; break;
    default: return;
  }

  command = command & 0xFFFF;
  console.log(`Key pressed: ${key} -> Command: ${command.toString(16).toUpperCase()}, PWM: ${pwm}`);
  window.robotControl.sendKeyCommand(command);
};

document.addEventListener('DOMContentLoaded', () => {
  const keyboardToggle = document.getElementById('keyboard-toggle');
  const pwmInput = document.getElementById('pwm-value');

  const cmdDropdown = document.getElementById('cmd-dropdown');
  const sendSelectedCmdButton = document.getElementById('send-selected-cmd-button');
  const cmdInput = document.getElementById('cmd-input');
  const sendCustomCmdButton = document.getElementById('send-custom-cmd-button');

  if (!keyboardToggle || !pwmInput || !cmdDropdown || !sendSelectedCmdButton || !cmdInput || !sendCustomCmdButton) {
    console.error("❌ UI elements not found! Check HTML structure.");
    return;
  }

  let intervalId = null;
  let activeKey = null;

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

  const sendUInt32Command = (command) => {
    if (isNaN(command) || command < 0 || command > 0xFFFFFFFF) {
      console.error('❌ Invalid UInt32 value');
      return;
    }
    console.log(`Sending UInt32 Command: ${command}`);
    window.robotControl.sendCommand(command);
  };

  sendSelectedCmdButton.addEventListener('click', () => {
    const selectedCmd = parseInt(cmdDropdown.value);
    sendUInt32Command(selectedCmd);
  });

  sendCustomCmdButton.addEventListener('click', () => {
    const customCmd = parseInt(cmdInput.value, 16);
    sendUInt32Command(customCmd);
  });
});


