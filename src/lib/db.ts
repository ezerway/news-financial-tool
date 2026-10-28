import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const storageDir = path.join(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

export const dbPath = path.join(storageDir, 'app.db');

export function initSchema(database: Database.Database) {
  // Enable WAL mode for high concurrency & performance
  database.pragma('journal_mode = WAL');

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
  `);

  // Insert default settings if not exists
  const defaultSettings: Record<string, string> = {
    gemini_api_key: process.env.GEMINI_API_KEY || '',
    target_geo: 'VN',
    post_tone: 'finance_news', // finance_news, viral_engaging, concise
    auto_mode: 'false',
    fb_target_url: 'https://www.facebook.com/',
    crawler_interval_minutes: '60',
    filter_keywords: 'tài chính, chứng khoán, ngân hàng, bất động sản, kinh tế, crypto, usd, vàng, lạm phát',
  };

  const insertSettingStmt = database.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSettingStmt.run(key, value);
  }
}

let activeDb: Database.Database = new Database(dbPath);
initSchema(activeDb);

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
  activeDb = new Database(dbPath);
  initSchema(activeDb);
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

