import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const storageDir = path.join(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

export const dbPath = path.join(storageDir, 'app.db');

export function initSchema(database: Database.Database) {
  // Set busy timeout to prevent concurrency lock errors on multi-process / external drive
  database.pragma('busy_timeout = 10000');
  // Use TRUNCATE or DELETE journal mode to avoid mmap / POSIX shm corruption and disk I/O errors on external / FAT / exFAT drives
  try {
    database.pragma('journal_mode = TRUNCATE');
  } catch {
    database.pragma('journal_mode = DELETE');
  }
  database.pragma('synchronous = NORMAL');

  // Initialize schema
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
      screenshot_path TEXT,
      debug_video_path TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reels_status_scheduled ON reels(status, scheduled_at);
  `);

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

  // Insert default settings if not exists
  const defaultSettings: Record<string, string> = {
    gemini_api_key: process.env.GEMINI_API_KEY || '',
    target_geo: 'VN',
    post_tone: 'finance_news', // finance_news, viral_engaging, concise
    auto_mode: 'false',
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

  // Tự động kiểm tra và đồng bộ trạng thái xu hướng không hợp lệ
  repairInconsistentTrendStatuses(database);
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

function createDatabaseConnection(): Database.Database {
  try {
    const db = new Database(dbPath, { timeout: 10000 });
    initSchema(db);
    return db;
  } catch (err: any) {
    console.error('Lỗi khi mở SQLite database:', err.message);

    // If corrupted or malformed (WAL/SHM desync on external drive)
    if (err.message?.includes('malformed') || err.message?.includes('corrupt')) {
      console.warn('Phát hiện SQLite database malformed, đang tự động phục hồi...');

      const walFile = path.join(storageDir, 'app.db-wal');
      const shmFile = path.join(storageDir, 'app.db-shm');

      // 1. Remove stale WAL & SHM files
      if (fs.existsSync(walFile)) {
        try { fs.unlinkSync(walFile); } catch {}
      }
      if (fs.existsSync(shmFile)) {
        try { fs.unlinkSync(shmFile); } catch {}
      }

      // 2. Try reopening
      try {
        const retryDb = new Database(dbPath, { timeout: 10000 });
        const check = retryDb.pragma('integrity_check') as any[];
        if (check?.[0]?.integrity_check === 'ok') {
          console.log('Phục hồi thành công sau khi dọn dẹp WAL/SHM!');
          initSchema(retryDb);
          return retryDb;
        }
      } catch (retryErr: any) {
        console.error('Thử lại sau khi xóa WAL/SHM thất bại:', retryErr.message);
      }

      // 3. If still malformed, preserve backup of corrupted db and create fresh database
      const corruptBackup = path.join(storageDir, `app_corrupted_${Date.now()}.db`);
      try {
        fs.renameSync(dbPath, corruptBackup);
        console.warn(`Đã lưu bản sao database hỏng tại: ${corruptBackup}`);
      } catch {}

      const freshDb = new Database(dbPath, { timeout: 10000 });
      initSchema(freshDb);
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

export default db;

