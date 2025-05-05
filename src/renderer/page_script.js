
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
  




 
  
  