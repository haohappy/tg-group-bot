// TG Group Bot - Popup Script

class TGGroupBot {
  constructor() {
    this.savedGroups = [];
    this.isSending = false;
    this.currentTab = null;
    this.init();
  }

  async init() {
    await this.loadSavedGroups();
    this.bindEvents();
    await this.checkConnection();
    this.updateGroupCount();
    this.renderSavedGroups();
  }

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Search
    document.getElementById('search-btn').addEventListener('click', () => this.search());
    document.getElementById('keyword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.search();
    });

    // Groups
    document.getElementById('clear-groups').addEventListener('click', () => this.clearGroups());

    // Message
    document.getElementById('send-btn').addEventListener('click', () => this.startSending());
    document.getElementById('stop-btn').addEventListener('click', () => this.stopSending());
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  async checkConnection() {
    const status = document.getElementById('status');
    status.textContent = '检查连接中...';
    status.className = 'status checking';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      
      if (tab && tab.url && tab.url.includes('web.telegram.org')) {
        // Try to ping content script
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
          if (response && response.connected) {
            status.textContent = '✓ 已连接 Telegram Web';
            status.className = 'status connected';
            return true;
          }
        } catch (e) {
          // Content script might not be injected yet
          status.textContent = '⟳ 请刷新 Telegram 页面';
          status.className = 'status checking';
          return false;
        }
      } else {
        status.textContent = '✗ 请打开 web.telegram.org';
        status.className = 'status disconnected';
        return false;
      }
    } catch (error) {
      status.textContent = '✗ 连接失败';
      status.className = 'status disconnected';
      return false;
    }
  }

  async search() {
    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) {
      alert('请输入搜索关键词');
      return;
    }

    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<div class="loading">搜索中</div>';

    // Check connection first
    const connected = await this.checkConnection();
    if (!connected) {
      resultsEl.innerHTML = '<div class="empty">请先打开 Telegram Web 并刷新页面</div>';
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'search',
        keyword: keyword
      });

      console.log('Search response:', response);

      if (response && response.results && response.results.length > 0) {
        this.renderSearchResults(response.results);
      } else if (response && response.error) {
        resultsEl.innerHTML = `<div class="empty">搜索失败: ${response.error}</div>`;
      } else {
        resultsEl.innerHTML = '<div class="empty">未找到群组，请尝试其他关键词</div>';
      }
    } catch (error) {
      console.error('Search error:', error);
      resultsEl.innerHTML = `<div class="empty">搜索出错: ${error.message}<br>请刷新 Telegram 页面重试</div>`;
    }
  }

  renderSearchResults(results) {
    const resultsEl = document.getElementById('search-results');
    
    if (!results || results.length === 0) {
      resultsEl.innerHTML = '<div class="empty">未找到群组</div>';
      return;
    }

    resultsEl.innerHTML = results.map(group => {
      const typeIcon = group.isChannel ? '📢' : group.isGroup ? '👥' : '💬';
      const typeLabel = group.isChannel ? '频道' : group.isGroup ? '群组' : '';
      
      return `
        <div class="result-item" data-id="${group.id}">
          <div class="avatar">${typeIcon}</div>
          <div class="info">
            <div class="name">${this.escapeHtml(group.name)}</div>
            <div class="meta">${this.escapeHtml(group.members)} ${typeLabel}</div>
          </div>
          <div class="actions">
            <button class="action-btn ${this.isGroupSaved(group.id) ? 'saved' : ''}" 
                    data-action="save"
                    data-id="${group.id}"
                    data-name="${this.escapeAttr(group.name)}"
                    data-members="${this.escapeAttr(group.members || '')}"
                    data-is-group="${group.isGroup}"
                    data-is-channel="${group.isChannel}">
              ${this.isGroupSaved(group.id) ? '已保存' : '保存'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    resultsEl.querySelectorAll('[data-action="save"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const data = e.target.dataset;
        this.saveGroup(data.id, data.name, data.members, data.isGroup === 'true', data.isChannel === 'true');
      });
    });
  }

  isGroupSaved(id) {
    return this.savedGroups.some(g => g.id === id);
  }

  async saveGroup(id, name, members, isGroup, isChannel) {
    if (this.isGroupSaved(id)) {
      // Toggle - remove if already saved
      await this.removeGroup(id);
      return;
    }

    this.savedGroups.push({ 
      id, 
      name, 
      members, 
      isGroup,
      isChannel,
      joined: false,
      addedAt: Date.now()
    });
    
    await chrome.storage.local.set({ savedGroups: this.savedGroups });
    this.updateGroupCount();
    this.renderSavedGroups();
    
    // Update search results button
    const btn = document.querySelector(`.result-item[data-id="${id}"] .action-btn`);
    if (btn) {
      btn.textContent = '已保存';
      btn.classList.add('saved');
    }
  }

  async loadSavedGroups() {
    const data = await chrome.storage.local.get('savedGroups');
    this.savedGroups = data.savedGroups || [];
  }

  updateGroupCount() {
    const total = this.savedGroups.length;
    const joined = this.savedGroups.filter(g => g.joined).length;
    document.getElementById('group-count').textContent = `已保存: ${total} 个 (已加入: ${joined})`;
  }

  renderSavedGroups() {
    const listEl = document.getElementById('saved-groups');
    
    if (this.savedGroups.length === 0) {
      listEl.innerHTML = '<div class="empty">暂无保存的群组<br>请先搜索并保存群组</div>';
      return;
    }

    listEl.innerHTML = this.savedGroups.map(group => {
      const typeIcon = group.isChannel ? '📢' : group.isGroup ? '👥' : '💬';
      const joinedBadge = group.joined ? '<span class="badge joined">已加入</span>' : '';
      
      return `
        <div class="result-item" data-id="${group.id}">
          <div class="avatar">${typeIcon}</div>
          <div class="info">
            <div class="name">${this.escapeHtml(group.name)} ${joinedBadge}</div>
            <div class="meta">${this.escapeHtml(group.members || '')}</div>
          </div>
          <div class="actions">
            ${!group.joined ? `
              <button class="action-btn join" data-action="join" data-id="${group.id}">加入</button>
            ` : ''}
            <button class="action-btn remove" data-action="remove" data-id="${group.id}">删除</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind events
    listEl.querySelectorAll('[data-action="join"]').forEach(btn => {
      btn.addEventListener('click', () => this.joinGroup(btn.dataset.id));
    });
    
    listEl.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => this.removeGroup(btn.dataset.id));
    });
  }

  async joinGroup(id) {
    const btn = document.querySelector(`[data-action="join"][data-id="${id}"]`);
    if (btn) {
      btn.textContent = '加入中...';
      btn.disabled = true;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'joinGroup',
        groupId: id
      });

      if (response && response.success) {
        const group = this.savedGroups.find(g => g.id === id);
        if (group) {
          group.joined = true;
          await chrome.storage.local.set({ savedGroups: this.savedGroups });
          this.updateGroupCount();
          this.renderSavedGroups();
        }
      } else {
        alert(`加入失败: ${response?.error || '未知错误'}`);
        if (btn) {
          btn.textContent = '加入';
          btn.disabled = false;
        }
      }
    } catch (error) {
      console.error('Join error:', error);
      alert(`加入出错: ${error.message}`);
      if (btn) {
        btn.textContent = '加入';
        btn.disabled = false;
      }
    }
  }

  async removeGroup(id) {
    this.savedGroups = this.savedGroups.filter(g => g.id !== id);
    await chrome.storage.local.set({ savedGroups: this.savedGroups });
    this.updateGroupCount();
    this.renderSavedGroups();
    
    // Update search results if visible
    const searchBtn = document.querySelector(`.result-item[data-id="${id}"] [data-action="save"]`);
    if (searchBtn) {
      searchBtn.textContent = '保存';
      searchBtn.classList.remove('saved');
    }
  }

  async clearGroups() {
    if (!confirm('确定要清空所有保存的群组吗？')) return;
    
    this.savedGroups = [];
    await chrome.storage.local.set({ savedGroups: [] });
    this.updateGroupCount();
    this.renderSavedGroups();
  }

  async startSending() {
    const message = document.getElementById('message-content').value.trim();
    if (!message) {
      alert('请输入消息内容');
      return;
    }

    const joinedGroups = this.savedGroups.filter(g => g.joined);
    if (joinedGroups.length === 0) {
      alert('请先加入一些群组');
      return;
    }

    if (!confirm(`将向 ${joinedGroups.length} 个群组发送消息，确定吗？`)) {
      return;
    }

    this.isSending = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
    
    const interval = parseInt(document.getElementById('interval').value) * 1000;
    const logEl = document.getElementById('send-log');
    logEl.innerHTML = '';

    this.addLog(`开始发送到 ${joinedGroups.length} 个群组...`);

    for (let i = 0; i < joinedGroups.length; i++) {
      if (!this.isSending) {
        this.addLog('已停止发送', 'error');
        break;
      }

      const group = joinedGroups[i];
      this.addLog(`[${i + 1}/${joinedGroups.length}] 发送到 ${group.name}...`);

      try {
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'sendMessage',
          groupId: group.id,
          message: message
        });

        if (response && response.success) {
          this.addLog(`✓ 成功: ${group.name}`, 'success');
        } else {
          this.addLog(`✗ 失败: ${group.name} - ${response?.error || '未知错误'}`, 'error');
        }
      } catch (error) {
        this.addLog(`✗ 错误: ${group.name} - ${error.message}`, 'error');
      }

      // Wait before next message
      if (this.isSending && i < joinedGroups.length - 1) {
        this.addLog(`等待 ${interval / 1000} 秒...`);
        await this.sleep(interval);
      }
    }

    this.stopSending();
    this.addLog('发送完成！', 'success');
  }

  stopSending() {
    this.isSending = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
  }

  addLog(text, type = '') {
    const logEl = document.getElementById('send-log');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="time">[${time}]</span> ${text}`;
    logEl.insertBefore(entry, logEl.firstChild);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeAttr(text) {
    if (!text) return '';
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.bot = new TGGroupBot();
});
