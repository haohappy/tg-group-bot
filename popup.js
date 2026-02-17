// TG Marketing - Popup Controller

class TGMarketing {
  constructor() {
    this.campaignManager = new CampaignManager();
    this.updater = new Updater();
    this.selectedImages = [];
    this.editingCampaignId = null;
    this.viewingCampaignId = null;
    this.init();
  }

  async init() {
    document.getElementById('version').textContent = `v${this.updater.currentVersion}`;
    
    await this.campaignManager.load();
    this.bindEvents();
    await this.checkConnection();
    this.renderCampaignsList();
    this.updateRunningTab();
    this.checkForUpdates();
  }

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Campaigns tab
    document.getElementById('refresh-campaigns').addEventListener('click', () => {
      this.campaignManager.load().then(() => this.renderCampaignsList());
    });

    // Create tab
    document.getElementById('add-images-btn').addEventListener('click', () => {
      document.getElementById('campaign-images').click();
    });
    document.getElementById('campaign-images').addEventListener('change', (e) => this.handleImageSelect(e));
    document.getElementById('save-campaign-btn').addEventListener('click', () => this.saveCampaign(false));
    document.getElementById('save-and-run-btn').addEventListener('click', () => this.saveCampaign(true));

    // Running tab
    document.getElementById('go-campaigns-btn').addEventListener('click', () => this.switchTab('campaigns'));
    document.getElementById('pause-btn').addEventListener('click', () => this.pauseCampaign());
    document.getElementById('resume-btn').addEventListener('click', () => this.resumeCampaign());
    document.getElementById('stop-btn').addEventListener('click', () => this.stopCampaign());

    // Modal
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
    document.getElementById('modal-run-btn').addEventListener('click', () => this.runFromModal());
    document.getElementById('modal-edit-btn').addEventListener('click', () => this.editFromModal());
    document.getElementById('modal-delete-btn').addEventListener('click', () => this.deleteFromModal());
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  // =============== Connection ===============

  async checkConnection() {
    const status = document.getElementById('status');
    status.textContent = '检查连接中...';
    status.className = 'status checking';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.url?.includes('web.telegram.org')) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
          if (response?.connected) {
            status.textContent = '✓ 已连接 Telegram';
            status.className = 'status connected';
            return true;
          }
        } catch (e) {
          status.textContent = '⟳ 刷新 Telegram 页面';
          status.className = 'status checking';
        }
      } else {
        status.textContent = '✗ 请打开 Telegram Web';
        status.className = 'status disconnected';
      }
    } catch (error) {
      status.textContent = '✗ 连接失败';
      status.className = 'status disconnected';
    }
    return false;
  }

  async checkForUpdates() {
    try {
      const result = await this.updater.checkForUpdates();
      if (result.hasUpdate) {
        const banner = document.getElementById('update-banner');
        document.getElementById('new-version').textContent = result.latestVersion;
        banner.classList.remove('hidden');
        
        document.getElementById('update-btn').addEventListener('click', async () => {
          await this.updater.downloadUpdate(result.downloadUrl);
          alert('下载完成！解压后覆盖插件目录，然后刷新。');
        });
      }
    } catch (e) {
      console.log('Update check failed:', e);
    }
  }

  // =============== Campaigns List ===============

  renderCampaignsList() {
    const listEl = document.getElementById('campaigns-list');
    const campaigns = this.campaignManager.campaigns;
    
    document.getElementById('campaign-count').textContent = `共 ${campaigns.length} 个活动`;

    if (campaigns.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>还没有创建活动</p>
          <button class="btn primary" onclick="bot.switchTab('create')">➕ 创建第一个活动</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = campaigns.map(c => {
      const statusLabels = {
        draft: '草稿',
        ready: '就绪',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成'
      };

      return `
        <div class="campaign-card" data-id="${c.id}">
          <div class="card-header">
            <span class="card-name">${this.escapeHtml(c.name)}</span>
            <span class="card-status ${c.status}">${statusLabels[c.status]}</span>
          </div>
          <div class="card-stats">
            <span>🔑 ${c.keywords.length} 关键词</span>
            <span>👥 ${c.stats?.joined || 0} 群</span>
            <span>💬 ${c.stats?.sent || 0} 发送</span>
          </div>
          <div class="card-actions">
            <button class="btn small" data-action="view" data-id="${c.id}">查看</button>
            ${c.status !== 'running' ? `
              <button class="btn success" data-action="run" data-id="${c.id}">🚀 运行</button>
            ` : `
              <button class="btn warning" data-action="view-running" data-id="${c.id}">查看进度</button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Bind events
    listEl.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCampaignDetail(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('[data-action="run"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.runCampaign(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('[data-action="view-running"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab('running');
      });
    });

    listEl.querySelectorAll('.campaign-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showCampaignDetail(card.dataset.id);
      });
    });
  }

  // =============== Campaign Detail Modal ===============

  showCampaignDetail(id) {
    const campaign = this.campaignManager.get(id);
    if (!campaign) return;

    this.viewingCampaignId = id;
    
    document.getElementById('modal-title').textContent = campaign.name;
    
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <div class="detail-row">
        <div class="detail-label">🔑 搜索关键词</div>
        <div class="detail-value">${this.escapeHtml(campaign.keywords.join('\n'))}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">💬 广告内容</div>
        <div class="detail-value">${this.escapeHtml(campaign.message)}</div>
      </div>
      ${campaign.images.length > 0 ? `
        <div class="detail-row">
          <div class="detail-label">🖼️ 图片 (${campaign.images.length}张)</div>
          <div class="detail-images">
            ${campaign.images.map(img => `<img src="${img}" alt="ad">`).join('')}
          </div>
        </div>
      ` : ''}
      <div class="detail-row">
        <div class="detail-label">⚙️ 设置</div>
        <div class="detail-value">发送间隔: ${campaign.settings.interval}秒 | 最多加入: ${campaign.settings.maxGroups}群 | 自动加入: ${campaign.settings.autoJoin ? '是' : '否'}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">📊 统计</div>
        <div class="detail-value">搜索: ${campaign.stats?.searched || 0} | 加入: ${campaign.stats?.joined || 0} | 发送: ${campaign.stats?.sent || 0} | 失败: ${campaign.stats?.failed || 0}</div>
      </div>
    `;

    document.getElementById('campaign-modal').classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('campaign-modal').classList.add('hidden');
    this.viewingCampaignId = null;
  }

  runFromModal() {
    if (this.viewingCampaignId) {
      this.closeModal();
      this.runCampaign(this.viewingCampaignId);
    }
  }

  editFromModal() {
    if (this.viewingCampaignId) {
      const campaign = this.campaignManager.get(this.viewingCampaignId);
      this.closeModal();
      this.loadCampaignToForm(campaign);
      this.switchTab('create');
    }
  }

  deleteFromModal() {
    if (this.viewingCampaignId && confirm('确定删除此活动吗？')) {
      this.campaignManager.delete(this.viewingCampaignId);
      this.closeModal();
      this.renderCampaignsList();
    }
  }

  // =============== Create/Edit Campaign ===============

  handleImageSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Read files as base64
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.selectedImages.push(event.target.result);
        this.renderImagePreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  renderImagePreviews() {
    const container = document.getElementById('image-preview');
    document.getElementById('image-count').textContent = 
      this.selectedImages.length > 0 ? `已选 ${this.selectedImages.length} 张` : '未选择';

    container.innerHTML = this.selectedImages.map((img, i) => `
      <div class="preview-item">
        <img src="${img}" alt="preview">
        <button class="remove-img" data-index="${i}">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.remove-img').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedImages.splice(parseInt(btn.dataset.index), 1);
        this.renderImagePreviews();
      });
    });
  }

  loadCampaignToForm(campaign) {
    this.editingCampaignId = campaign.id;
    document.getElementById('campaign-name').value = campaign.name;
    document.getElementById('campaign-keywords').value = campaign.keywords.join('\n');
    document.getElementById('campaign-message').value = campaign.message;
    document.getElementById('campaign-interval').value = campaign.settings.interval;
    document.getElementById('campaign-max-groups').value = campaign.settings.maxGroups;
    document.getElementById('campaign-auto-join').checked = campaign.settings.autoJoin;
    
    this.selectedImages = [...campaign.images];
    this.renderImagePreviews();
  }

  async saveCampaign(andRun = false) {
    const name = document.getElementById('campaign-name').value.trim();
    const keywordsText = document.getElementById('campaign-keywords').value.trim();
    const message = document.getElementById('campaign-message').value.trim();
    const interval = parseInt(document.getElementById('campaign-interval').value);
    const maxGroups = parseInt(document.getElementById('campaign-max-groups').value);
    const autoJoin = document.getElementById('campaign-auto-join').checked;

    if (!name) {
      alert('请输入活动名称');
      return;
    }
    if (!keywordsText) {
      alert('请输入至少一个关键词');
      return;
    }
    if (!message) {
      alert('请输入广告内容');
      return;
    }

    const keywords = keywordsText.split('\n').map(k => k.trim()).filter(k => k);

    const data = {
      name,
      keywords,
      message,
      images: this.selectedImages,
      interval,
      maxGroups,
      autoJoin
    };

    let campaign;
    if (this.editingCampaignId) {
      campaign = this.campaignManager.update(this.editingCampaignId, data);
      this.editingCampaignId = null;
    } else {
      campaign = this.campaignManager.create(data);
    }

    // Reset form
    this.resetCreateForm();
    
    if (andRun) {
      this.runCampaign(campaign.id);
    } else {
      alert('活动已保存！');
      this.renderCampaignsList();
      this.switchTab('campaigns');
    }
  }

  resetCreateForm() {
    document.getElementById('campaign-name').value = '';
    document.getElementById('campaign-keywords').value = '';
    document.getElementById('campaign-message').value = '';
    document.getElementById('campaign-interval').value = '60';
    document.getElementById('campaign-max-groups').value = '20';
    document.getElementById('campaign-auto-join').checked = true;
    this.selectedImages = [];
    this.renderImagePreviews();
    this.editingCampaignId = null;
  }

  // =============== Run Campaign ===============

  async runCampaign(id) {
    const connected = await this.checkConnection();
    if (!connected) {
      alert('请先打开 Telegram Web 并刷新页面');
      return;
    }

    const campaign = this.campaignManager.get(id);
    if (!campaign) return;

    // Switch to running tab
    this.switchTab('running');
    this.showRunningPanel(campaign);

    // Run with callbacks
    try {
      await this.campaignManager.run(id, {
        onLog: (msg, type) => this.addRunningLog(msg, type),
        onStats: (stats, maxGroups) => this.updateRunningStats(stats, maxGroups),
        onStatusChange: (status) => this.updateRunningStatus(status)
      });
    } catch (error) {
      this.addRunningLog(`❌ ${error.message}`, 'error');
    }

    this.renderCampaignsList();
  }

  showRunningPanel(campaign) {
    document.getElementById('no-running').classList.add('hidden');
    document.getElementById('running-panel').classList.remove('hidden');
    document.getElementById('running-name').textContent = campaign.name;
    document.getElementById('running-log').innerHTML = '';
    this.updateRunningStats({ searched: 0, joined: 0, sent: 0, failed: 0 }, campaign.settings.maxGroups);
    this.updateRunningStatus('running');
  }

  updateRunningTab() {
    const cm = this.campaignManager;
    if (cm.isRunning && cm.currentCampaign) {
      this.showRunningPanel(cm.currentCampaign);
    } else {
      document.getElementById('no-running').classList.remove('hidden');
      document.getElementById('running-panel').classList.add('hidden');
    }
  }

  updateRunningStats(stats, maxGroups) {
    document.getElementById('stat-searched').textContent = stats.searched;
    document.getElementById('stat-joined').textContent = stats.joined;
    document.getElementById('stat-sent').textContent = stats.sent;
    document.getElementById('stat-failed').textContent = stats.failed;

    const progress = maxGroups > 0 ? Math.min(100, (stats.sent / maxGroups) * 100) : 0;
    document.getElementById('progress-fill').style.width = `${progress}%`;
  }

  updateRunningStatus(status) {
    const statusEl = document.getElementById('running-status');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');

    if (status === 'running') {
      statusEl.textContent = '运行中';
      statusEl.className = 'status-badge';
      pauseBtn.classList.remove('hidden');
      resumeBtn.classList.add('hidden');
    } else if (status === 'paused') {
      statusEl.textContent = '已暂停';
      statusEl.className = 'status-badge paused';
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.remove('hidden');
    } else {
      statusEl.textContent = status === 'completed' ? '已完成' : '已停止';
      statusEl.className = 'status-badge stopped';
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.add('hidden');
    }
  }

  addRunningLog(text, type = '') {
    const logEl = document.getElementById('running-log');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="time">[${time}]</span> ${this.escapeHtml(text)}`;
    logEl.insertBefore(entry, logEl.firstChild);
  }

  pauseCampaign() {
    if (this.campaignManager.pause()) {
      this.addRunningLog('⏸️ 活动已暂停', 'warning');
      this.updateRunningStatus('paused');
    }
  }

  resumeCampaign() {
    if (this.campaignManager.resume()) {
      this.addRunningLog('▶️ 活动继续运行', 'success');
      this.updateRunningStatus('running');
    }
  }

  stopCampaign() {
    if (confirm('确定停止当前活动吗？')) {
      if (this.campaignManager.stop()) {
        this.addRunningLog('⏹️ 活动已停止', 'error');
        this.updateRunningStatus('stopped');
        this.renderCampaignsList();
      }
    }
  }

  // =============== Utils ===============

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.bot = new TGMarketing();
});
