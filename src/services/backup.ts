import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import db, { dbPath, reloadDb, checkpointDb, logActivity, backupDb } from '@/lib/db';
import { checkFacebookLoginStatus } from './playwright/session';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const DB_FILE = dbPath;
const SESSION_FILE = path.join(STORAGE_DIR, 'fb-session.json');
const PROFILE_DIR = path.join(STORAGE_DIR, 'browser-profile');

export interface BackupStats {
  db: {
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    trendsCount: number;
    postsCount: number;
    logsCount: number;
    settingsCount: number;
  };
  profile: {
    sessionExists: boolean;
    sessionSizeBytes: number;
    sessionSizeFormatted: string;
    profileDirExists: boolean;
    cUser?: string;
    fbStatus: {
      loggedIn: boolean;
      username?: string;
      message: string;
    };
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function getBackupStats(): Promise<BackupStats> {
  // DB stats
  checkpointDb();
  let dbExists = fs.existsSync(DB_FILE);
  let dbSize = 0;
  if (dbExists) {
    try {
      dbSize = fs.statSync(DB_FILE).size;
    } catch {}
  }

  let trendsCount = 0;
  let postsCount = 0;
  let logsCount = 0;
  let settingsCount = 0;

  try {
    trendsCount = (db.prepare('SELECT COUNT(*) as count FROM trends').get() as any)?.count || 0;
    postsCount = (db.prepare('SELECT COUNT(*) as count FROM posts').get() as any)?.count || 0;
    logsCount = (db.prepare('SELECT COUNT(*) as count FROM activity_logs').get() as any)?.count || 0;
    settingsCount = (db.prepare('SELECT COUNT(*) as count FROM settings').get() as any)?.count || 0;
  } catch (err) {
    console.error('Error counting DB tables:', err);
  }

  // Profile stats
  const sessionExists = fs.existsSync(SESSION_FILE);
  let sessionSize = 0;
  let cUser: string | undefined;

  if (sessionExists) {
    try {
      sessionSize = fs.statSync(SESSION_FILE).size;
      const content = fs.readFileSync(SESSION_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const cookies = parsed.cookies || [];
      const found = cookies.find((c: any) => c.name === 'c_user');
      if (found) cUser = found.value;
    } catch {}
  }

  const profileDirExists = fs.existsSync(PROFILE_DIR);
  const fbStatus = await checkFacebookLoginStatus();

  return {
    db: {
      exists: dbExists,
      sizeBytes: dbSize,
      sizeFormatted: formatBytes(dbSize),
      trendsCount,
      postsCount,
      logsCount,
      settingsCount,
    },
    profile: {
      sessionExists,
      sessionSizeBytes: sessionSize,
      sessionSizeFormatted: formatBytes(sessionSize),
      profileDirExists,
      cUser,
      fbStatus: {
        loggedIn: fbStatus.loggedIn,
        username: fbStatus.username,
        message: fbStatus.message,
      },
    },
  };
}

/**
 * Export SQLite database file as Buffer using safe SQLite backup API
 */
export async function exportDbSqlite(): Promise<Buffer> {
  const tempBackupPath = path.join(STORAGE_DIR, `temp_backup_${Date.now()}.db`);
  try {
    await backupDb(tempBackupPath);
    const buffer = fs.readFileSync(tempBackupPath);
    return buffer;
  } finally {
    if (fs.existsSync(tempBackupPath)) {
      try {
        fs.unlinkSync(tempBackupPath);
      } catch {}
    }
  }
}

/**
 * Export database contents as structured JSON
 */
export function exportDbJson(): string {
  checkpointDb();
  const trends = db.prepare('SELECT * FROM trends').all();
  const posts = db.prepare('SELECT * FROM posts').all();
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 500').all();
  const settings = db.prepare('SELECT * FROM settings').all();

  const data = {
    app: 'TrendPulse',
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    counts: {
      trends: trends.length,
      posts: posts.length,
      logs: logs.length,
      settings: settings.length,
    },
    trends,
    posts,
    logs,
    settings,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Import and replace SQLite database from Buffer
 */
export async function importDbSqlite(fileBuffer: Buffer): Promise<{ success: boolean; message: string; counts?: any }> {
  // Validate SQLite header: first 16 bytes must be "SQLite format 3\0"
  const header = fileBuffer.slice(0, 16).toString('utf-8');
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('Tập tin không phải là cơ sở dữ liệu SQLite hợp lệ!');
  }

  // Backup current DB before overwrite
  const backupBak = path.join(STORAGE_DIR, `app.db.bak`);
  try {
    checkpointDb();
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, backupBak);
    }
  } catch (err) {
    console.warn('Could not create backup of previous DB:', err);
  }

  // Temporary file to test opening with better-sqlite3
  const tempPath = path.join(STORAGE_DIR, `temp_import_${Date.now()}.db`);
  try {
    fs.writeFileSync(tempPath, fileBuffer);
    const Database = (await import('better-sqlite3')).default;
    const testDb = new Database(tempPath, { readonly: true });
    // Check if trends and posts tables exist
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
    testDb.close();

    const requiredTables = ['trends', 'posts'];
    const missing = requiredTables.filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      throw new Error(`Cơ sở dữ liệu thiếu các bảng cần thiết: ${missing.join(', ')}`);
    }

    // Close active db, remove WAL/SHM, replace app.db
    const walFile = path.join(STORAGE_DIR, 'app.db-wal');
    const shmFile = path.join(STORAGE_DIR, 'app.db-shm');
    if (fs.existsSync(walFile)) try { fs.unlinkSync(walFile); } catch {}
    if (fs.existsSync(shmFile)) try { fs.unlinkSync(shmFile); } catch {}

    fs.copyFileSync(tempPath, DB_FILE);
    reloadDb();

    const counts = {
      trends: (db.prepare('SELECT COUNT(*) as c FROM trends').get() as any)?.c || 0,
      posts: (db.prepare('SELECT COUNT(*) as c FROM posts').get() as any)?.c || 0,
    };

    logActivity('SUCCESS', 'BACKUP', `Đã khôi phục cơ sở dữ liệu thành công từ file SQLite (${counts.posts} bài viết, ${counts.trends} xu hướng)`);
    return {
      success: true,
      message: `Khôi phục thành công! Đã nạp ${counts.posts} bài viết và ${counts.trends} xu hướng.`,
      counts,
    };
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

/**
 * Import database from JSON dump
 */
export async function importDbJson(jsonData: any): Promise<{ success: boolean; message: string; counts?: any }> {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Dữ liệu JSON không hợp lệ!');
  }

  let trendsCount = 0;
  let postsCount = 0;

  const insertTrend = db.prepare(`
    INSERT OR REPLACE INTO trends (id, title, geo, approx_traffic, pub_date, articles_json, category, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `);

  const insertPost = db.prepare(`
    INSERT OR REPLACE INTO posts (id, trend_id, trend_title, post_content, comment_content, source_urls, status, fb_post_url, fb_post_id, comment_id, error_message, screenshot_path, scheduled_at, published_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `);

  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO activity_logs (id, level, action, message, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `);

  const runImport = db.transaction(() => {
    if (Array.isArray(jsonData.trends)) {
      for (const t of jsonData.trends) {
        insertTrend.run(
          t.id || 'trend_' + Date.now() + Math.random().toString(36).substring(2, 5),
          t.title,
          t.geo || 'VN',
          t.approx_traffic || null,
          t.pub_date || null,
          typeof t.articles_json === 'string' ? t.articles_json : JSON.stringify(t.articles_json || []),
          t.category || 'general',
          t.status || 'discovered',
          t.created_at || null
        );
        trendsCount++;
      }
    }

    if (Array.isArray(jsonData.posts)) {
      for (const p of jsonData.posts) {
        insertPost.run(
          p.id || 'post_' + Date.now() + Math.random().toString(36).substring(2, 5),
          p.trend_id || null,
          p.trend_title || '',
          p.post_content || '',
          p.comment_content || '',
          typeof p.source_urls === 'string' ? p.source_urls : JSON.stringify(p.source_urls || []),
          p.status || 'draft',
          p.fb_post_url || null,
          p.fb_post_id || null,
          p.comment_id || null,
          p.error_message || null,
          p.screenshot_path || null,
          p.scheduled_at || null,
          p.published_at || null,
          p.created_at || null
        );
        postsCount++;
      }
    }

    if (Array.isArray(jsonData.settings)) {
      for (const s of jsonData.settings) {
        if (s.key && s.value !== undefined) {
          insertSetting.run(s.key, String(s.value));
        }
      }
    }

    if (Array.isArray(jsonData.logs)) {
      for (const l of jsonData.logs) {
        insertLog.run(
          l.id || 'log_' + Date.now(),
          l.level || 'INFO',
          l.action || 'IMPORT',
          l.message || '',
          typeof l.details_json === 'string' ? l.details_json : JSON.stringify(l.details_json || null),
          l.created_at || null
        );
      }
    }
  });

  runImport();

  logActivity('SUCCESS', 'BACKUP', `Đã nhập dữ liệu JSON: ${postsCount} bài viết, ${trendsCount} xu hướng.`);
  return {
    success: true,
    message: `Đã nhập thành công ${postsCount} bài viết và ${trendsCount} xu hướng!`,
    counts: { trends: trendsCount, posts: postsCount },
  };
}

/**
 * Export Facebook Session (Playwright storage state JSON)
 */
export function exportProfileSession(): { exists: boolean; data?: string; buffer?: Buffer } {
  if (!fs.existsSync(SESSION_FILE)) {
    return { exists: false };
  }
  const content = fs.readFileSync(SESSION_FILE, 'utf-8');
  return {
    exists: true,
    data: content,
    buffer: Buffer.from(content, 'utf-8'),
  };
}

/**
 * Export Profile ZIP (includes fb-session.json and browser-profile, skipping bulky caches)
 */
export async function exportProfileZip(): Promise<Buffer> {
  const zip = new AdmZip();

  // Add fb-session.json if exists
  if (fs.existsSync(SESSION_FILE)) {
    zip.addLocalFile(SESSION_FILE, '', 'fb-session.json');
  }

  // Add browser-profile directory if exists (filtering out bulky Cache)
  if (fs.existsSync(PROFILE_DIR)) {
    const skipNames = new Set([
      'Cache',
      'Code Cache',
      'GPUCache',
      'DawnCache',
      'GraphiteDawnCache',
      'DawnWebGPUCache',
      'DawnGraphiteCache',
      'OptimizationGuidePredictionModels',
    ]);

    function addDirRecursive(dirPath: string, zipPath: string) {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (skipNames.has(item.name)) continue;
        const fullPath = path.join(dirPath, item.name);
        const nextZipPath = zipPath ? `${zipPath}/${item.name}` : item.name;

        if (item.isDirectory()) {
          addDirRecursive(fullPath, nextZipPath);
        } else {
          try {
            const fileBuf = fs.readFileSync(fullPath);
            zip.addFile(`browser-profile/${nextZipPath}`, fileBuf);
          } catch {}
        }
      }
    }

    try {
      addDirRecursive(PROFILE_DIR, '');
    } catch (err) {
      console.warn('Error archiving browser-profile:', err);
    }
  }

  return zip.toBuffer();
}

/**
 * Import Profile from file buffer (.json or .zip)
 */
export async function importProfile(fileBuffer: Buffer, fileName: string): Promise<{ success: boolean; message: string; fbStatus?: any }> {
  const isZip = fileName.endsWith('.zip') || (fileBuffer.length > 4 && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B);

  if (isZip) {
    const zip = new AdmZip(fileBuffer);
    const zipEntries = zip.getEntries();

    let foundSession = false;
    let foundProfileDir = false;

    for (const entry of zipEntries) {
      if (entry.entryName === 'fb-session.json' || entry.entryName.endsWith('/fb-session.json')) {
        const content = entry.getData();
        fs.writeFileSync(SESSION_FILE, content);
        foundSession = true;
      }
      if (entry.entryName.startsWith('browser-profile/')) {
        foundProfileDir = true;
      }
    }

    if (foundProfileDir) {
      if (!fs.existsSync(PROFILE_DIR)) {
        fs.mkdirSync(PROFILE_DIR, { recursive: true });
      }
      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('browser-profile/') && !entry.isDirectory) {
          zip.extractEntryTo(entry, STORAGE_DIR, true, true);
        }
      }
    }

    if (!foundSession && !foundProfileDir) {
      throw new Error('Tập tin ZIP không chứa fb-session.json hoặc thư mục browser-profile hợp lệ.');
    }
  } else {
    // Treat as JSON (Playwright session file or cookies array)
    const text = fileBuffer.toString('utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Tập tin không phải định dạng JSON hợp lệ!');
    }

    // Support both Playwright storageState ({ cookies, origins }) and direct cookies array ([...])
    let normalizedSession: any;
    if (Array.isArray(parsed)) {
      // Direct array of cookies
      normalizedSession = {
        cookies: parsed,
        origins: [],
      };
    } else if (parsed && Array.isArray(parsed.cookies)) {
      normalizedSession = parsed;
    } else {
      throw new Error('Dữ liệu JSON không chứa mảng cookies hợp lệ của Facebook.');
    }

    // Verify Facebook cookies
    const cUser = normalizedSession.cookies.find((c: any) => c.name === 'c_user');
    const xs = normalizedSession.cookies.find((c: any) => c.name === 'xs');

    if (!cUser || !xs) {
      throw new Error('Session thiếu cookie Facebook quan trọng (c_user hoặc xs). Vui lòng đảm bảo đã xuất đầy đủ cookie.');
    }

    fs.writeFileSync(SESSION_FILE, JSON.stringify(normalizedSession, null, 2), 'utf-8');
  }

  const fbStatus = await checkFacebookLoginStatus();
  logActivity('SUCCESS', 'AUTH', `Đã nhập và nạp phiên Facebook thành công (${fbStatus.message})`);

  return {
    success: true,
    message: fbStatus.loggedIn
      ? `Nhập profile thành công! Tài khoản đang hoạt động: ${fbStatus.username || 'Facebook User'}`
      : `Đã nạp file session thành công. Trạng thái: ${fbStatus.message}`,
    fbStatus,
  };
}

/**
 * Export Full System Backup (Database + Facebook Profile + Metadata)
 */
export async function exportFullBackupZip(): Promise<Buffer> {
  const zip = new AdmZip();

  // 1. Clean SQLite DB backup
  const dbBuffer = await exportDbSqlite();
  zip.addFile('app.db', dbBuffer);

  // 2. Facebook session if available
  if (fs.existsSync(SESSION_FILE)) {
    const sessionBuf = fs.readFileSync(SESSION_FILE);
    zip.addFile('fb-session.json', sessionBuf);
  }

  // 3. Metadata
  const stats = await getBackupStats();
  const meta = {
    app: 'TrendPulse - AI Google Trends & Social Automation Tool',
    version: '1.0.0',
    backup_date: new Date().toISOString(),
    stats,
  };
  zip.addFile('backup-info.json', Buffer.from(JSON.stringify(meta, null, 2), 'utf-8'));

  return zip.toBuffer();
}

/**
 * Import Full System Backup
 */
export async function importFullBackupZip(fileBuffer: Buffer): Promise<{ success: boolean; message: string }> {
  const zip = new AdmZip(fileBuffer);
  const zipEntries = zip.getEntries();

  let restoredDb = false;
  let restoredProfile = false;

  for (const entry of zipEntries) {
    if (entry.entryName === 'app.db') {
      await importDbSqlite(entry.getData());
      restoredDb = true;
    } else if (entry.entryName === 'fb-session.json') {
      fs.writeFileSync(SESSION_FILE, entry.getData());
      restoredProfile = true;
    }
  }

  if (!restoredDb && !restoredProfile) {
    throw new Error('Gói sao lưu không chứa cơ sở dữ liệu app.db hoặc file fb-session.json.');
  }

  logActivity('SUCCESS', 'BACKUP', 'Đã khôi phục toàn bộ hệ thống từ gói sao lưu ZIP');
  return {
    success: true,
    message: 'Khôi phục toàn bộ dữ liệu & phiên đăng nhập thành công!',
  };
}
