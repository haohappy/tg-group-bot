// TG Marketing - Campaign Manager

class CampaignManager {
  constructor() {
    this.campaigns = [];
    this.currentCampaign = null;
    this.isRunning = false;
    this.isPaused = false;
    this.stats = { searched: 0, joined: 0, sent: 0, failed: 0, skipped: 0 };
    this.foundGroups = [];
    this.currentTab = null;
    this.human = new HumanBehavior(); // 人类行为模拟器
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
    this.stats = { searched: 0, joined: 0, sent: 0, failed: 0, skipped: 0 };
    this.foundGroups = [];
    this.human = new HumanBehavior(); // 重置人类行为模拟器

    campaign.status = 'running';
    campaign.lastRunAt = Date.now();
    await this.save();

    const log = (msg, type = '') => callbacks.onLog?.(msg, type);
    const updateStats = () => callbacks.onStats?.(this.stats, campaign.settings.maxGroups);
    const updateStatus = (status) => callbacks.onStatusChange?.(status);

    try {
      log('🚀 活动开始运行 (智能防封模式)...');
      log('🛡️ 已启用: 随机延迟、模拟人类行为、自动休息', 'warning');
      updateStatus('running');

      // Phase 1: Search groups by keywords (随机顺序)
      log('📡 阶段1: 搜索群组...');
      const keywords = this.human.shuffle([...campaign.keywords]); // 打乱关键词顺序
      
      for (const keyword of keywords) {
        if (!this.isRunning) break;
        while (this.isPaused) {
          await this.sleep(500);
          if (!this.isRunning) break;
        }

        // 检查是否需要休息
        if (this.human.shouldTakeBreak()) {
          const breakTime = await this.human.takeBreak();
          log(`☕ 休息 ${this.human.formatDelay(breakTime)}...`, 'warning');
        }

        log(`🔍 搜索关键词: ${keyword}`);
        this.human.recordAction();
        
        try {
          const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'search',
            keyword: keyword,
            humanMode: true // 通知 content script 使用人类模式
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

        // 随机搜索延迟
        const searchDelay = await this.human.searchDelay();
        log(`⏳ 等待 ${this.human.formatDelay(searchDelay)}`, 'warning');
      }

      log(`📊 共找到 ${this.foundGroups.length} 个群组`);

      // Phase 2: Join groups (if autoJoin enabled)
      if (campaign.settings.autoJoin && this.foundGroups.length > 0) {
        log('🚪 阶段2: 智能加入群组...');
        log('🔍 会自动跳过: 频道、需要审批的群、不能发消息的群', 'warning');
        
        // ===== 预过滤: 只保留可能可以发送的群组 =====
        const likelySendable = this.foundGroups.filter(g => g.likelySendable || g.isGroup);
        const channelsSkipped = this.foundGroups.length - likelySendable.length;
        if (channelsSkipped > 0) {
          log(`📢 已跳过 ${channelsSkipped} 个频道 (只能管理员发消息)`, 'warning');
          this.stats.skipped += channelsSkipped;
          updateStats();
        }
        
        // 打乱顺序，并可能取子集
        let toJoin = this.human.shuffleGroups(
          likelySendable.slice(0, campaign.settings.maxGroups)
        );
        
        for (let i = 0; i < toJoin.length; i++) {
          const group = toJoin[i];
          
          if (!this.isRunning) break;
          while (this.isPaused) {
            await this.sleep(500);
            if (!this.isRunning) break;
          }

          // 随机跳过一些群
          if (this.human.shouldSkip()) {
            log(`⏭️ 随机跳过: ${group.name}`, 'warning');
            this.stats.skipped++;
            updateStats();
            continue;
          }

          // 检查是否需要休息
          if (this.human.shouldTakeBreak()) {
            const breakTime = await this.human.takeBreak();
            log(`☕ 休息 ${this.human.formatDelay(breakTime)}...`, 'warning');
          }

          // 检查速率限制
          if (this.human.isRateLimited()) {
            log('⚠️ 操作过快，等待冷却...', 'warning');
            const waitTime = await this.human.waitForRateLimit();
            log(`继续，已等待 ${this.human.formatDelay(waitTime)}`);
          }

          log(`[${i + 1}/${toJoin.length}] 加入: ${group.name}...`);
          this.human.recordAction();
          
          try {
            // 点击前延迟
            await this.human.preClickDelay();
            
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
              action: 'joinGroup',
              groupId: group.id,
              humanMode: true
            });

            // ===== 智能检测处理 =====
            if (response?.skip) {
              // 自动跳过: Channel、需要审批、不能发消息
              log(`⏭️ 自动跳过: ${group.name} (${response.reason})`, 'warning');
              group.skipped = true;
              group.skipReason = response.reason;
              this.stats.skipped++;
            } else if (response?.success) {
              if (response.canSend !== false) {
                group.joined = true;
                group.canSend = true;
                this.stats.joined++;
                log(`✓ 已加入: ${group.name}`, 'success');
              } else {
                // 加入了但不能发消息
                log(`⚠️ 已加入但不能发消息: ${group.name}`, 'warning');
                group.joined = true;
                group.canSend = false;
                this.stats.skipped++;
              }
            } else {
              log(`✗ 加入失败: ${group.name} - ${response?.error || '未知错误'}`, 'error');
              this.stats.failed++;
            }
          } catch (e) {
            log(`✗ 加入出错: ${e.message}`, 'error');
            this.stats.failed++;
          }
          
          updateStats();
          
          // 随机加入延迟
          if (i < toJoin.length - 1) {
            const joinDelay = await this.human.joinDelay();
            log(`⏳ 等待 ${this.human.formatDelay(joinDelay)}`, 'warning');
          }
        }
      }

      // Phase 3: Send messages
      // ===== 只发送到可以发消息的群 =====
      const sendableGroups = this.foundGroups.filter(g => g.joined && g.canSend !== false && !g.skipped);
      const notSendable = this.foundGroups.filter(g => g.joined).length - sendableGroups.length;
      
      if (notSendable > 0) {
        log(`⚠️ ${notSendable} 个已加入的群不能发消息，已跳过`, 'warning');
      }
      
      if (sendableGroups.length > 0) {
        log(`💬 阶段3: 发送消息到 ${sendableGroups.length} 个群...`);
        
        // 再次打乱发送顺序
        const sendOrder = this.human.shuffleGroups(sendableGroups);
        
        for (let i = 0; i < sendOrder.length; i++) {
          const group = sendOrder[i];
          
          if (!this.isRunning) break;
          while (this.isPaused) {
            await this.sleep(500);
            if (!this.isRunning) break;
          }

          // 随机跳过
          if (this.human.shouldSkip()) {
            log(`⏭️ 随机跳过发送: ${group.name}`, 'warning');
            this.stats.skipped++;
            updateStats();
            continue;
          }

          // 检查是否需要休息
          if (this.human.shouldTakeBreak()) {
            const breakTime = await this.human.takeBreak();
            log(`☕ 长休息 ${this.human.formatDelay(breakTime)}...`, 'warning');
          }

          // 检查速率限制
          if (this.human.isRateLimited()) {
            log('⚠️ 发送过快，冷却中...', 'warning');
            const waitTime = await this.human.waitForRateLimit();
            log(`继续，已等待 ${this.human.formatDelay(waitTime)}`);
          }

          log(`[${i + 1}/${sendOrder.length}] 发送到: ${group.name}...`);
          this.human.recordAction();
          
          try {
            await this.human.preClickDelay();
            
            // Send message (with image if available)
            const sendData = {
              action: 'sendMessage',
              groupId: group.id,
              message: campaign.message,
              humanMode: true // 启用人类打字模式
            };

            // If there are images, send them
            if (campaign.images && campaign.images.length > 0) {
              // 随机选择一张图片 (如果有多张)
              const imgIndex = this.human.randomInt(0, campaign.images.length - 1);
              sendData.image = campaign.images[imgIndex];
            }

            const response = await chrome.tabs.sendMessage(this.currentTab.id, sendData);

            // ===== 处理发送响应 =====
            if (response?.skip) {
              // 发送时检测到不能发送
              log(`⏭️ 自动跳过: ${group.name} (${response.error || response.reason})`, 'warning');
              this.stats.skipped++;
              group.canSend = false;
            } else if (response?.success) {
              this.stats.sent++;
              log(`✓ 发送成功: ${group.name}`, 'success');
            } else {
              this.stats.failed++;
              log(`✗ 发送失败: ${group.name} - ${response?.error || '未知错误'}`, 'error');
            }
          } catch (e) {
            this.stats.failed++;
            log(`✗ 发送出错: ${e.message}`, 'error');
          }
          
          updateStats();
          
          // 随机发送延迟 (最重要的防封措施)
          if (i < sendOrder.length - 1) {
            const sendDelay = await this.human.sendDelay();
            log(`⏳ 智能等待 ${this.human.formatDelay(sendDelay)}`, 'warning');
          }
        }
      } else {
        log('⚠️ 没有可以发送消息的群组', 'warning');
      }

      // Complete
      if (this.isRunning) {
        campaign.status = 'completed';
        campaign.stats = { ...this.stats };
        campaign.groups = this.foundGroups;
        await this.save();
        
        log('🎉 活动运行完成！', 'success');
        log(`统计: 搜索${this.stats.searched}次, 加入${this.stats.joined}群, 发送${this.stats.sent}条, 跳过${this.stats.skipped}个, 失败${this.stats.failed}条`);
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
