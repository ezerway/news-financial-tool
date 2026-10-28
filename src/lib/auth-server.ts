import crypto from 'crypto';
import db, { getSetting, setSetting, logActivity } from './db';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
}

export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Initializes default credentials in DB settings if not present
 */
export function ensureAdminAccount(): { username: string; isDefault: boolean } {
  let username = getSetting('admin_username', '').trim();
  let hash = getSetting('admin_password_hash', '').trim();
  let salt = getSetting('admin_password_salt', '').trim();

  const envUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  const envPassword = (process.env.ADMIN_PASSWORD || 'admin123456').trim();

  if (!username || !hash || !salt) {
    username = envUsername;
    salt = generateSalt();
    hash = hashPassword(envPassword, salt);

    setSetting('admin_username', username);
    setSetting('admin_password_hash', hash);
    setSetting('admin_password_salt', salt);

    return { username, isDefault: true };
  }

  return { username, isDefault: false };
}

/**
 * Verifies username and password against DB settings or env fallback
 */
export function verifyCredentials(usernameInput: string, passwordInput: string): { success: boolean; username: string; error?: string } {
  ensureAdminAccount();

  const storedUsername = getSetting('admin_username', process.env.ADMIN_USERNAME || 'admin');
  const storedHash = getSetting('admin_password_hash', '');
  const storedSalt = getSetting('admin_password_salt', '');

  if (usernameInput.trim().toLowerCase() !== storedUsername.trim().toLowerCase()) {
    return { success: false, username: storedUsername, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
  }

  if (!storedHash || !storedSalt) {
    // Fallback to env password if hash missing
    const envPassword = process.env.ADMIN_PASSWORD || 'admin123456';
    if (passwordInput === envPassword) {
      return { success: true, username: storedUsername };
    }
    return { success: false, username: storedUsername, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
  }

  const computedHash = hashPassword(passwordInput, storedSalt);
  if (!safeCompare(computedHash, storedHash)) {
    return { success: false, username: storedUsername, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
  }

  return { success: true, username: storedUsername };
}

/**
 * Updates admin username and/or password
 */
export function updateAdminCredentials(
  currentPassword: string,
  newUsername?: string,
  newPassword?: string
): { success: boolean; error?: string; message?: string } {
  const currentUsername = getSetting('admin_username', process.env.ADMIN_USERNAME || 'admin');

  // Verify current password
  const check = verifyCredentials(currentUsername, currentPassword);
  if (!check.success) {
    return { success: false, error: 'Mật khẩu hiện tại không đúng!' };
  }

  const updatedUsername = (newUsername || currentUsername).trim();
  if (!updatedUsername) {
    return { success: false, error: 'Tên đăng nhập không được để trống!' };
  }

  setSetting('admin_username', updatedUsername);

  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.trim().length < 6) {
      return { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự!' };
    }
    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword.trim(), newSalt);
    setSetting('admin_password_hash', newHash);
    setSetting('admin_password_salt', newSalt);
    logActivity('SUCCESS', 'AUTH', `Quản trị viên đã thay đổi mật khẩu đăng nhập hệ thống.`);
  } else {
    logActivity('INFO', 'AUTH', `Quản trị viên đã cập nhật tên đăng nhập thành "${updatedUsername}".`);
  }

  return { success: true, message: 'Cập nhật tài khoản quản trị thành công!' };
}
