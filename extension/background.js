chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToMediaVault",
    title: "Send link to MediaVault",
    contexts: ["link", "video"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sendToMediaVault") {
    const { instanceUrl } = await chrome.storage.local.get('instanceUrl');
    const url = instanceUrl || 'http://localhost:5000';
    const videoUrl = info.linkUrl || info.srcUrl;

    try {
      const response = await fetch(`${url}/api/downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: videoUrl,
          format: 'mp4',
          quality: '1080p',
          embedMetadata: true,
          organizeFiles: false,
          playlistHandling: 'no',
          maxPlaylistItems: 1
        })
      });

      if (response.ok) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'MediaVault',
          message: 'Video added to queue successfully!'
        });
      }
    } catch (error) {
      console.error('Extension Error:', error);
    }
  }
});
