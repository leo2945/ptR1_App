
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

const pwmSlider = document.getElementById('pwm-slider');
const pwmValueLabel = document.getElementById('pwm-value-label');

if (pwmSlider && pwmValueLabel) {
  pwmSlider.addEventListener('input', () => {
    pwmValueLabel.textContent = pwmSlider.value;
  });
}



  




 
  
  