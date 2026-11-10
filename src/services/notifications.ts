import db, { getSetting, logActivity } from '@/lib/db';

export interface PushNotificationPayload {
  type: 'post' | 'reel_fb' | 'reel_tiktok';
  status: 'success' | 'failed';
  title: string;
  url?: string | null;
  error?: string | null;
  details?: string | null;
}

/**
 * Format a human-readable notification message for Telegram
 */
function formatTelegramMessage(payload: PushNotificationPayload): string {
  const isSuccess = payload.status === 'success';
  const icon = isSuccess ? '✅' : '❌';
  const statusText = isSuccess ? 'THÀNH CÔNG' : 'THẤT BẠI';

  let typeName = 'Bài viết Facebook';
  if (payload.type === 'reel_fb') typeName = 'Reel Facebook';
  if (payload.type === 'reel_tiktok') typeName = 'Video TikTok';

  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  let text = `<b>${icon} [TrendPulse] ĐĂNG BÀI ${statusText}</b>\n\n`;
  text += `📌 <b>Nền tảng:</b> ${typeName}\n`;
  text += `📰 <b>Nội dung:</b> <i>${escapeHtml(payload.title)}</i>\n`;

  if (isSuccess && payload.url) {
    text += `🔗 <b>Link bài viết:</b> <a href="${payload.url}">${payload.url}</a>\n`;
  }

  if (!isSuccess && payload.error) {
    text += `⚠️ <b>Lỗi:</b> <code>${escapeHtml(payload.error.slice(0, 500))}</code>\n`;
  }

  if (payload.details) {
    text += `ℹ️ <b>Chi tiết:</b> ${escapeHtml(payload.details)}\n`;
  }

  text += `\n⏰ <i>${now}</i>`;
  return text;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send notification to Telegram bot
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    if (!cleanToken || !cleanChatId) {
      return { success: false, error: 'Thiếu Telegram Bot Token hoặc Chat ID.' };
    }

    const apiUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || 'Lỗi Telegram API' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Central server push notification dispatcher
 * Triggers Telegram if configured & enabled
 */
export async function sendServerPushNotification(
  payload: PushNotificationPayload
): Promise<void> {
  try {
    const telegramEnabled = getSetting('telegram_notify_enabled', 'false') === 'true';
    const notifyOnSuccess = getSetting('notify_on_success', 'true') === 'true';
    const notifyOnFailure = getSetting('notify_on_failure', 'true') === 'true';

    // Check filter preferences
    if (payload.status === 'success' && !notifyOnSuccess) return;
    if (payload.status === 'failed' && !notifyOnFailure) return;

    if (telegramEnabled) {
      const botToken = getSetting('telegram_bot_token', process.env.TELEGRAM_BOT_TOKEN || '');
      const chatId = getSetting('telegram_chat_id', process.env.TELEGRAM_CHAT_ID || '');

      if (botToken && chatId) {
        const text = formatTelegramMessage(payload);
        const res = await sendTelegramMessage(botToken, chatId, text);
        if (res.success) {
          logActivity('INFO', 'NOTIFICATION', `[Telegram] Đã gửi thông báo đẩy: ${payload.title} (${payload.status})`);
        } else {
          logActivity('WARN', 'NOTIFICATION', `[Telegram] Gửi thông báo thất bại: ${res.error}`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Notification Error]', err);
  }
}

/**
 * Test telegram bot connectivity
 */
export async function testTelegramNotification(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; message: string }> {
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const testMsg = `🔔 <b>[TrendPulse] KIỂM TRA KẾT NỐI THÔNG BÁO ĐẨY</b>\n\n` +
    `✅ Chúc mừng! Kết nối Telegram Bot và Chat ID hoàn toàn hợp lệ.\n` +
    `TrendPulse sẽ tự động gửi thông báo đến đây mỗi khi đăng bài thành công hoặc gặp sự cố.\n\n` +
    `⏰ <i>${now}</i>`;

  const result = await sendTelegramMessage(botToken, chatId, testMsg);
  if (result.success) {
    return {
      success: true,
      message: 'Đã gửi tin nhắn thử nghiệm thành công đến Telegram!',
    };
  } else {
    return {
      success: false,
      message: `Gửi tin nhắn thử nghiệm thất bại: ${result.error}`,
    };
  }
}

