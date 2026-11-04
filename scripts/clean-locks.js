const fs = require('fs');
const path = require('path');

/**
 * Automatically cleans up stale Chromium lock/socket symlinks from storage/browser-profile
 * Prevents Turbopack from crashing with "could not be resolved because a component does not exist"
 */
function cleanStaleLocks() {
  const storageDir = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  const profileDir = path.join(storageDir, 'browser-profile');

  if (!fs.existsSync(profileDir)) return;

  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'RunningChromeVersion'];
  for (const file of lockFiles) {
    const filePath = path.join(profileDir, file);
    try {
      if (fs.lstatSync(filePath).isSymbolicLink() || fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[clean-locks] Removed stale Chromium symlink: ${file}`);
      }
    } catch {}
  }

  // Also clean any dangling symlinks recursively in browser-profile
  try {
    const items = fs.readdirSync(profileDir);
    for (const item of items) {
      const fullPath = path.join(profileDir, item);
      try {
        if (fs.lstatSync(fullPath).isSymbolicLink() && !fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`[clean-locks] Removed broken symlink: ${item}`);
        }
      } catch {}
    }
  } catch {}
}

cleanStaleLocks();

