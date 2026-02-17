# 📣 TG Marketing

Telegram 群组营销自动化工具 - Chrome Extension + AI 自动化 + 智能防封

## ✨ 功能特性

### 📋 Campaign 管理系统
- 创建、编辑、删除营销活动
- 多关键词搜索群组
- 自定义广告内容 (支持 Emoji)
- 附带图片发送
- 可配置发送间隔和最大群数
- 实时进度追踪和统计

### 🛡️ 智能防封系统 (v2.1.0)
- **随机延迟**: 45-90秒发送间隔 + ±20% 随机偏移
- **模拟打字**: 50-150ms/字符，有打字节奏
- **打错字重打**: 2% 概率打错再删除 (更像真人)
- **思考停顿**: 10% 概率暂停思考
- **随机跳过**: 10% 概率跳过某个群
- **打乱顺序**: 不按固定顺序处理
- **自动休息**: 5-10 操作后休息 30秒-2分钟
- **速率限制**: 每小时最多 30 次操作

### 🤖 AI 自动化 (OpenClaw)
- 完全自主执行 Campaign
- 无需人工干预
- 智能错误处理

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
3. 在「➕ 新建」标签页创建 Campaign:
   - 填写活动名称
   - 输入搜索关键词 (每行一个)
   - 编写广告内容
   - (可选) 上传图片
   - 配置发送设置
4. 点击「🚀 保存并启动」

### 方式二：AI 自动化 (OpenClaw)

如果你使用 [OpenClaw](https://openclaw.ai)，AI 助手可以完全自主执行：

```
告诉 AI: "运行 Campaign，关键词 beautiful girls, 广告内容 xxx"
```

AI 会自动：
- 启动浏览器
- 打开 Telegram Web
- 执行搜索 → 加入 → 发送
- 智能防封 (随机延迟、模拟人类行为)
- 报告结果

## 📁 项目结构

```
tg-group-bot/
├── manifest.json        # Extension 配置
├── popup.html/css/js    # 弹出界面
├── campaign.js          # Campaign 管理逻辑
├── human-behavior.js    # 人类行为模拟 (防封)
├── content.js           # 注入 Telegram Web 的脚本
├── background.js        # Service Worker
├── updater.js           # 自动更新
├── CLAUDE.md            # AI 工作笔记 (详细技术文档)
└── icons/               # 图标
```

## ⚠️ 注意事项

- **频率限制**: Telegram 对频繁操作有限制，智能防封系统已自动处理
- **账号安全**: 过度营销可能导致账号被限制，建议每日适量使用
- **内容合规**: 请遵守 Telegram 使用条款

## 📖 技术文档

详细的技术实现、代码说明和 AI 集成指南，请查看 [CLAUDE.md](./CLAUDE.md)

## 🔄 更新日志

### v2.1.0 (2026-02-17)
- 🛡️ 智能防封系统
- 模拟人类打字、随机延迟、自动休息
- 打错字重打、随机跳过、打乱顺序

### v2.0.0 (2026-02-17)
- 🎉 全新 Campaign 管理系统
- 📋 活动创建、编辑、删除
- 🖼️ 图片上传支持
- 📊 实时进度和统计

### v1.1.0 (2026-02-17)
- 基础功能：搜索、加入、发送
- 群组列表管理
- 自动更新检查

## 📄 License

MIT
