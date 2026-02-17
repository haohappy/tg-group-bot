// TG Group Bot - Content Script
// Injected into Telegram Web K to interact with the DOM

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
      
    case 'getStatus':
      sendResponse({ connected: true, url: window.location.href });
      return false;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Search for groups using Telegram Web K's global search
async function handleSearch(keyword) {
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
        searchArea.click();
        await sleep(300);
      }
    }
    
    const input = document.querySelector('.input-search input') ||
                  document.querySelector('input[placeholder="Search"]');
    
    if (!input) {
      return { error: 'Cannot find search input', results: [] };
    }

    // Clear and type keyword
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
    
    // Type the keyword
    input.value = keyword;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Wait for search results
    await sleep(2000);

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
async function handleJoinGroup(groupId) {
  try {
    // Find the group element
    const groupEl = document.querySelector(`[data-peer-id="${groupId}"]`);
    
    if (!groupEl) {
      return { error: 'Group element not found', success: false };
    }
    
    // Click to open the group
    groupEl.click();
    await sleep(1500);
    
    // Look for JOIN button
    const joinBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent?.trim().toUpperCase() === 'JOIN'
    );
    
    if (joinBtn) {
      joinBtn.click();
      await sleep(1000);
      return { success: true, joined: true };
    }
    
    // No join button means we might already be a member or it's a private group
    return { success: true, joined: false, message: 'Already joined or private group' };
    
  } catch (error) {
    console.error('Join error:', error);
    return { error: error.message, success: false };
  }
}

// Send message to the currently open chat
async function handleSendMessage(groupId, message) {
  try {
    // If groupId provided, navigate to that chat first
    if (groupId) {
      const groupEl = document.querySelector(`[data-peer-id="${groupId}"]`);
      if (groupEl) {
        groupEl.click();
        await sleep(1000);
      }
    }

    // Find the message input (contenteditable div in Telegram Web K)
    const messageInput = document.querySelector('.input-message-input') ||
                         document.querySelector('[contenteditable="true"].input-field-input') ||
                         document.querySelector('[data-placeholder="Message"]');
    
    if (!messageInput) {
      return { error: 'Cannot find message input', success: false };
    }

    // Focus and clear
    messageInput.focus();
    await sleep(100);
    
    // Set the message content
    messageInput.textContent = message;
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    await sleep(300);

    // Find and click send button
    const sendBtn = document.querySelector('.btn-send') ||
                    document.querySelector('[class*="send-button"]') ||
                    document.querySelector('button.send') ||
                    Array.from(document.querySelectorAll('button')).find(
                      btn => btn.querySelector('svg') && 
                             btn.closest('.chat-input-main')
                    );
    
    if (sendBtn) {
      sendBtn.click();
      await sleep(500);
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
    
    await sleep(500);
    return { success: true, method: 'enter' };
    
  } catch (error) {
    console.error('Send error:', error);
    return { error: error.message, success: false };
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
