
  const items = document.querySelectorAll(".sidebar-item");
  const views = document.querySelectorAll(".view");
  
  items.forEach(item => {
    item.addEventListener("click", () => {
      items.forEach(i => i.classList.remove("active"));
      views.forEach(v => v.classList.add("hidden"));
      item.classList.add("active");
      document.getElementById("view-" + item.dataset.view).classList.remove("hidden");
    });
  });
  
  // Electron camera listener
  window.electronAPI?.onImage((data) => {
    const blob = new Blob([data], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    const stream = document.getElementById("stream");
    const homeStream = document.getElementById("stream-home");
    if (stream) stream.src = url;
    if (homeStream) homeStream.src = url;
  });
  
  