import { isRedirectProxyEnabled } from './db';

/**
 * Tiện ích chuyển đổi liên kết trong phần bình luận (comment link) sang dạng:
 * https://financial-news.ezerway.com/go/?to=[target_url]
 * Ngoại lệ: Nếu trùng domain (financial-news.ezerway.com hoặc ezerway.com) hoặc tắt Setting thì giữ nguyên.
 */

export const REDIRECT_BASE_DOMAIN = 'financial-news.ezerway.com';
export const REDIRECT_BASE_URL = `https://${REDIRECT_BASE_DOMAIN}/go/?to=`;

/**
 * Kiểm tra xem một URL có thuộc cùng domain hay không
 */
export function isSameDomain(url: string): boolean {
  if (!url) return false;
  return /financial-news\.ezerway\.com/i.test(url) || /ezerway\.com/i.test(url);
}

/**
 * Chuyển đổi một URL đơn lẻ sang dạng https://financial-news.ezerway.com/go/?to=[target_url]
 */
export function convertToRedirectUrl(rawUrl: string, force = false): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();

  // Kiểm tra setting bật/tắt proxy
  if (!force && !isRedirectProxyEnabled()) {
    return trimmed;
  }

  // Nếu trùng domain thì thôi
  if (isSameDomain(trimmed)) {
    return trimmed;
  }

  // Nếu đã có tiền tố redirect thì thôi
  if (trimmed.includes('/go/?to=') || trimmed.includes('/go?to=')) {
    return trimmed;
  }

  // Chỉ chuyển đổi các URL hợp lệ bắt đầu bằng http:// hoặc https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${REDIRECT_BASE_URL}${trimmed}`;
}

/**
 * Tự động tìm và chuyển đổi tất cả các đường link trong nội dung comment
 */
export function convertCommentLinks(content: string, force = false): string {
  if (!content) return '';

  // Kiểm tra setting bật/tắt proxy
  if (!force && !isRedirectProxyEnabled()) {
    return content;
  }

  const urlRegex = /(https?:\/\/[^\s\)\],>"']+)/gi;

  return content.replace(urlRegex, (match) => {
    // Tách phần dấu câu cuối cùng nếu có (.,;) để tránh bị nuốt dấu câu của văn bản
    let cleanUrl = match;
    let trailingPunct = '';
    const punctMatch = match.match(/[.,;]+$/);
    if (punctMatch) {
      trailingPunct = punctMatch[0];
      cleanUrl = match.slice(0, -trailingPunct.length);
    }

    return convertToRedirectUrl(cleanUrl, force) + trailingPunct;
  });
}
