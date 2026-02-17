// TG Marketing - Campaign Manager

class CampaignManager {
  constructor() {
    this.campaigns = [];
    this.currentCampaign = null;
    this.isRunning = false;
    this.isPaused = false;
    this.stats = { searched: 0, joined: 0, sent: 0, failed: 0 };
    this.foundGroups = [];
    this.currentTab = null;
  }

  // =============== Storage ===============

  async load() {
    const data = await chrome.storage.local.get('campaigns');
    this.campaigns = data.campaigns || [];
    return this.campaigns;
  }

  async save() {
    await chrome.storage.local.set({ campaigns: this.campaigns });
  }

  // =============== CRUD ===============

  create(data) {
    const campaign = {
      id: Date.now().toString(),
      name: data.name || '未命名活动',
      keywords: data.keywords || [],
      message: data.message || '',
      images: data.images || [], // Base64 encoded images
      settings: {
        interval: data.interval || 60,
        maxGroups: data.maxGroups || 20,
        autoJoin: data.autoJoin !== false
      },
      status: 'ready', // draft, ready, running, paused, completed
      stats: { searched: 0, joined: 0, sent: 0, failed: 0 },
      groups: [], // Found and joined groups
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastRunAt: null
    };

    this.campaigns.unshift(campaign);
    this.save();
    return campaign;
  }

  get(id) {
    return this.campaigns.find(c => c.id === id);
  }

  update(id, data) {
    const campaign = this.get(id);
    if (!campaign) return null;

    Object.assign(campaign, data);
    campaign.updatedAt = Date.now();
    this.save();
    return campaign;
  }

  delete(id) {
    this.campaigns = this.campaigns.filter(c => c.id !== id);
    this.save();
  }

  // =============== Execution ===============

  async run(campaignId, callbacks = {}) {
    const campaign = this.get(campaignId);
    if (!campaign) throw new Error('活动不存在');

    // Get current Telegram tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url.includes('web.telegram.org')) {
      throw new Error('请先打开 Telegram Web');
    }
    this.currentTab = tab;

    // Check content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (!response?.connected) throw new Error('请刷新 Telegram 页面');
    } catch (e) {
      throw new Error('请刷新 Telegram 页面后重试');
    }

    this.currentCampaign = campaign;
    this.isRunning = true;
    this.isPaused = false;
    this.stats = { searched: 0, joined: 0, sent: 0, failed: 0 };
    this.foundGroups = [];

    campaign.status = 'running';
    campaign.lastRunAt = Date.now();
    await this.save();

    const log = (msg, type = '') => callbacks.onLog?.(msg, type);
    const updateStats = () => callbacks.onStats?.(this.stats, campaign.settings.maxGroups);
    const updateStatus = (status) => callbacks.onStatusChange?.(status);

    try {
      log('🚀 活动开始运行...');
      updateStatus('running');

      // Phase 1: Search groups by keywords
      log('📡 阶段1: 搜索群组...');
      for (const keyword of campaign.keywords) {
        if (!this.isRunning) break;
        while (this.isPaused) {
          await this.sleep(500);
          if (!this.isRunning) break;
        }

        log(`🔍 搜索关键词: ${keyword}`);
        
        try {
          const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'search',
            keyword: keyword
          });

          if (response?.results) {
            const groups = response.results.filter(r => r.isGroup || r.isChannel);
            log(`找到 ${groups.length} 个群组`, 'success');
            
            for (const group of groups) {
              if (!this.foundGroups.some(g => g.id === group.id)) {
                this.foundGroups.push(group);
              }
            }
          }
          this.stats.searched++;
          updateStats();
        } catch (e) {
          log(`搜索失败: ${e.message}`, 'error');
        }

        // Small delay between searches
        await this.sleep(2000);
      }

      log(`📊 共找到 ${this.foundGroups.length} 个群组`);

      // Phase 2: Join groups (if autoJoin enabled)
      if (campaign.settings.autoJoin && this.foundGroups.length > 0) {
        log('🚪 阶段2: 加入群组...');
        
        const toJoin = this.foundGroups.slice(0, campaign.settings.maxGroups);
        
        for (const group of toJoin) {
          if (!this.isRunning) break;
          while (this.isPaused) {
            await this.sleep(500);
            if (!this.isRunning) break;
          }

          log(`加入: ${group.name}...`);
          
          try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
              action: 'joinGroup',
              groupId: group.id
            });

            if (response?.success) {
              group.joined = true;
              this.stats.joined++;
              log(`✓ 已加入: ${group.name}`, 'success');
            } else {
              log(`✗ 加入失败: ${group.name}`, 'error');
            }
          } catch (e) {
            log(`✗ 加入出错: ${e.message}`, 'error');
          }
          
          updateStats();
          await this.sleep(3000); // Avoid rate limiting
        }
      }

      // Phase 3: Send messages
      const joinedGroups = this.foundGroups.filter(g => g.joined);
      if (joinedGroups.length > 0) {
        log(`💬 阶段3: 发送消息到 ${joinedGroups.length} 个群...`);
        
        for (const group of joinedGroups) {
          if (!this.isRunning) break;
          while (this.isPaused) {
            await this.sleep(500);
            if (!this.isRunning) break;
          }

          log(`发送到: ${group.name}...`);
          
          try {
            // Send message (with image if available)
            const sendData = {
              action: 'sendMessage',
              groupId: group.id,
              message: campaign.message
            };

            // If there are images, send them
            if (campaign.images && campaign.images.length > 0) {
              sendData.image = campaign.images[0]; // Send first image
            }

            const response = await chrome.tabs.sendMessage(this.currentTab.id, sendData);

            if (response?.success) {
              this.stats.sent++;
              log(`✓ 发送成功: ${group.name}`, 'success');
            } else {
              this.stats.failed++;
              log(`✗ 发送失败: ${group.name} - ${response?.error}`, 'error');
            }
          } catch (e) {
            this.stats.failed++;
            log(`✗ 发送出错: ${e.message}`, 'error');
          }
          
          updateStats();
          
          // Wait interval between messages
          if (this.isRunning && joinedGroups.indexOf(group) < joinedGroups.length - 1) {
            log(`等待 ${campaign.settings.interval} 秒...`, 'warning');
            await this.sleep(campaign.settings.interval * 1000);
          }
        }
      }

      // Complete
      if (this.isRunning) {
        campaign.status = 'completed';
        campaign.stats = { ...this.stats };
        campaign.groups = this.foundGroups;
        await this.save();
        
        log('🎉 活动运行完成！', 'success');
        log(`统计: 搜索${this.stats.searched}次, 加入${this.stats.joined}群, 发送${this.stats.sent}条, 失败${this.stats.failed}条`);
        updateStatus('completed');
      }

    } catch (error) {
      log(`❌ 运行出错: ${error.message}`, 'error');
      campaign.status = 'ready';
      await this.save();
      updateStatus('error');
    } finally {
      this.isRunning = false;
      this.currentCampaign = null;
    }
  }

  pause() {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      if (this.currentCampaign) {
        this.currentCampaign.status = 'paused';
        this.save();
      }
      return true;
    }
    return false;
  }

  resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      if (this.currentCampaign) {
        this.currentCampaign.status = 'running';
        this.save();
      }
      return true;
    }
    return false;
  }

  stop() {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = false;
      if (this.currentCampaign) {
        this.currentCampaign.status = 'ready';
        this.currentCampaign.stats = { ...this.stats };
        this.currentCampaign.groups = this.foundGroups;
        this.save();
      }
      return true;
    }
    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export
window.CampaignManager = CampaignManager;
