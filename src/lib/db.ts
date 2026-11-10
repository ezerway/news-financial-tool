import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const storageDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage');
if (!fs.existsSync(/*turbopackIgnore: true*/ storageDir)) {
  try {
    fs.mkdirSync(/*turbopackIgnore: true*/ storageDir, { recursive: true });
  } catch {}
}

export const dbPath = path.join(/*turbopackIgnore: true*/ storageDir, 'app.db');

export function initSchema(database: Database.Database) {
  // Set busy timeout to prevent concurrency lock errors on multi-process / external drive
  try {
    database.pragma('busy_timeout = 30000');
  } catch {}

  // Check current journal mode; avoid redundant/locking switches
  try {
    const currentMode = String(database.pragma('journal_mode', { simple: true }) || '').toLowerCase();
    if (currentMode !== 'truncate' && currentMode !== 'delete') {
      try {
        database.pragma('journal_mode = TRUNCATE');
      } catch {
        try {
          database.pragma('journal_mode = DELETE');
        } catch {
          // If locked by another connection, keep current journal mode
        }
      }
    }
  } catch {
    // If pragma journal_mode check fails due to lock, safely ignore
  }

  try {
    database.pragma('synchronous = NORMAL');
  } catch {}

  // Initialize schema
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS trends (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        geo TEXT NOT NULL DEFAULT 'VN',
        approx_traffic TEXT,
        pub_date TEXT,
        articles_json TEXT,
        category TEXT DEFAULT 'general',
        status TEXT DEFAULT 'discovered',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        trend_id TEXT,
        trend_title TEXT NOT NULL,
        post_content TEXT NOT NULL,
        comment_content TEXT NOT NULL,
        source_urls TEXT,
        status TEXT DEFAULT 'draft',
        fb_post_url TEXT,
        fb_post_id TEXT,
        comment_id TEXT,
        error_message TEXT,
        screenshot_path TEXT,
        video_path TEXT,
        scheduled_at DATETIME,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(trend_id) REFERENCES trends(id)
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        action TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reels (
        id TEXT PRIMARY KEY,
        video_path TEXT NOT NULL,
        video_filename TEXT,
        caption TEXT,
        status TEXT DEFAULT 'draft',
        scheduled_at DATETIME,
        published_at DATETIME,
        fb_post_url TEXT,
        tiktok_post_url TEXT,
        tiktok_status TEXT DEFAULT 'idle',
        tiktok_error_message TEXT,
        tiktok_debug_video_path TEXT,
        tiktok_screenshot_path TEXT,
        screenshot_path TEXT,
        debug_video_path TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reels_status_scheduled ON reels(status, scheduled_at);
    `);
  } catch (err: any) {
    if (!err.message?.includes('already exists')) {
      console.warn('Database schema exec notice:', err.message);
    }
  }

  // Safe migration for video_path, fb_post_url, screenshot_path, debug_video_path if tables already exist
  try {
    database.exec(`ALTER TABLE posts ADD COLUMN video_path TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN fb_post_url TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN screenshot_path TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN debug_video_path TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN tiktok_post_url TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN tiktok_status TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN tiktok_error_message TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN tiktok_debug_video_path TEXT`);
  } catch {}
  try {
    database.exec(`ALTER TABLE reels ADD COLUMN tiktok_screenshot_path TEXT`);
  } catch {}

  // Insert default settings if not exists
  try {
    const defaultSettings: Record<string, string> = {
      gemini_api_key: process.env.GEMINI_API_KEY || '',
      target_geo: 'VN',
      post_tone: 'finance_news', // finance_news, viral_engaging, concise
      auto_mode: 'false',
      developer_mode: 'false',
      tiktok_auto_post: 'true',
      browser_notify_enabled: 'true',
      telegram_notify_enabled: 'false',
      telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID || '',
      slack_notify_enabled: 'false',
      slack_webhook_url: process.env.SLACK_WEBHOOK_URL || '',
      notify_on_success: 'true',
      notify_on_failure: 'true',
      fb_target_url: 'https://www.facebook.com/',
      crawler_interval_minutes: '60',
      filter_keywords: 'tài chính, chứng khoán, ngân hàng, bất động sản, kinh tế, crypto, usd, vàng, lạm phát',
      posts_per_cycle: '1',
    };

    const insertSettingStmt = database.prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
    `);

    for (const [key, value] of Object.entries(defaultSettings)) {
      insertSettingStmt.run(key, value);
    }
  } catch {}

  // Tự động kiểm tra và đồng bộ trạng thái xu hướng không hợp lệ
  try {
    repairInconsistentTrendStatuses(database);
  } catch {}
}

export function repairInconsistentTrendStatuses(database: Database.Database) {
  try {
    // Tìm các xu hướng bị đánh dấu là 'published' nhưng thực tế chưa có link nguồn báo chí hợp lệ
    const publishedTrends = database.prepare(`
      SELECT id, title, articles_json FROM trends 
      WHERE status = 'published'
    `).all() as { id: string; title: string; articles_json?: string }[];

    let fixedCount = 0;
    for (const t of publishedTrends) {
      let hasValidSources = false;
      try {
        const parsed = JSON.parse(t.articles_json || '[]');
        hasValidSources = Array.isArray(parsed) && parsed.some((a: any) => a.url && !a.url.includes('google.com'));
      } catch {}

      if (!hasValidSources) {
        database.prepare(`UPDATE trends SET status = 'discovered' WHERE id = ?`).run(t.id);
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      console.log(`[DB Auto-Repair] Đã phát hiện và sửa trạng thái cho ${fixedCount} xu hướng chưa có source link nhưng bị báo là 'published'.`);
    }
  } catch (err: any) {
    console.error('Error repairing inconsistent trend statuses:', err.message);
  }
}

function isBuildPhase(): boolean {
  return Boolean(
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build' ||
    (typeof process !== 'undefined' &&
      Array.isArray(process.argv) &&
      process.argv.some((a) => a.includes('build')))
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __trendpulse_db: Database.Database | undefined;
}

function createDatabaseConnection(): Database.Database {
  if (globalThis.__trendpulse_db && globalThis.__trendpulse_db.open) {
    return globalThis.__trendpulse_db;
  }

  // During Next.js build, route configs are collected statically.
  // Using in-memory avoids file locking issues with running daemons on VPS.
  if (isBuildPhase()) {
    try {
      const memDb = new Database(':memory:');
      initSchema(memDb);
      globalThis.__trendpulse_db = memDb;
      return memDb;
    } catch {
      const fallbackDb = new Database(':memory:');
      globalThis.__trendpulse_db = fallbackDb;
      return fallbackDb;
    }
  }

  try {
    const db = new Database(dbPath, { timeout: 30000 });
    initSchema(db);
    globalThis.__trendpulse_db = db;
    return db;
  } catch (err: any) {
    console.error('Lỗi khi mở SQLite database:', err.message);

    // If database is locked (SQLITE_BUSY) during Next.js worker evaluation
    if (err.code === 'SQLITE_BUSY' || err.message?.includes('database is locked')) {
      console.warn('SQLite database is locked, using in-memory fallback for current worker/process.');
      try {
        const memDb = new Database(':memory:');
        initSchema(memDb);
        globalThis.__trendpulse_db = memDb;
        return memDb;
      } catch {
        const fallbackDb = new Database(':memory:');
        globalThis.__trendpulse_db = fallbackDb;
        return fallbackDb;
      }
    }

    // If corrupted or malformed (WAL/SHM desync on external drive)
    if (err.message?.includes('malformed') || err.message?.includes('corrupt')) {
      console.warn('Phát hiện SQLite database malformed, đang tự động phục hồi...');

      const walFile = path.join(/*turbopackIgnore: true*/ storageDir, 'app.db-wal');
      const shmFile = path.join(/*turbopackIgnore: true*/ storageDir, 'app.db-shm');

      // 1. Remove stale WAL & SHM files
      if (fs.existsSync(/*turbopackIgnore: true*/ walFile)) {
        try { fs.unlinkSync(/*turbopackIgnore: true*/ walFile); } catch {}
      }
      if (fs.existsSync(/*turbopackIgnore: true*/ shmFile)) {
        try { fs.unlinkSync(/*turbopackIgnore: true*/ shmFile); } catch {}
      }

      // 2. Try reopening
      try {
        const retryDb = new Database(dbPath, { timeout: 30000 });
        const check = retryDb.pragma('integrity_check') as any[];
        if (check?.[0]?.integrity_check === 'ok') {
          console.log('Phục hồi thành công sau khi dọn dẹp WAL/SHM!');
          initSchema(retryDb);
          globalThis.__trendpulse_db = retryDb;
          return retryDb;
        }
      } catch (retryErr: any) {
        console.error('Thử lại sau khi xóa WAL/SHM thất bại:', retryErr.message);
      }

      // 3. If still malformed, preserve backup of corrupted db and create fresh database
      const corruptBackup = path.join(/*turbopackIgnore: true*/ storageDir, `app_corrupted_${Date.now()}.db`);
      try {
        fs.renameSync(dbPath, corruptBackup);
        console.warn(`Đã lưu bản sao database hỏng tại: ${corruptBackup}`);
      } catch {}

      const freshDb = new Database(dbPath, { timeout: 30000 });
      initSchema(freshDb);
      globalThis.__trendpulse_db = freshDb;
      return freshDb;
    }

    throw err;
  }
}

let activeDb: Database.Database = createDatabaseConnection();

export function checkpointDb(): void {
  try {
    activeDb.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.error('Error checkpointing WAL:', err);
  }
}

export function reloadDb(): void {
  try {
    if (activeDb && activeDb.open) {
      activeDb.close();
    }
  } catch (err) {
    console.error('Error closing active db:', err);
  }
  globalThis.__trendpulse_db = undefined;
  activeDb = createDatabaseConnection();
}

export async function backupDb(destPath: string): Promise<void> {
  checkpointDb();
  await activeDb.backup(destPath);
}

const db = new Proxy({} as Database.Database, {
  get(target, prop) {
    const val = (activeDb as any)[prop];
    return typeof val === 'function' ? val.bind(activeDb) : val;
  },
  set(target, prop, value) {
    (activeDb as any)[prop] = value;
    return true;
  },
});

export function logActivity(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', action: string, message: string, details?: unknown) {
  const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const detailsJson = details ? JSON.stringify(details) : null;
  db.prepare(`
    INSERT INTO activity_logs (id, level, action, message, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, level, action, message, detailsJson);
  console.log(`[${level}] [${action}] ${message}`);
  return id;
}

export function getSetting(key: string, defaultValue = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function isDeveloperMode(): boolean {
  try {
    return getSetting('developer_mode', 'false') === 'true';
  } catch {
    return false;
  }
}

export function resolveHeadless(preferredHeadless = true): boolean {
  if (isDeveloperMode()) {
    return false;
  }
  return preferredHeadless;
}

export function isTikTokAutoPostEnabled(): boolean {
  try {
    return getSetting('tiktok_auto_post', 'true') === 'true';
  } catch {
    return true;
  }
}

export default db;

