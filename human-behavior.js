// TG Marketing - Human Behavior Simulation
// 模拟人类行为，降低被封风险

class HumanBehavior {
  constructor() {
    // 配置参数
    this.config = {
      // 打字速度 (毫秒/字符)
      typing: {
        min: 50,
        max: 150,
        pauseChance: 0.1,      // 10% 概率打字时停顿
        pauseMin: 200,
        pauseMax: 800,
        typoChance: 0.02,     // 2% 概率打错字再删除
      },
      
      // 点击前延迟
      click: {
        min: 100,
        max: 400,
      },
      
      // 操作间隔 (基础值会乘以随机系数)
      interval: {
        searchDelay: { min: 2000, max: 4000 },      // 搜索后等待
        joinDelay: { min: 3000, max: 6000 },        // 加入后等待
        sendDelay: { min: 45000, max: 90000 },      // 发送后等待 (45-90秒)
        readingTime: { min: 1000, max: 3000 },      // 阅读时间
      },
      
      // 会话行为
      session: {
        actionsBeforeBreak: { min: 5, max: 10 },    // 多少操作后休息
        breakDuration: { min: 30000, max: 120000 }, // 休息时长 (30秒-2分钟)
        maxActionsPerHour: 30,                       // 每小时最大操作数
      },
      
      // 滚动行为
      scroll: {
        enabled: true,
        steps: { min: 2, max: 5 },
        stepDelay: { min: 100, max: 300 },
        stepDistance: { min: 50, max: 150 },
      },
      
      // 随机跳过
      skip: {
        enabled: true,
        chance: 0.1,  // 10% 概率跳过某个群
      }
    };
    
    // 状态追踪
    this.actionCount = 0;
    this.sessionStartTime = Date.now();
    this.lastActionTime = 0;
  }

  // =============== 随机数工具 ===============

  // 获取范围内的随机整数
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 获取范围内的随机浮点数
  randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  // 概率判断
  chance(probability) {
    return Math.random() < probability;
  }

  // 从数组随机选择
  randomChoice(array) {
    return array[this.randomInt(0, array.length - 1)];
  }

  // 打乱数组顺序 (Fisher-Yates)
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // =============== 延迟函数 ===============

  // 基础 sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 随机延迟
  async randomDelay(minMax) {
    const delay = this.randomInt(minMax.min, minMax.max);
    await this.sleep(delay);
    return delay;
  }

  // 搜索后延迟
  async searchDelay() {
    return this.randomDelay(this.config.interval.searchDelay);
  }

  // 加入后延迟
  async joinDelay() {
    return this.randomDelay(this.config.interval.joinDelay);
  }

  // 发送后延迟 (最重要的延迟)
  async sendDelay() {
    // 基础延迟
    let delay = this.randomInt(
      this.config.interval.sendDelay.min,
      this.config.interval.sendDelay.max
    );
    
    // 添加额外随机性 (±20%)
    const variance = delay * 0.2;
    delay += this.randomInt(-variance, variance);
    
    // 偶尔有更长的停顿 (模拟人去做其他事)
    if (this.chance(0.15)) {
      delay += this.randomInt(10000, 30000);
    }
    
    await this.sleep(delay);
    return delay;
  }

  // 阅读时间 (查看群信息时)
  async readingDelay() {
    return this.randomDelay(this.config.interval.readingTime);
  }

  // 点击前延迟
  async preClickDelay() {
    return this.randomDelay(this.config.click);
  }

  // =============== 模拟打字 ===============

  // 模拟人类打字 (返回打字事件序列)
  async simulateTyping(text, inputElement) {
    const events = [];
    let currentText = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // 随机打字延迟
      const typeDelay = this.randomInt(
        this.config.typing.min,
        this.config.typing.max
      );
      await this.sleep(typeDelay);
      
      // 小概率打错字
      if (this.chance(this.config.typing.typoChance) && i < text.length - 1) {
        // 打一个错误字符
        const typo = String.fromCharCode(this.randomInt(97, 122));
        currentText += typo;
        inputElement.textContent = currentText;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 短暂停顿发现错误
        await this.sleep(this.randomInt(200, 400));
        
        // 删除错误
        currentText = currentText.slice(0, -1);
        inputElement.textContent = currentText;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        await this.sleep(this.randomInt(100, 200));
      }
      
      // 正常输入
      currentText += char;
      inputElement.textContent = currentText;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 随机停顿 (模拟思考)
      if (this.chance(this.config.typing.pauseChance)) {
        await this.sleep(this.randomInt(
          this.config.typing.pauseMin,
          this.config.typing.pauseMax
        ));
      }
    }
    
    return currentText;
  }

  // =============== 模拟滚动 ===============

  async simulateScroll(element) {
    if (!this.config.scroll.enabled) return;
    
    const steps = this.randomInt(
      this.config.scroll.steps.min,
      this.config.scroll.steps.max
    );
    
    for (let i = 0; i < steps; i++) {
      const distance = this.randomInt(
        this.config.scroll.stepDistance.min,
        this.config.scroll.stepDistance.max
      );
      
      element.scrollTop += distance;
      
      await this.sleep(this.randomInt(
        this.config.scroll.stepDelay.min,
        this.config.scroll.stepDelay.max
      ));
    }
  }

  // =============== 会话管理 ===============

  // 记录操作
  recordAction() {
    this.actionCount++;
    this.lastActionTime = Date.now();
  }

  // 检查是否需要休息
  shouldTakeBreak() {
    const threshold = this.randomInt(
      this.config.session.actionsBeforeBreak.min,
      this.config.session.actionsBeforeBreak.max
    );
    return this.actionCount >= threshold;
  }

  // 休息
  async takeBreak() {
    const duration = this.randomInt(
      this.config.session.breakDuration.min,
      this.config.session.breakDuration.max
    );
    await this.sleep(duration);
    this.actionCount = 0; // 重置计数
    return duration;
  }

  // 检查速率限制
  isRateLimited() {
    const elapsed = Date.now() - this.sessionStartTime;
    const hours = elapsed / (1000 * 60 * 60);
    const actionsPerHour = this.actionCount / hours;
    return actionsPerHour > this.config.session.maxActionsPerHour;
  }

  // 等待速率恢复
  async waitForRateLimit() {
    // 等待足够时间让速率降下来
    const waitTime = this.randomInt(60000, 180000); // 1-3 分钟
    await this.sleep(waitTime);
    return waitTime;
  }

  // =============== 决策函数 ===============

  // 是否跳过这个群
  shouldSkip() {
    return this.config.skip.enabled && this.chance(this.config.skip.chance);
  }

  // 打乱群组顺序
  shuffleGroups(groups) {
    return this.shuffle(groups);
  }

  // 获取随机的群组子集 (不是每次都处理所有)
  getRandomSubset(groups, minRatio = 0.7, maxRatio = 1.0) {
    const ratio = this.randomFloat(minRatio, maxRatio);
    const count = Math.ceil(groups.length * ratio);
    const shuffled = this.shuffle(groups);
    return shuffled.slice(0, count);
  }

  // =============== 时间相关 ===============

  // 获取当前是否是活跃时间 (避免凌晨操作)
  isActiveHours() {
    const hour = new Date().getHours();
    // 假设活跃时间是 8:00 - 23:00
    return hour >= 8 && hour <= 23;
  }

  // 获取下一个活跃时间的等待毫秒
  getWaitUntilActiveHours() {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour < 8) {
      // 等到 8 点
      const target = new Date(now);
      target.setHours(8, 0, 0, 0);
      return target.getTime() - now.getTime();
    } else if (hour >= 23) {
      // 等到明天 8 点
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(8, 0, 0, 0);
      return target.getTime() - now.getTime();
    }
    
    return 0; // 当前是活跃时间
  }

  // =============== 日志 ===============

  // 格式化延迟时间
  formatDelay(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}

// 导出
window.HumanBehavior = HumanBehavior;
