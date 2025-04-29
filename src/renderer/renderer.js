const isDev = window.location.hostname === "localhost"; // ✅ ต้องมี

const videoElement = document.getElementById("video"); 
const videoListEl = document.getElementById("video-list"); 
const videoPlayer = document.getElementById("video-player"); 
const videoGallery = document.getElementById("video-gallery"); 

// ปุ่มเลือกโฟลเดอร์วิดีโอ
document.getElementById("select-folder-btn").addEventListener("click", async () => {
  const folderPath = await window.electronAPI.selectFolder();
  if (!folderPath) return;

  const videos = await window.electronAPI.loadVideosFromFolder(folderPath);
  videoGallery.innerHTML = '';

  videos.forEach(filename => {
    const videoSrc = isDev 
      ? `http://localhost:3001/videos/${filename}` 
      : `file://${folderPath}/${filename}`;
    
    const thumb = document.createElement("video");
    thumb.src = videoSrc;
    thumb.className = "video-thumb";
    thumb.muted = true;
    thumb.loop = true;
    thumb.play();
  
    thumb.addEventListener("click", () => {
      videoPlayer.querySelector("source").src = videoSrc;
      videoPlayer.load();
      videoPlayer.play();
    });
  
    videoGallery.appendChild(thumb);
  });
});

