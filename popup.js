// Popup script for Supercast extension
document.addEventListener('DOMContentLoaded', () => {
  // Send message to background script to check if overlay is visible
  chrome.runtime.sendMessage({ command: 'get-overlay-state' }, (response) => {
    if (response && response.isVisible) {
      document.querySelector('.shortcut').style.opacity = '0.5';
    }
  });
  
  // Listen for clicks on command examples to copy them
  document.querySelectorAll('.command-item').forEach(item => {
    item.addEventListener('click', () => {
      const command = item.querySelector('.command-name').textContent;
      navigator.clipboard.writeText(command).then(() => {
        item.style.backgroundColor = 'rgba(80, 80, 80, 0.8)';
        setTimeout(() => {
          item.style.backgroundColor = '';
        }, 200);
      });
    });
  });
});
