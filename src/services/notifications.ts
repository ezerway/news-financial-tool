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
 * Send notification to Slack Incoming Webhook
 */
export async function sendSlackWebhook(
  webhookUrl: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl || !cleanUrl.startsWith('https://hooks.slack.com/')) {
      return {
        success: false,
        error: 'URL Slack Incoming Webhook không hợp lệ (cần bắt đầu bằng https://hooks.slack.com/).',
      };
    }

    const isSuccess = payload.status === 'success';
    const statusText = isSuccess ? 'THÀNH CÔNG' : 'THẤT BẠI';
    const color = isSuccess ? '#10b981' : '#f43f5e';

    let typeName = 'Bài viết Facebook';
    if (payload.type === 'reel_fb') typeName = 'Reel Facebook';
    if (payload.type === 'reel_tiktok') typeName = 'Video TikTok';

    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${isSuccess ? '✅' : '❌'} [TrendPulse] Đăng bài ${statusText}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Nền tảng:*\n${typeName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Thời gian:*\n${now}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Tiêu đề / Nội dung:*\n${payload.title}`,
        },
      },
    ];

    if (isSuccess && payload.url) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Link bài viết:*\n<${payload.url}|Mở xem bài viết>`,
        },
      });
    }

    if (!isSuccess && payload.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Chi tiết lỗi:*\n\`\`\`${payload.error.slice(0, 500)}\`\`\``,
        },
      });
    }

    if (payload.details) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Ghi chú:* ${payload.details}`,
          },
        ],
      });
    }

    const body = {
      text: `[TrendPulse] ${typeName} - Đăng ${statusText}: ${payload.title}`,
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await res.text();
    if (res.ok && responseText === 'ok') {
      return { success: true };
    } else {
      return { success: false, error: responseText || `HTTP ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Central server push notification dispatcher
 * Triggers Telegram and/or Slack if configured & enabled
 */
export async function sendServerPushNotification(
  payload: PushNotificationPayload
): Promise<void> {
  try {
    const notifyOnSuccess = getSetting('notify_on_success', 'true') === 'true';
    const notifyOnFailure = getSetting('notify_on_failure', 'true') === 'true';

    // Check filter preferences
    if (payload.status === 'success' && !notifyOnSuccess) return;
    if (payload.status === 'failed' && !notifyOnFailure) return;

    // 1. Gửi qua Telegram Bot nếu được bật
    const telegramEnabled = getSetting('telegram_notify_enabled', 'false') === 'true';
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

    // 2. Gửi qua Slack Incoming Webhook nếu được bật
    const slackEnabled = getSetting('slack_notify_enabled', 'false') === 'true';
    if (slackEnabled) {
      const webhookUrl = getSetting('slack_webhook_url', process.env.SLACK_WEBHOOK_URL || '');

      if (webhookUrl) {
        const res = await sendSlackWebhook(webhookUrl, payload);
        if (res.success) {
          logActivity('INFO', 'NOTIFICATION', `[Slack] Đã gửi thông báo đẩy: ${payload.title} (${payload.status})`);
        } else {
          logActivity('WARN', 'NOTIFICATION', `[Slack] Gửi thông báo thất bại: ${res.error}`);
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

/**
 * Test Slack webhook connectivity
 */
export async function testSlackNotification(
  webhookUrl: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) {
    return { success: false, message: 'Thiếu Slack Webhook URL.' };
  }

  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const body = {
    text: '🔔 [TrendPulse] Kiểm tra kết nối Slack Webhook',
    attachments: [
      {
        color: '#4f46e5',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔔 [TrendPulse] KIỂM TRA KẾT NỐI SLACK WEBHOOK',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *Chúc mừng!* Slack Incoming Webhook đã được kết nối thành công với TrendPulse.\nHệ thống sẽ tự động gửi thông báo đẩy đến kênh này mỗi khi xuất bản bài viết hoặc video Reel.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Thời gian kiểm tra: ${now}`,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    if (res.ok && text === 'ok') {
      return { success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công đến Slack!' };
    } else {
      return { success: false, message: `Gửi tin nhắn Slack thất bại: ${text || `HTTP ${res.status}`}` };
    }
  } catch (err: any) {
    return { success: false, message: `Lỗi kết nối Slack: ${err.message || String(err)}` };
  }
}
