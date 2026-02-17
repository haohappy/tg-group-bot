// TG Group Bot - Content Script
// Injected into Telegram Web to interact with the DOM

console.log('TG Group Bot content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  switch (request.action) {
    case 'search':
      handleSearch(request.keyword).then(sendResponse);
      return true; // async response
      
    case 'joinGroup':
      handleJoinGroup(request.groupId).then(sendResponse);
      return true;
      
    case 'sendMessage':
      handleSendMessage(request.groupId, request.message).then(sendResponse);
      return true;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Search for groups
async function handleSearch(keyword) {
  try {
    // Click on search/menu button to open search
    const searchInput = await findOrOpenSearch();
    if (!searchInput) {
      return { error: 'Cannot find search input' };
    }

    // Clear and type keyword
    searchInput.focus();
    searchInput.value = '';
    
    // Dispatch input event to trigger search
    searchInput.value = keyword;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Wait for results
    await sleep(2000);

    // Find search results
    const results = parseSearchResults();
    return { results };
    
  } catch (error) {
    console.error('Search error:', error);
    return { error: error.message };
  }
}

// Find or open the search input
async function findOrOpenSearch() {
  // Try to find existing search input
  let searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') ||
                    document.querySelector('input.input-search') ||
                    document.querySelector('[data-placeholder="Search"]') ||
                    document.querySelector('input[placeholder*="搜索"]');
  
  if (searchInput) return searchInput;

  // Try clicking the search button/icon
  const searchBtn = document.querySelector('[class*="SearchInput"]') ||
                    document.querySelector('[aria-label="Search"]') ||
                    document.querySelector('.search-input') ||
                    document.querySelector('#telegram-search-input');
  
  if (searchBtn) {
    searchBtn.click();
    await sleep(500);
    
    // Try to find search input again
    searchInput = document.querySelector('input[type="text"]');
  }

  // For Telegram Web K (newer version)
  const chatListSearch = document.querySelector('.input-search input') ||
                         document.querySelector('[class*="LeftSearch"] input');
  if (chatListSearch) return chatListSearch;

  // Global search - try to trigger it with Ctrl+K or just find any text input
  const allInputs = document.querySelectorAll('input[type="text"]');
  for (const input of allInputs) {
    if (input.offsetParent !== null) { // visible
      return input;
    }
  }

  return null;
}

// Parse search results from the DOM
function parseSearchResults() {
  const results = [];
  
  // Different selectors for different Telegram Web versions
  const selectors = [
    // Telegram Web K
    '.search-group .chatlist-chat',
    '.chatlist-chat[data-peer-id]',
    '[class*="Chat_chat"]',
    // Telegram Web A
    '.ListItem.Chat',
    '.search-result',
    // Generic
    '[data-entity-id]',
    '.chat-item'
  ];

  for (const selector of selectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      items.forEach(item => {
        const nameEl = item.querySelector('.peer-title, .title, [class*="title"], .name');
        const membersEl = item.querySelector('.peer-typing-description, .subtitle, [class*="subtitle"], .status');
        const avatarEl = item.querySelector('.avatar, [class*="Avatar"]');
        
        if (nameEl) {
          const name = nameEl.textContent.trim();
          // Filter for groups (usually have member counts or certain keywords)
          const membersText = membersEl ? membersEl.textContent.trim() : '';
          
          if (name && (membersText.includes('member') || membersText.includes('成员') || 
              membersText.includes('subscriber') || membersText.includes('订阅') ||
              item.querySelector('[class*="group"]') || item.querySelector('[class*="channel"]'))) {
            results.push({
              id: item.getAttribute('data-peer-id') || item.getAttribute('data-entity-id') || 
                  item.getAttribute('data-id') || `group-${Date.now()}-${results.length}`,
              name: name,
              members: membersText,
              avatar: avatarEl ? '👥' : '👥'
            });
          }
        }
      });
      
      if (results.length > 0) break;
    }
  }

  // If no groups found, try to get all chat items and let user filter
  if (results.length === 0) {
    const allChats = document.querySelectorAll('[class*="chat"], [class*="Chat"], .ListItem');
    allChats.forEach((item, index) => {
      const nameEl = item.querySelector('[class*="title"], [class*="name"], .title, .name');
      if (nameEl) {
        const name = nameEl.textContent.trim();
        if (name && name.length > 0) {
          results.push({
            id: item.getAttribute('data-peer-id') || `item-${index}`,
            name: name,
            members: '',
            avatar: '💬'
          });
        }
      }
    });
  }

  return results.slice(0, 20); // Limit to 20 results
}

// Join a group
async function handleJoinGroup(groupId) {
  try {
    // Find and click on the group
    const groupEl = document.querySelector(`[data-peer-id="${groupId}"]`) ||
                    document.querySelector(`[data-entity-id="${groupId}"]`) ||
                    document.querySelector(`[data-id="${groupId}"]`);
    
    if (groupEl) {
      groupEl.click();
      await sleep(1000);
      
      // Look for join button
      const joinBtn = document.querySelector('[class*="join"]') ||
                      document.querySelector('button:contains("Join")') ||
                      document.querySelector('.btn-primary');
      
      if (joinBtn) {
        joinBtn.click();
        await sleep(1000);
        return { success: true };
      }
      
      // Already joined or it's a chat
      return { success: true };
    }
    
    return { error: 'Group not found' };
    
  } catch (error) {
    console.error('Join error:', error);
    return { error: error.message };
  }
}

// Send message to a group
async function handleSendMessage(groupId, message) {
  try {
    // Find and click on the group
    const groupEl = document.querySelector(`[data-peer-id="${groupId}"]`) ||
                    document.querySelector(`[data-entity-id="${groupId}"]`);
    
    if (groupEl) {
      groupEl.click();
      await sleep(1000);
    }

    // Find message input
    const messageInput = document.querySelector('[contenteditable="true"]') ||
                         document.querySelector('.input-message-input') ||
                         document.querySelector('textarea') ||
                         document.querySelector('[class*="MessageInput"]');
    
    if (!messageInput) {
      return { error: 'Cannot find message input' };
    }

    // Focus and type message
    messageInput.focus();
    
    // For contenteditable divs
    if (messageInput.getAttribute('contenteditable') === 'true') {
      messageInput.textContent = message;
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // For textarea/input
      messageInput.value = message;
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await sleep(500);

    // Find and click send button
    const sendBtn = document.querySelector('[class*="send"]') ||
                    document.querySelector('[aria-label="Send"]') ||
                    document.querySelector('.btn-send') ||
                    document.querySelector('button[class*="Send"]');
    
    if (sendBtn) {
      sendBtn.click();
      await sleep(500);
      return { success: true };
    }

    // Try pressing Enter
    messageInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));

    await sleep(500);
    return { success: true };
    
  } catch (error) {
    console.error('Send error:', error);
    return { error: error.message };
  }
}

// Utility: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Announce script loaded
console.log('TG Group Bot ready');
