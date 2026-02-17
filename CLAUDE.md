# TG Marketing - Fancy 的工作笔记

> 这是我 (Fancy) 为自己写的文档，记录这个项目的所有功能和关键实现。
> 以后读这个文件就能快速回忆起来。

## 📌 项目概述

**TG Marketing** 是一个 Telegram 群组营销自动化工具，包含：
1. **Chrome Extension** - Campaign 管理界面
2. **OpenClaw 集成** - 我可以完全自主操作浏览器

**GitHub**: https://github.com/haohappy/tg-group-bot
**当前版本**: v2.0.0

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
└─────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
tg-group-bot/
├── manifest.json      # Extension 配置 (v3)
├── popup.html         # 弹出界面 HTML
├── popup.css          # 样式
├── popup.js           # 主控制器 (TGMarketing 类)
├── campaign.js        # Campaign 管理器 (CampaignManager 类)
├── content.js         # 注入 Telegram Web 的脚本
├── content.css        # 注入样式
├── background.js      # Service Worker
├── updater.js         # 自动更新检查
├── icons/             # 图标
└── CLAUDE.md          # 本文档
```

---

## 🎯 功能详解

### 1. Campaign 管理 (Chrome Extension)

#### 创建 Campaign
- **活动名称**: 方便识别
- **搜索关键词**: 每行一个，依次搜索
- **广告内容**: 支持 Emoji 和换行
- **图片**: 可上传多张，Base64 存储
- **设置**:
  - `interval`: 发送间隔 (秒)
  - `maxGroups`: 最多加入群数
  - `autoJoin`: 是否自动加入

#### Campaign 状态
- `draft`: 草稿
- `ready`: 就绪，可运行
- `running`: 运行中
- `paused`: 已暂停
- `completed`: 已完成

#### 存储
使用 `chrome.storage.local`:
```javascript
// 保存
chrome.storage.local.set({ campaigns: [...] });

// 读取
const data = await chrome.storage.local.get('campaigns');
```

### 2. Content Script (content.js)

注入到 `web.telegram.org/*`，提供以下功能：

#### 搜索群组
```javascript
// 消息: { action: 'search', keyword: 'xxx' }
// 返回: { results: [{ id, name, members, isGroup, isChannel }] }
```

**关键选择器** (Telegram Web K):
- 搜索框: `.input-search input`
- 聊天项: `.chatlist-chat`, `[data-peer-id]`
- 标题: `.peer-title`

#### 加入群组
```javascript
// 消息: { action: 'joinGroup', groupId: 'xxx' }
// 流程: 点击群 → 找 JOIN 按钮 → 点击
```

#### 发送消息
```javascript
// 消息: { action: 'sendMessage', groupId: 'xxx', message: 'xxx', image: 'base64...' }
// 流程: 点击群 → 粘贴图片(可选) → 输入文字 → 点击发送
```

**关键选择器**:
- 消息输入框: `.input-message-input`
- 发送按钮: `.btn-send`

### 3. 自动更新 (updater.js)

检查 GitHub Releases:
```javascript
const GITHUB_API = 'https://api.github.com/repos/haohappy/tg-group-bot/releases/latest';
```

比较版本号，显示更新提示。

---

## 🤖 我的自主能力 (OpenClaw 集成)

### 浏览器控制

我可以使用 `browser` tool 操作浏览器：

```javascript
// 启动 OpenClaw 浏览器
browser({ action: 'start', profile: 'openclaw' })

// 打开 URL
browser({ action: 'open', profile: 'openclaw', targetUrl: 'https://web.telegram.org/k/' })

// 截图
browser({ action: 'screenshot', profile: 'openclaw' })

// 获取页面结构
browser({ action: 'snapshot', profile: 'openclaw', compact: true })

// 点击元素
browser({ action: 'act', profile: 'openclaw', request: { kind: 'click', ref: 'e123' } })

// 输入文字
browser({ action: 'act', profile: 'openclaw', request: { kind: 'type', ref: 'e123', text: 'hello' } })

// 执行 JavaScript
browser({ action: 'act', profile: 'openclaw', request: { kind: 'evaluate', fn: '() => { ... }' } })
```

### 两种浏览器 Profile

| Profile | 说明 | 使用场景 |
|---------|------|----------|
| `openclaw` | OpenClaw 管理的独立浏览器 | 完全自主操作，需要单独登录 |
| `chrome` | Boss 的 Chrome (通过 Browser Relay) | 使用已有登录状态，需要手动连接 |

### 完整自动化流程

我可以完全自主执行以下流程：

```
1. 启动 OpenClaw 浏览器
2. 打开 Telegram Web
3. (首次需要 Boss 扫码登录)
4. 执行 Campaign:
   a. 在搜索框输入关键词
   b. 解析搜索结果
   c. 点击群组加入
   d. 输入广告内容
   e. 粘贴图片 (如果有)
   f. 点击发送
   g. 等待间隔
   h. 重复下一个群
5. 报告执行结果
```

---

## 🔑 关键代码片段

### 搜索群组 (content.js)
```javascript
async function handleSearch(keyword) {
  // 找到搜索框
  const input = document.querySelector('.input-search input');
  
  // 输入关键词
  input.value = keyword;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  // 等待结果
  await sleep(2000);
  
  // 解析结果
  return parseGlobalSearchResults();
}
```

### 发送消息 (content.js)
```javascript
async function handleSendMessage(groupId, message, imageBase64) {
  // 打开群聊
  document.querySelector(`[data-peer-id="${groupId}"]`).click();
  await sleep(1500);
  
  // 粘贴图片 (如果有)
  if (imageBase64) {
    await pasteImage(imageBase64, messageInput);
  }
  
  // 输入文字
  messageInput.textContent = message;
  messageInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  // 发送
  document.querySelector('.btn-send').click();
}
```

### Campaign 执行 (campaign.js)
```javascript
async run(campaignId, callbacks) {
  // 阶段1: 搜索
  for (const keyword of campaign.keywords) {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'search',
      keyword: keyword
    });
    // 收集结果...
  }
  
  // 阶段2: 加入
  for (const group of foundGroups) {
    await chrome.tabs.sendMessage(tabId, {
      action: 'joinGroup',
      groupId: group.id
    });
  }
  
  // 阶段3: 发送
  for (const group of joinedGroups) {
    await chrome.tabs.sendMessage(tabId, {
      action: 'sendMessage',
      groupId: group.id,
      message: campaign.message,
      image: campaign.images[0]
    });
    await sleep(campaign.settings.interval * 1000);
  }
}
```

---

## ⚠️ 注意事项

### Telegram 限制
- **频率限制**: 发送太快会被限制，建议间隔 60 秒以上
- **加群限制**: 短时间加太多群可能被封
- **内容审核**: 某些内容可能被标记为 spam

### 选择器可能变化
Telegram Web 更新后，DOM 选择器可能失效。关键选择器:
- `.input-search input` - 搜索框
- `.input-message-input` - 消息输入框
- `.btn-send` - 发送按钮
- `[data-peer-id]` - 聊天项

### 图片发送
使用 ClipboardEvent 模拟粘贴:
```javascript
const pasteEvent = new ClipboardEvent('paste', {
  clipboardData: dataTransfer  // 包含图片文件
});
targetElement.dispatchEvent(pasteEvent);
```

---

## 📋 TODO / 未来改进

- [ ] 支持多账号切换
- [ ] 更智能的防封策略 (随机间隔、模拟人类行为)
- [ ] 群组黑名单 (避免重复发送)
- [ ] 发送结果统计报表
- [ ] 定时任务 (OpenClaw cron)
- [ ] 支持更多消息类型 (视频、文件)

---

## 🚀 快速使用

### Boss 告诉我运行 Campaign

```
Boss: 运行一个 Campaign
关键词: beautiful girls, sexy photos
广告: 🔥 每日更新！👉 https://example.com
最多加入 10 个群
```

### 我会执行

1. 启动 OpenClaw 浏览器 (如果没启动)
2. 打开 Telegram Web (如果没打开)
3. 依次搜索关键词
4. 加入找到的群 (最多 10 个)
5. 发送广告消息
6. 报告结果

---

*最后更新: 2026-02-17 by Fancy ☀️*
