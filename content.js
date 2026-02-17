// TG Marketing - Content Script
// Injected into Telegram Web K to interact with the DOM
// 支持人类行为模拟

console.log('TG Marketing content script loaded');

// =============== 人类行为模拟 (Content Script 版) ===============

const humanSim = {
  // 随机整数
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  // 随机延迟
  async randomDelay(min, max) {
    const delay = this.randomInt(min, max);
    await sleep(delay);
    return delay;
  },
  
  // 模拟人类打字
  async humanType(element, text) {
    element.focus();
    element.textContent = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // 随机打字速度 (50-150ms)
      await sleep(this.randomInt(50, 150));
      
      // 2% 概率打错字再删除
      if (Math.random() < 0.02 && i < text.length - 1) {
        const typo = String.fromCharCode(this.randomInt(97, 122));
        element.textContent += typo;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(this.randomInt(200, 400));
        element.textContent = element.textContent.slice(0, -1);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(this.randomInt(100, 200));
      }
      
      // 正常输入
      element.textContent += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 10% 概率停顿思考
      if (Math.random() < 0.1) {
        await sleep(this.randomInt(200, 800));
      }
    }
  },
  
  // 模拟滚动
  async humanScroll(element, distance = 300) {
    const steps = this.randomInt(3, 6);
    const stepDistance = distance / steps;
    
    for (let i = 0; i < steps; i++) {
      element.scrollTop += stepDistance + this.randomInt(-20, 20);
      await sleep(this.randomInt(50, 150));
    }
  }
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  switch (request.action) {
    case 'search':
      handleSearch(request.keyword, request.humanMode).then(sendResponse);
      return true; // async response
      
    case 'joinGroup':
      handleJoinGroup(request.groupId, request.humanMode).then(sendResponse);
      return true;
      
    case 'sendMessage':
      handleSendMessage(request.groupId, request.message, request.image, request.humanMode).then(sendResponse);
      return true;
      
    case 'getStatus':
      sendResponse({ connected: true, url: window.location.href });
      return false;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Search for groups using Telegram Web K's global search
async function handleSearch(keyword, humanMode = false) {
  try {
    // Find the search input in the left sidebar
    const searchInput = document.querySelector('.input-search input') ||
                        document.querySelector('input[placeholder="Search"]') ||
                        document.querySelector('.LeftColumn input[type="text"]');
    
    if (!searchInput) {
      // Try clicking the search area first
      const searchArea = document.querySelector('.LeftColumn .input-search') ||
                         document.querySelector('.search-input');
      if (searchArea) {
        if (humanMode) await humanSim.randomDelay(100, 300);
        searchArea.click();
        await sleep(300);
      }
    }
    
    const input = document.querySelector('.input-search input') ||
                  document.querySelector('input[placeholder="Search"]');
    
    if (!input) {
      return { error: 'Cannot find search input', results: [] };
    }

    // Clear input
    input.focus();
    if (humanMode) await humanSim.randomDelay(100, 200);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
    
    // Type the keyword (human mode or instant)
    if (humanMode) {
      await humanSim.humanType(input, keyword);
    } else {
      input.value = keyword;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Wait for search results (随机等待时间)
    const waitTime = humanMode ? humanSim.randomInt(2000, 3500) : 2000;
    await sleep(waitTime);

    // Parse global search results
    const results = parseGlobalSearchResults();
    return { results };
    
  } catch (error) {
    console.error('Search error:', error);
    return { error: error.message, results: [] };
  }
}

// Parse global search results from Telegram Web K
function parseGlobalSearchResults() {
  const results = [];
  
  // Look for the "Global search" section
  const globalSearchSection = Array.from(document.querySelectorAll('*')).find(
    el => el.textContent === 'Global search' && el.className
  );
  
  // Find all search result items
  // Telegram Web K uses various class patterns
  const searchItems = document.querySelectorAll([
    '.search-group .chatlist-chat',
    '.chatlist-chat',
    '.ListItem.Chat',
    '.search-super-content-chats .row',
    '[class*="ListItem"]'
  ].join(', '));
  
  const seenIds = new Set();
  
  searchItems.forEach(item => {
    try {
      // Get the peer ID
      const peerId = item.dataset?.peerId || 
                     item.getAttribute('data-peer-id') ||
                     item.closest('[data-peer-id]')?.dataset?.peerId;
      
      // Skip duplicates
      if (peerId && seenIds.has(peerId)) return;
      if (peerId) seenIds.add(peerId);
      
      // Find title/name element
      const titleEl = item.querySelector('.peer-title') ||
                      item.querySelector('[class*="title"]') ||
                      item.querySelector('.title') ||
                      item.querySelector('.name');
      
      if (!titleEl) return;
      
      const name = titleEl.textContent?.trim();
      if (!name) return;
      
      // Find subtitle/meta (member count, subscriber count)
      const subtitleEl = item.querySelector('.peer-typing-description') ||
                         item.querySelector('[class*="subtitle"]') ||
                         item.querySelector('.subtitle') ||
                         item.querySelector('.status');
      
      const subtitle = subtitleEl?.textContent?.trim() || '';
      
      // Check if it's a group or channel (has members/subscribers)
      const isGroupOrChannel = subtitle.includes('member') || 
                               subtitle.includes('subscriber') ||
                               subtitle.includes('成员') ||
                               subtitle.includes('订阅') ||
                               name.startsWith('@');
      
      // Extract username if present
      let username = '';
      const usernameMatch = subtitle.match(/@(\w+)/);
      if (usernameMatch) {
        username = usernameMatch[1];
      }
      
      results.push({
        id: peerId || `search-${Date.now()}-${results.length}`,
        name: name,
        username: username,
        members: subtitle,
        isGroup: subtitle.includes('member'),
        isChannel: subtitle.includes('subscriber'),
        element: item // Keep reference for clicking
      });
      
    } catch (e) {
      console.error('Error parsing item:', e);
    }
  });

  // Return without element references (can't serialize)
  return results.map(({ element, ...rest }) => rest).slice(0, 30);
}

// Join a group by clicking on it and then the join button
async function handleJoinGroup(groupId, humanMode = false) {
  try {
    // Find the group element
    const groupEl = document.querySelector(`[data-peer-id="${groupId}"]`);
    
    if (!groupEl) {
      return { error: 'Group element not found', success: false };
    }
    
    // 人类模式: 点击前延迟
    if (humanMode) await humanSim.randomDelay(100, 300);
    
    // Click to open the group
    groupEl.click();
    
    // 人类模式: 等待更长时间 (模拟阅读群介绍)
    await sleep(humanMode ? humanSim.randomInt(1500, 2500) : 1500);
    
    // 人类模式: 模拟滚动查看群信息
    if (humanMode) {
      const chatContainer = document.querySelector('.bubbles-inner') || 
                           document.querySelector('.chat-content');
      if (chatContainer) {
        await humanSim.humanScroll(chatContainer, humanSim.randomInt(100, 300));
        await humanSim.randomDelay(500, 1000);
      }
    }
    
    // Look for JOIN button
    const joinBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent?.trim().toUpperCase() === 'JOIN'
    );
    
    if (joinBtn) {
      if (humanMode) await humanSim.randomDelay(200, 500);
      joinBtn.click();
      await sleep(humanMode ? humanSim.randomInt(800, 1200) : 1000);
      return { success: true, joined: true };
    }
    
    // No join button means we might already be a member or it's a private group
    return { success: true, joined: false, message: 'Already joined or private group' };
    
  } catch (error) {
    console.error('Join error:', error);
    return { error: error.message, success: false };
  }
}

// Send message to the currently open chat (with optional image)
async function handleSendMessage(groupId, message, imageBase64, humanMode = false) {
  try {
    // If groupId provided, navigate to that chat first
    if (groupId) {
      const groupEl = document.querySelector(`[data-peer-id="${groupId}"]`);
      if (groupEl) {
        if (humanMode) await humanSim.randomDelay(100, 300);
        groupEl.click();
        // 人类模式等待更长时间 (模拟阅读群信息)
        await sleep(humanMode ? humanSim.randomInt(1500, 2500) : 1500);
      }
    }

    // Find the message input (contenteditable div in Telegram Web K)
    const messageInput = document.querySelector('.input-message-input') ||
                         document.querySelector('[contenteditable="true"].input-field-input') ||
                         document.querySelector('[data-placeholder="Message"]');
    
    if (!messageInput) {
      return { error: 'Cannot find message input', success: false };
    }

    // If we have an image, paste it first
    if (imageBase64) {
      try {
        if (humanMode) await humanSim.randomDelay(300, 600);
        await pasteImage(imageBase64, messageInput);
        await sleep(humanMode ? humanSim.randomInt(1000, 1500) : 1000);
      } catch (imgError) {
        console.error('Image paste failed:', imgError);
        // Continue without image
      }
    }

    // Focus input
    messageInput.focus();
    if (humanMode) await humanSim.randomDelay(100, 200);
    
    // Type the message (human mode or instant)
    if (humanMode) {
      await humanSim.humanType(messageInput, message);
      // 打完字后稍微等一下再发送 (模拟检查内容)
      await humanSim.randomDelay(300, 800);
    } else {
      messageInput.textContent = message;
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(300);
    }

    // Find and click send button
    const sendBtn = document.querySelector('.btn-send') ||
                    document.querySelector('[class*="send-button"]') ||
                    document.querySelector('button.send') ||
                    Array.from(document.querySelectorAll('button')).find(
                      btn => btn.querySelector('svg') && 
                             btn.closest('.chat-input-main')
                    );
    
    if (sendBtn) {
      if (humanMode) await humanSim.randomDelay(100, 250);
      sendBtn.click();
      await sleep(humanMode ? humanSim.randomInt(800, 1200) : 1000);
      
      // If image was attached, there might be a popup, click send again
      const popupSendBtn = document.querySelector('.popup-send-photo .btn-primary') ||
                           document.querySelector('.popup button.btn-primary');
      if (popupSendBtn) {
        if (humanMode) await humanSim.randomDelay(200, 400);
        popupSendBtn.click();
        await sleep(humanMode ? humanSim.randomInt(400, 700) : 500);
      }
      
      return { success: true };
    }

    // Try pressing Enter as fallback
    messageInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
    
    await sleep(humanMode ? humanSim.randomInt(400, 700) : 500);
    return { success: true, method: 'enter' };
    
  } catch (error) {
    console.error('Send error:', error);
    return { error: error.message, success: false };
  }
}

// Paste an image into the chat
async function pasteImage(base64Data, targetElement) {
  // Convert base64 to blob
  const response = await fetch(base64Data);
  const blob = await response.blob();
  
  // Create a File from the blob
  const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
  
  // Create a DataTransfer object and add the file
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  
  // Create and dispatch paste event
  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer
  });
  
  targetElement.dispatchEvent(pasteEvent);
  
  // Alternative: Try using file input
  const fileInput = document.querySelector('input[type="file"][accept*="image"]');
  if (fileInput) {
    try {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      // Some browsers don't allow setting files programmatically
      console.log('File input method not supported');
    }
  }
}

// Clear search and go back to chat list
async function clearSearch() {
  const clearBtn = document.querySelector('.input-search .input-clear') ||
                   document.querySelector('[class*="SearchInput"] button');
  if (clearBtn) {
    clearBtn.click();
    await sleep(300);
  }
}

// Utility: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Announce script loaded
console.log('TG Group Bot ready - Telegram Web K compatible');
