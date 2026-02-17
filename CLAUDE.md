# TG Marketing - Fancy 的工作笔记

> 这是我 (Fancy) 为自己写的文档，记录这个项目的所有功能和关键实现。
> 以后读这个文件就能快速回忆起来。

## 📌 项目概述

**TG Marketing** 是一个 Telegram 群组营销自动化工具，包含：
1. **Chrome Extension** - Campaign 管理界面
2. **OpenClaw 集成** - 我可以完全自主操作浏览器
3. **智能防封系统** - 模拟人类行为，降低被封风险

**GitHub**: https://github.com/haohappy/tg-group-bot  
**当前版本**: v2.1.0

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Boss 的指令                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 Fancy (OpenClaw)                         │
│  • 理解指令                                              │
│  • 操作浏览器 (browser tool)                             │
│  • 执行 Campaign                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ OpenClaw 浏览器  │     │  Boss 的 Chrome  │
│ (profile=openclaw)│    │ (profile=chrome) │
│ • 完全自主控制   │     │ • 需要 Relay 连接 │
│ • 独立会话       │     │ • 已登录状态      │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  Telegram Web K                          │
│                 web.telegram.org/k/                      │
│  • Content Script 注入                                   │
│  • DOM 操作 (搜索/加入/发送)                             │
│  • 人类行为模拟                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
tg-group-bot/
├── manifest.json        # Extension 配置 (Manifest V3)
├── popup.html           # 弹出界面 HTML
├── popup.css            # 样式表
├── popup.js             # 主控制器 (TGMarketing 类)
├── campaign.js          # Campaign 管理器 (CampaignManager 类)
├── human-behavior.js    # 人类行为模拟器 (HumanBehavior 类) ⭐
├── content.js           # 注入 Telegram Web 的脚本
├── content.css          # 注入样式
├── background.js        # Service Worker
├── updater.js           # 自动更新检查
├── icons/               # 图标文件
├── CLAUDE.md            # 本文档 (AI 工作笔记)
└── README.md            # 用户文档
```

---

## 🎯 功能详解

### 1. Campaign 管理 (Chrome Extension)

#### 创建 Campaign
| 字段 | 说明 |
|------|------|
| 活动名称 | 方便识别，如 "美女图片推广" |
| 搜索关键词 | 每行一个，依次搜索 |
| 广告内容 | 支持 Emoji 和换行 |
| 图片 | 可上传多张，Base64 存储 |
| 发送间隔 | 基础间隔 (秒)，实际会加随机偏移 |
| 最多加入群数 | 限制加入的群数量 |
| 自动加入 | 是否自动加入搜索到的群 |

#### Campaign 状态流转
```
draft → ready → running ⇄ paused → completed
                  ↓
                error
```

#### 数据存储
```javascript
// 使用 chrome.storage.local
chrome.storage.local.set({ campaigns: [...] });
chrome.storage.local.get('campaigns');
```

### 2. Content Script (content.js)

注入到 `web.telegram.org/*`，提供核心操作：

#### 搜索群组
```javascript
// 请求
{ action: 'search', keyword: 'xxx', humanMode: true }

// 响应
{ results: [{ id, name, members, isGroup, isChannel }] }
```

#### 加入群组
```javascript
// 请求
{ action: 'joinGroup', groupId: 'xxx', humanMode: true }

// 响应
{ success: true, joined: true }
```

#### 发送消息
```javascript
// 请求
{ 
  action: 'sendMessage', 
  groupId: 'xxx', 
  message: 'xxx', 
  image: 'base64...', // 可选
  humanMode: true 
}

// 响应
{ success: true }
```

#### 关键 DOM 选择器 (Telegram Web K)
```javascript
// 搜索框
'.input-search input'

// 消息输入框
'.input-message-input'

// 发送按钮
'.btn-send'

// 聊天项 (用 peer ID 定位)
'[data-peer-id="xxx"]'

// 加入按钮
'button' with text 'JOIN'

// 群标题
'.peer-title'
```

---

## 🛡️ 智能防封系统 (v2.1.0)

### HumanBehavior 类 (human-behavior.js)

完整的人类行为模拟器：

#### 配置参数
```javascript
this.config = {
  // 打字速度
  typing: {
    min: 50,              // 最快 50ms/字符
    max: 150,             // 最慢 150ms/字符
    pauseChance: 0.1,     // 10% 停顿概率
    pauseMin: 200,        // 停顿最短
    pauseMax: 800,        // 停顿最长
    typoChance: 0.02,     // 2% 打错字概率
  },
  
  // 操作间隔
  interval: {
    searchDelay: { min: 2000, max: 4000 },    // 搜索后 2-4秒
    joinDelay: { min: 3000, max: 6000 },      // 加入后 3-6秒
    sendDelay: { min: 45000, max: 90000 },    // 发送后 45-90秒
    readingTime: { min: 1000, max: 3000 },    // 阅读时间
  },
  
  // 会话管理
  session: {
    actionsBeforeBreak: { min: 5, max: 10 },   // 休息前操作数
    breakDuration: { min: 30000, max: 120000 }, // 休息 30秒-2分钟
    maxActionsPerHour: 30,                      // 每小时最多30次
  },
  
  // 随机跳过
  skip: {
    enabled: true,
    chance: 0.1,  // 10% 跳过概率
  }
};
```

#### 核心方法

| 方法 | 说明 |
|------|------|
| `randomDelay(minMax)` | 随机延迟 |
| `sendDelay()` | 发送间隔 (最重要的防封延迟) |
| `simulateTyping(text, el)` | 模拟人类打字 |
| `simulateScroll(el)` | 模拟滚动 |
| `shouldTakeBreak()` | 是否该休息 |
| `takeBreak()` | 执行休息 |
| `isRateLimited()` | 检查速率限制 |
| `shouldSkip()` | 是否跳过当前操作 |
| `shuffle(array)` | 打乱数组顺序 |

#### 防封策略汇总

| 策略 | 实现 | 效果 |
|------|------|------|
| 随机延迟 | 45-90秒 + ±20% | 避免固定间隔检测 |
| 模拟打字 | 50-150ms/字符 | 有打字节奏 |
| 打错字 | 2% 概率 | 更像真人 |
| 思考停顿 | 10% 概率 | 模拟人类思考 |
| 随机跳过 | 10% 概率 | 不是 100% 执行 |
| 打乱顺序 | Fisher-Yates | 避免固定模式 |
| 自动休息 | 5-10 操作后 | 避免连续操作 |
| 速率限制 | 30次/小时 | 控制总量 |
| 额外长停顿 | 15% 概率多等 10-30秒 | 模拟中途离开 |

---

## 🤖 OpenClaw 集成

### 我的自主能力

我可以使用 `browser` tool 完全控制浏览器：

#### 启动和打开页面
```javascript
// 启动 OpenClaw 浏览器
browser({ action: 'start', profile: 'openclaw' })

// 打开 Telegram Web
browser({ 
  action: 'open', 
  profile: 'openclaw', 
  targetUrl: 'https://web.telegram.org/k/' 
})
```

#### 页面交互
```javascript
// 截图
browser({ action: 'screenshot', profile: 'openclaw' })

// 获取页面结构 (用于找元素)
browser({ action: 'snapshot', profile: 'openclaw', compact: true })

// 点击元素
browser({ 
  action: 'act', 
  profile: 'openclaw', 
  request: { kind: 'click', ref: 'e123' } 
})

// 输入文字
browser({ 
  action: 'act', 
  profile: 'openclaw', 
  request: { kind: 'type', ref: 'e123', text: 'hello' } 
})

// 执行 JavaScript
browser({ 
  action: 'act', 
  profile: 'openclaw', 
  request: { 
    kind: 'evaluate', 
    fn: '() => document.querySelector(".btn").click()' 
  } 
})
```

### 两种浏览器 Profile

| Profile | 说明 | 使用场景 |
|---------|------|----------|
| `openclaw` | OpenClaw 管理的独立浏览器 | 完全自主操作，需单独登录 |
| `chrome` | Boss 的 Chrome (Browser Relay) | 使用已有登录状态，需手动连接 |

### 完整自动化流程

```
1. 启动 OpenClaw 浏览器
   browser({ action: 'start', profile: 'openclaw' })

2. 打开 Telegram Web
   browser({ action: 'open', targetUrl: 'https://web.telegram.org/k/' })

3. (首次) Boss 扫码登录

4. 执行 Campaign:
   a. snapshot 获取页面结构
   b. 找到搜索框，输入关键词
   c. 解析搜索结果
   d. 点击群组，找 JOIN 按钮
   e. 输入广告内容
   f. 粘贴图片 (如果有)
   g. 点击发送
   h. 智能等待 (随机间隔)
   i. 重复下一个群

5. 报告执行结果
```

---

## 🔑 关键代码片段

### 模拟人类打字 (human-behavior.js)
```javascript
async simulateTyping(text, inputElement) {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // 随机打字延迟
    await this.sleep(this.randomInt(50, 150));
    
    // 2% 概率打错字
    if (this.chance(0.02)) {
      const typo = String.fromCharCode(this.randomInt(97, 122));
      inputElement.textContent += typo;
      await this.sleep(this.randomInt(200, 400));
      inputElement.textContent = inputElement.textContent.slice(0, -1);
    }
    
    // 正常输入
    inputElement.textContent += char;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    
    // 10% 概率停顿
    if (this.chance(0.1)) {
      await this.sleep(this.randomInt(200, 800));
    }
  }
}
```

### Campaign 执行核心 (campaign.js)
```javascript
// 阶段3: 发送消息 (带防封)
for (const group of sendOrder) {
  // 检查休息
  if (this.human.shouldTakeBreak()) {
    await this.human.takeBreak();
  }
  
  // 随机跳过
  if (this.human.shouldSkip()) {
    this.stats.skipped++;
    continue;
  }
  
  // 发送
  await chrome.tabs.sendMessage(tabId, {
    action: 'sendMessage',
    groupId: group.id,
    message: campaign.message,
    humanMode: true
  });
  
  // 智能等待
  await this.human.sendDelay();
}
```

### 图片粘贴 (content.js)
```javascript
async function pasteImage(base64Data, targetElement) {
  const response = await fetch(base64Data);
  const blob = await response.blob();
  const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
  
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  
  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    clipboardData: dataTransfer
  });
  
  targetElement.dispatchEvent(pasteEvent);
}
```

---

## ⚠️ 注意事项

### Telegram 限制
- **频率限制**: 发送太快会被限制，智能防封已处理
- **加群限制**: 短时间加太多群可能被封
- **内容审核**: 某些内容可能被标记为 spam
- **IP 限制**: 同一 IP 大量操作可能触发验证

### 选择器可能变化
Telegram Web 更新后，DOM 选择器可能失效。需要检查：
- `.input-search input` - 搜索框
- `.input-message-input` - 消息输入框
- `.btn-send` - 发送按钮
- `[data-peer-id]` - 聊天项

### 图片发送
- 使用 ClipboardEvent 模拟粘贴
- 某些浏览器安全限制可能导致失败
- 建议图片 < 5MB

---

## 📋 TODO / 未来改进

- [ ] 支持多账号切换
- [x] ~~智能防封策略~~ ✅ v2.1.0
- [ ] 群组黑名单 (避免重复发送)
- [ ] 发送结果统计报表导出
- [ ] 定时任务 (OpenClaw cron 集成)
- [ ] 支持更多消息类型 (视频、文件)
- [ ] 验证码自动处理
- [ ] 代理 IP 支持

---

## 🚀 快速使用

### Boss 告诉我运行 Campaign

```
Boss: 运行一个 Campaign
关键词: beautiful girls, sexy photos
广告: 🔥 每日更新！👉 https://example.com
最多加入 10 个群
```

### 我的执行流程

1. 启动 OpenClaw 浏览器 (如果没启动)
2. 打开 Telegram Web (如果没打开)
3. 依次搜索关键词 (打乱顺序)
4. 加入找到的群 (最多 10 个，随机跳过一些)
5. 发送广告消息 (模拟人类打字)
6. 智能等待 (45-90秒 + 随机偏移)
7. 定期休息 (每 5-10 操作休息 30秒-2分钟)
8. 报告结果

---

## 📊 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v2.1.0 | 2026-02-17 | 智能防封系统 |
| v2.0.0 | 2026-02-17 | Campaign 管理系统 |
| v1.2.0 | 2026-02-17 | 模板管理功能 |
| v1.1.0 | 2026-02-17 | 基础功能完成 |

---

*最后更新: 2026-02-17 by Fancy ☀️*
