const fs = require('fs');
const path = require('path');

/**
 * Automatically cleans up stale Chromium lock/socket symlinks from storage directories
 * (browser-profile, tiktok-user-data, etc.)
 * Prevents Turbopack from crashing with "could not be resolved because a component does not exist"
 */
function cleanDirectoryLocks(targetDir) {
  if (!fs.existsSync(targetDir)) return;

  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'RunningChromeVersion'];
  for (const file of lockFiles) {
    const filePath = path.join(targetDir, file);
    try {
      if (fs.lstatSync(filePath).isSymbolicLink() || fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[clean-locks] Removed stale Chromium symlink: ${file} from ${path.basename(targetDir)}`);
      }
    } catch {}
  }

  // Also clean any dangling symlinks recursively in targetDir
  try {
    const items = fs.readdirSync(targetDir);
    for (const item of items) {
      const fullPath = path.join(targetDir, item);
      try {
        if (fs.lstatSync(fullPath).isSymbolicLink() && !fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`[clean-locks] Removed broken symlink: ${item} from ${path.basename(targetDir)}`);
        }
      } catch {}
    }
  } catch {}
}

function cleanStaleLocks() {
  const storageDir = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  if (!fs.existsSync(storageDir)) return;

  cleanDirectoryLocks(path.join(storageDir, 'browser-profile'));
  cleanDirectoryLocks(path.join(storageDir, 'tiktok-user-data'));

  // Scan any other user data directories in storage
  try {
    const subs = fs.readdirSync(storageDir);
    for (const sub of subs) {
      if (sub !== 'browser-profile' && sub !== 'tiktok-user-data') {
        const subPath = path.join(storageDir, sub);
        try {
          if (fs.statSync(subPath).isDirectory()) {
            cleanDirectoryLocks(subPath);
          }
        } catch {}
      }
    }
  } catch {}
}

cleanStaleLocks();

