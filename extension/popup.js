document.addEventListener('DOMContentLoaded', async () => {
  const instanceInput = document.getElementById('instanceUrl');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusMsg = document.getElementById('statusMsg');

  // Load saved instance URL
  const { instanceUrl } = await chrome.storage.local.get('instanceUrl');
  if (instanceUrl) {
    instanceInput.value = instanceUrl;
  } else {
    instanceInput.value = 'http://localhost:5000';
  }

  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  downloadBtn.addEventListener('click', async () => {
    const url = instanceInput.value.replace(/\/$/, '');
    await chrome.storage.local.set({ instanceUrl: url });

    statusMsg.textContent = 'Sending...';
    
    try {
      const response = await fetch(`${url}/api/downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: tab.url,
          format: 'mp4',
          quality: '1080p',
          embedMetadata: true,
          organizeFiles: false,
          playlistHandling: 'no',
          maxPlaylistItems: 1
        })
      });

      if (response.ok) {
        statusMsg.style.color = '#1db954';
        statusMsg.textContent = 'Successfully sent to MediaVault!';
        setTimeout(() => window.close(), 1500);
      } else {
        const err = await response.json();
        throw new Error(err.message || 'Server error');
      }
    } catch (error) {
      statusMsg.style.color = '#f87171';
      statusMsg.textContent = `Error: ${error.message}`;
    }
  });
});
