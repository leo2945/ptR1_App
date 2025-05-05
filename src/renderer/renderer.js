const isDev = window.location.hostname === "localhost";

// Capture canvas elements
const canvas = document.getElementById('capture-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-record');
const stopBtn = document.getElementById('stop-record');

// Video elements
const videoElement = document.getElementById("video"); 
const videoListEl = document.getElementById("video-list"); 
const videoPlayer = document.getElementById("video-player"); 
const videoGallery = document.getElementById("video-gallery"); 

// Mode toggle elements
const keyboardToggle = document.getElementById("keyboard-toggle");
const modeLabel = document.getElementById("mode-label");

// ผูก event relay button
document.getElementById("relayButton1").addEventListener("click", () => toggleRelay("relayButton1"));
document.getElementById("relayButton2").addEventListener("click", () => toggleRelay("relayButton2"));

let mediaRecorder = null;
let recordedChunks = [];
let recordingInterval = null;
let isRecording = false;
let currentVideoFolder = null; // เก็บ path ปัจจุบันไว้

const RECORD_DURATION_MS = 10 * 60 * 1000; // 10 นาที
//const RECORD_DURATION_MS = 10 * 1000; // 10 วินาที


// Electron camera listener
window.electronAPI?.onImage((data) => {
  const blob = new Blob([data], { type: "image/jpeg" });

  // 🟢 Log ภาพ blob ที่เข้ามา
  //console.log(`📸 Image blob received: ${blob.size} bytes`);

  const url = URL.createObjectURL(blob);
  const stream = document.getElementById("stream");
  const homeStream = document.getElementById("stream-home");
  if (stream) stream.src = url;
  if (homeStream) homeStream.src = url;

  const img = new Image();
  img.onload = () => {
    // ตรวจสอบขนาดภาพ
    //console.log(`Image loaded: ${img.width}x${img.height}`);

    // ลองตรวจสอบ canvas ก่อนวาด
    //const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    //const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // เช็กว่า pixel เปลี่ยนไปหรือไม่
    //const changed = before.some((val, idx) => val !== after[idx]);
    //console.log(`Canvas updated: ${changed ? 'YES' :  NO'}`);

    URL.revokeObjectURL(img.src);
  };
  img.src = url;
});



function startNewRecordingCycle() {
  const stream = canvas.captureStream(15); // 15 FPS
  recordedChunks = [];

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });

    if (blob.size === 0) {
      console.warn("⚠️ Skipped empty recording (0 byte)");
      if (isRecording) startNewRecordingCycle();
      return;
    }
  
    // สร้าง Object URL เพื่อให้ดาวน์โหลดทันที (optional)
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `stream_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    // a.click();
  
    // แยกวันและเวลา
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // yyyy-mm-dd
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-'); // hh-mm
  
    // ส่ง blob ไป main process
    blob.arrayBuffer().then((arrayBuf) => {
      window.electronAPI.saveVideo({
        buffer: arrayBuf,
        date: dateStr,
        filename: `record-${timeStr}.webm`
      });
  
      // เริ่มรอบถัดไปถ้ายังไม่หยุด
      if (isRecording) {
        startNewRecordingCycle();
      }
    });
  };
  

  mediaRecorder.onstart = () => {
    recordingInterval = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, RECORD_DURATION_MS);
  };
  
  mediaRecorder.start();

}

// ▶️ เริ่มบันทึกวนลูป
startBtn.addEventListener('click', () => {
  if (isRecording) return;
  isRecording = true;
  startNewRecordingCycle();
  startBtn.disabled = true;
  stopBtn.disabled = false;
});

stopBtn.addEventListener('click', () => {
  if (!isRecording) return;
  isRecording = false;

  clearTimeout(recordingInterval);

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop(); // stop ล่าสุด → onstop จะไม่เรียกถัดไปแล้ว
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
});

// RosBridge IP Dropdown selection
document.getElementById('selected-ip').addEventListener('click', () => {
  const ip = document.getElementById('ip-dropdown').value;

  //เชื่อมต่อ ROSBridge ที่ IP ที่เลือก
  window.electronAPI.connectROSBridge(ip);
});

//relay button states
const relayStates = {
  relay1: false,
  relay2: false
};

// Map ปุ่ม HTML ID → ชื่อ relay ใน ROS
const relayIdMap = {
  relayButton1: 'relay1',
  relayButton2: 'relay2'
};

// relay button update
function updateButton(buttonId) {
  const relayId = relayIdMap[buttonId];
  const btn = document.getElementById(buttonId);
  btn.textContent = `${relayId.toUpperCase()}: ${relayStates[relayId] ? "ON" : "OFF"}`;

  if (relayStates[relayId]) {
    btn.classList.remove("off");
    btn.classList.add("on");
  } else {
    btn.classList.remove("on");
    btn.classList.add("off");
  }
}
// relay toggle
function toggleRelay(buttonId) {
  const relayId = relayIdMap[buttonId];
  relayStates[relayId] = !relayStates[relayId];
  updateButton(buttonId);
  window.electronAPI.sendRelayCommand(relayId, relayStates[relayId] ? "on" : "off");
}

// Manual mode toggle
keyboardToggle.addEventListener('change', (event) => {
  const isOn = event.target.checked;
  modeLabel.textContent = isOn ? 'MANUAL ON' : 'MANUAL OFF';

  console.log(isOn ? '🛠 Switched to MANUAL ON' : '🛑 Switched to MANUAL OFF');
  window.electronAPI.setManualMode(isOn);
});



async function loadVideos(pathOverride = null) {
  const videoGallery = document.getElementById("video-gallery");
  const videoPlayer = document.getElementById("video-player");

  const videos = await window.electronAPI.loadVideosFromFolder(pathOverride);
  if (pathOverride) currentVideoFolder = pathOverride;

  videoGallery.innerHTML = '';

  videos.forEach(({ relativePath }) => {
    const videoSrc = isDev
    ? `http://localhost:3001/videos/${relativePath.replace(/\\/g, '/')}`
    : `file://${path.join(app.getPath('videos'), 'ptR1', relativePath)}`;

    const thumb = document.createElement("video");
    thumb.src = videoSrc;
    thumb.className = "video-thumb";
    thumb.muted = true;
    thumb.loop = true;

    thumb.addEventListener("click", () => {
      const source = videoPlayer.querySelector("source");
      source.src = videoSrc;
      videoPlayer.load();
      console.log('🎥 Playing from:', videoSrc)
    
      videoPlayer.onloadeddata = () => {
        videoPlayer.play().catch((err) => {
          console.warn("🎥 Video play interrupted:", err.message);
        });
      };
    });
    

    videoGallery.appendChild(thumb);
  });
}


// 📂 ปุ่มเปลี่ยนโฟลเดอร์
document.getElementById("select-folder-btn").addEventListener("click", async () => {
  const folderPath = await window.electronAPI.selectFolder();
  if (folderPath) {
    await loadVideos(folderPath); // ✅ ใช้ path ใหม่
  }
});