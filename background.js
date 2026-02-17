// TG Group Bot - Background Service Worker

console.log('TG Group Bot background service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Initialize storage
    chrome.storage.local.set({
      savedGroups: [],
      settings: {
        interval: 30,
        autoJoin: false
      }
    });
  }
});

// Handle messages between popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // Forward messages if needed
  if (request.target === 'content') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, request, sendResponse);
      }
    });
    return true;
  }
  
  return false;
});

// Open Telegram Web when clicking extension icon if not already open
chrome.action.onClicked.addListener(async (tab) => {
  const telegramTabs = await chrome.tabs.query({ url: 'https://web.telegram.org/*' });
  
  if (telegramTabs.length === 0) {
    // Open Telegram Web
    chrome.tabs.create({ url: 'https://web.telegram.org/k/' });
  }
});
