# 📣 TG Marketing

Telegram 群组营销自动化工具 - Chrome Extension + AI 自动化

## ✨ 功能

### Campaign 管理系统
- 📋 创建、编辑、删除营销活动
- 🔑 多关键词搜索群组
- 💬 自定义广告内容 (支持 Emoji)
- 🖼️ 附带图片发送
- ⚙️ 可配置发送间隔和最大群数
- 📊 实时进度追踪和统计

### 自动化执行
- 🔍 **搜索**: 按关键词搜索相关群组
- 🚪 **加入**: 自动加入找到的群
- 💬 **发送**: 批量发送广告消息
- ⏸️ **控制**: 暂停/继续/停止

## 📥 安装

1. 下载 [最新 Release](https://github.com/haohappy/tg-group-bot/releases/latest)
2. 解压 zip 文件
3. 打开 Chrome，进入 `chrome://extensions`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择解压后的文件夹

## 🚀 使用方法

### 方式一：手动操作 Extension

1. 打开 [Telegram Web](https://web.telegram.org/k/)
2. 点击浏览器工具栏的 Extension 图标
3. 在「新建」标签页创建 Campaign
4. 点击「保存并启动」

### 方式二：AI 自动化 (OpenClaw)

如果你使用 [OpenClaw](https://openclaw.ai)，AI 助手可以完全自主执行：

```
告诉 AI: "运行 Campaign，关键词 xxx，广告内容 xxx"
```

AI 会自动：
- 启动浏览器
- 打开 Telegram Web
- 执行搜索 → 加入 → 发送
- 报告结果

## 📁 项目结构

```
tg-group-bot/
├── manifest.json      # Extension 配置
├── popup.html/css/js  # 弹出界面
├── campaign.js        # Campaign 管理逻辑
├── content.js         # 注入 Telegram Web 的脚本
├── background.js      # Service Worker
├── updater.js         # 自动更新
├── CLAUDE.md          # AI 工作笔记 (详细技术文档)
└── icons/             # 图标
```

## ⚠️ 注意事项

- **频率限制**: Telegram 对频繁操作有限制，建议发送间隔 60 秒以上
- **账号安全**: 过度营销可能导致账号被限制
- **内容合规**: 请遵守 Telegram 使用条款

## 📖 技术文档

详细的技术实现和代码说明，请查看 [CLAUDE.md](./CLAUDE.md)

## 🔄 更新日志

### v2.0.0 (2026-02-17)
- 🎉 全新 Campaign 管理系统
- 📋 活动创建、编辑、删除
- 🖼️ 图片上传支持
- 📊 实时进度和统计
- ⏸️ 暂停/继续/停止控制

### v1.1.0
- 基础功能：搜索、加入、发送
- 群组列表管理
- 自动更新检查

## 📄 License

MIT
