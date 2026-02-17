// TG Group Bot - Popup Script

class TGGroupBot {
  constructor() {
    this.savedGroups = [];
    this.isSending = false;
    this.init();
  }

  async init() {
    await this.loadSavedGroups();
    this.bindEvents();
    this.checkConnection();
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
      
      if (tab && tab.url && tab.url.includes('web.telegram.org')) {
        status.textContent = '✓ 已连接 Telegram Web';
        status.className = 'status connected';
      } else {
        status.textContent = '✗ 请打开 Telegram Web';
        status.className = 'status disconnected';
      }
    } catch (error) {
      status.textContent = '✗ 连接失败';
      status.className = 'status disconnected';
    }
  }

  async search() {
    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) return;

    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<div class="loading">搜索中</div>';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url.includes('web.telegram.org')) {
        resultsEl.innerHTML = '<div class="empty">请先打开 Telegram Web</div>';
        return;
      }

      // Send search command to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'search',
        keyword: keyword
      });

      if (response && response.results) {
        this.renderSearchResults(response.results);
      } else {
        resultsEl.innerHTML = '<div class="empty">未找到群组</div>';
      }
    } catch (error) {
      console.error('Search error:', error);
      resultsEl.innerHTML = `<div class="empty">搜索失败: ${error.message}</div>`;
    }
  }

  renderSearchResults(results) {
    const resultsEl = document.getElementById('search-results');
    
    if (!results || results.length === 0) {
      resultsEl.innerHTML = '<div class="empty">未找到群组</div>';
      return;
    }

    resultsEl.innerHTML = results.map(group => `
      <div class="result-item" data-id="${group.id}">
        <div class="avatar">${group.avatar || '👥'}</div>
        <div class="info">
          <div class="name">${this.escapeHtml(group.name)}</div>
          <div class="meta">${group.members || ''}</div>
        </div>
        <div class="actions">
          <button class="action-btn ${this.isGroupSaved(group.id) ? 'saved' : ''}" 
                  onclick="bot.saveGroup('${group.id}', '${this.escapeAttr(group.name)}', '${group.members || ''}')">
            ${this.isGroupSaved(group.id) ? '已保存' : '保存'}
          </button>
        </div>
      </div>
    `).join('');
  }

  isGroupSaved(id) {
    return this.savedGroups.some(g => g.id === id);
  }

  async saveGroup(id, name, members) {
    if (this.isGroupSaved(id)) return;

    this.savedGroups.push({ id, name, members, joined: false });
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
    document.getElementById('group-count').textContent = `已保存: ${this.savedGroups.length} 个群`;
  }

  renderSavedGroups() {
    const listEl = document.getElementById('saved-groups');
    
    if (this.savedGroups.length === 0) {
      listEl.innerHTML = '<div class="empty">暂无保存的群组<br>请先搜索并保存群组</div>';
      return;
    }

    listEl.innerHTML = this.savedGroups.map(group => `
      <div class="result-item" data-id="${group.id}">
        <div class="avatar">👥</div>
        <div class="info">
          <div class="name">${this.escapeHtml(group.name)}</div>
          <div class="meta">${group.members} ${group.joined ? '• 已加入' : ''}</div>
        </div>
        <div class="actions">
          ${!group.joined ? `
            <button class="action-btn join" onclick="bot.joinGroup('${group.id}')">加入</button>
          ` : ''}
          <button class="action-btn" onclick="bot.removeGroup('${group.id}')" style="background:#333">删除</button>
        </div>
      </div>
    `).join('');
  }

  async joinGroup(id) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'joinGroup',
        groupId: id
      });

      if (response && response.success) {
        const group = this.savedGroups.find(g => g.id === id);
        if (group) {
          group.joined = true;
          await chrome.storage.local.set({ savedGroups: this.savedGroups });
          this.renderSavedGroups();
        }
      }
    } catch (error) {
      console.error('Join error:', error);
      this.addLog(`加入群组失败: ${error.message}`, 'error');
    }
  }

  async removeGroup(id) {
    this.savedGroups = this.savedGroups.filter(g => g.id !== id);
    await chrome.storage.local.set({ savedGroups: this.savedGroups });
    this.updateGroupCount();
    this.renderSavedGroups();
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

    this.isSending = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
    
    const interval = parseInt(document.getElementById('interval').value) * 1000;

    for (const group of joinedGroups) {
      if (!this.isSending) break;

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'sendMessage',
          groupId: group.id,
          message: message
        });

        if (response && response.success) {
          this.addLog(`✓ 发送到 ${group.name}`, 'success');
        } else {
          this.addLog(`✗ 发送到 ${group.name} 失败`, 'error');
        }
      } catch (error) {
        this.addLog(`✗ ${group.name}: ${error.message}`, 'error');
      }

      // Wait before next message
      if (this.isSending) {
        await this.sleep(interval);
      }
    }

    this.stopSending();
    this.addLog('发送完成', 'success');
  }

  stopSending() {
    this.isSending = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
  }

  addLog(text, type = '') {
    const logEl = document.getElementById('send-log');
    const time = new Date().toLocaleTimeString();
    logEl.innerHTML = `<div class="log-entry ${type}"><span class="time">[${time}]</span> ${text}</div>` + logEl.innerHTML;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeAttr(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
}

// Initialize
const bot = new TGGroupBot();
