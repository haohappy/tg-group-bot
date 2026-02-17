// TG Group Bot - Auto Updater
// Checks GitHub for new releases and prompts user to update

const GITHUB_REPO = 'haohappy/tg-group-bot';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_COMMITS_API = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;

class Updater {
  constructor() {
    this.currentVersion = chrome.runtime.getManifest().version;
  }

  // Check for updates via GitHub API
  async checkForUpdates() {
    try {
      // First try releases
      let response = await fetch(GITHUB_API);
      
      if (response.ok) {
        const release = await response.json();
        const latestVersion = release.tag_name.replace(/^v/, '');
        
        if (this.isNewerVersion(latestVersion, this.currentVersion)) {
          return {
            hasUpdate: true,
            currentVersion: this.currentVersion,
            latestVersion: latestVersion,
            downloadUrl: release.zipball_url,
            releaseUrl: release.html_url,
            releaseNotes: release.body,
            publishedAt: release.published_at
          };
        }
      }
      
      // Fallback: check commits for updates (compare by date)
      response = await fetch(GITHUB_COMMITS_API);
      if (response.ok) {
        const commit = await response.json();
        const lastCheck = await this.getLastCheckTime();
        const commitDate = new Date(commit.commit.committer.date).getTime();
        
        if (commitDate > lastCheck) {
          return {
            hasUpdate: true,
            currentVersion: this.currentVersion,
            latestVersion: `${this.currentVersion}+`,
            downloadUrl: `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`,
            releaseUrl: `https://github.com/${GITHUB_REPO}`,
            releaseNotes: `Latest commit: ${commit.commit.message}`,
            publishedAt: commit.commit.committer.date,
            isCommitUpdate: true
          };
        }
      }
      
      return { hasUpdate: false, currentVersion: this.currentVersion };
      
    } catch (error) {
      console.error('Update check failed:', error);
      return { hasUpdate: false, error: error.message };
    }
  }

  // Compare semantic versions
  isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  // Get last update check time
  async getLastCheckTime() {
    const data = await chrome.storage.local.get('lastUpdateCheck');
    return data.lastUpdateCheck || 0;
  }

  // Save current time as last check
  async saveCheckTime() {
    await chrome.storage.local.set({ lastUpdateCheck: Date.now() });
  }

  // Download update
  async downloadUpdate(url) {
    try {
      // Use Chrome downloads API
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: 'tg-group-bot-update.zip',
        saveAs: true
      });
      return { success: true, downloadId };
    } catch (error) {
      // Fallback: open in new tab
      window.open(url, '_blank');
      return { success: true, method: 'tab' };
    }
  }

  // Mark update as installed (user confirms after manual install)
  async markAsInstalled() {
    await this.saveCheckTime();
  }
}

// Export for use in popup
window.Updater = Updater;
