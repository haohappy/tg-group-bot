# TG Group Bot 🤖

A Chrome extension for Telegram group marketing. Search for groups, join them, and send promotional messages - all from a convenient popup interface.

## Features

- 🔍 **Search Groups** - Find Telegram groups by keyword
- 📋 **Save Groups** - Build a list of target groups
- ➕ **Auto Join** - Join groups with one click
- 💬 **Send Messages** - Broadcast messages to multiple groups
- ⏱️ **Rate Limiting** - Configurable delay between messages

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/haohappy/tg-group-bot.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked** and select the `tg-group-bot` folder

5. The extension icon will appear in your toolbar

## Usage

1. Open [Telegram Web](https://web.telegram.org/k/) and log in

2. Click the TG Group Bot extension icon

3. **Search Tab**: Enter keywords to find groups
   - Click "保存" to add groups to your list

4. **Groups Tab**: View saved groups
   - Click "加入" to join a group
   - Click "删除" to remove from list

5. **Message Tab**: Send messages to joined groups
   - Enter your message
   - Set the interval between messages (default: 30 seconds)
   - Click "开始发送" to start broadcasting

## ⚠️ Disclaimer

This tool is for educational purposes. Using automation for spam or unsolicited marketing may violate Telegram's Terms of Service and could result in account suspension. Use responsibly.

## Development

```bash
# Install dependencies (only needed for icon generation)
npm install

# The extension itself requires no build step
# Just load the folder in Chrome as an unpacked extension
```

## Files

```
tg-group-bot/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic
├── content.js         # Telegram Web interaction
├── content.css        # Content styles
├── background.js      # Service worker
└── icons/             # Extension icons
```

## License

MIT
