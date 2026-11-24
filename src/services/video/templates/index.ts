import { VideoSlideScript } from '../../video-script-generator';
import { VideoTemplateDefinition, VideoTemplateId, VideoTemplateMeta, TemplateRenderOptions } from './types';
import { modernDarkTemplate } from './template-modern-dark';
import { bloombergTerminalTemplate } from './template-bloomberg-terminal';
import { editorialMagazineTemplate } from './template-editorial-magazine';
import { neonCyberTemplate } from './template-neon-cyber';

export * from './types';
export { modernDarkTemplate } from './template-modern-dark';
export { bloombergTerminalTemplate } from './template-bloomberg-terminal';
export { editorialMagazineTemplate } from './template-editorial-magazine';
export { neonCyberTemplate } from './template-neon-cyber';

export const TEMPLATES: Record<VideoTemplateId, VideoTemplateDefinition> = {
  modern_dark: modernDarkTemplate,
  bloomberg_terminal: bloombergTerminalTemplate,
  editorial_magazine: editorialMagazineTemplate,
  neon_cyber: neonCyberTemplate,
};

export const TEMPLATE_LIST: VideoTemplateDefinition[] = [
  modernDarkTemplate,
  bloombergTerminalTemplate,
  editorialMagazineTemplate,
  neonCyberTemplate,
];

/**
 * Loại bỏ triệt để các dấu ba chấm (... hoặc …) và làm sạch text
 */
export function removeEllipsisAndCleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\.{2,}|…/g, '.') // Thay ... hoặc … bằng dấu chấm
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân trang thông minh cho slide nội dung:
 * - Hiển thị hết 100% nội dung, tuyệt đối không cắt lửng, không ba chấm (...).
 * - Nếu 1 block quá dài (> 125 ký tự): tự động tách thành 2 câu/ý riêng biệt.
 * - Nếu slide không đủ chỗ chứa (vượt quá 120 ký tự tổng hoặc đã có 2 block): TỰ ĐỘNG THÊM SLIDE MỚI!
 *   (Mỗi slide tối đa 2 block ngắn, hoặc 1 block dài để chữ luôn to rõ ràng, không bao giờ bị chật chội).
 */
export function paginateContentFragments(fragments: string[]): string[][] {
  const cleanedList: string[] = [];

  for (const raw of fragments) {
    if (!raw || !raw.trim()) continue;
    const clean = removeEllipsisAndCleanText(raw);

    // Nếu một đoạn văn quá dài (trên 130 ký tự), tách thành 2 câu theo dấu chấm câu hoặc liên từ
    if (clean.length > 130) {
      const splitByDot = clean.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
      if (splitByDot.length > 1) {
        for (const sub of splitByDot) {
          cleanedList.push(sub.trim());
        }
        continue;
      }

      const commaIdx = clean.indexOf(',', 60);
      if (commaIdx !== -1 && commaIdx < 110) {
        cleanedList.push(clean.substring(0, commaIdx + 1).trim());
        cleanedList.push(clean.substring(commaIdx + 1).trim());
        continue;
      }
    }

    cleanedList.push(clean);
  }

  if (cleanedList.length === 0) {
    return [['Nội dung đang được cập nhật liên tục từ các cơ quan báo chí chính thống.']];
  }

  const pages: string[][] = [];
  let currentSlide: string[] = [];
  let currentLength = 0;

  for (const item of cleanedList) {
    const itemLen = item.length;

    // Nếu slide hiện tại đã có 2 block, hoặc thêm block này làm tổng ký tự vượt quá 120, hoặc item là block dài (> 70 ký tự)
    if (
      currentSlide.length >= 2 ||
      (currentSlide.length > 0 && currentLength + itemLen > 120) ||
      (currentSlide.length > 0 && itemLen > 70)
    ) {
      pages.push(currentSlide);
      currentSlide = [item];
      currentLength = itemLen;
    } else {
      currentSlide.push(item);
      currentLength += itemLen;
    }
  }

  if (currentSlide.length > 0) {
    pages.push(currentSlide);
  }

  return pages;
}

/**
 * Tính toán thời lượng video chuẩn xác linh hoạt dựa theo số lượng slide nội dung
 * Công thức: 12 giây cơ bản (Intro ~3.5s + Headline ~3.5s + Outro ~5.0s)
 *            + mỗi slide nội dung ~5.5 giây để người xem kịp đọc.
 * Giới hạn chặt chẽ trong khoảng từ 20 giây đến 60 giây.
 */
export function calculateVideoDuration(script: VideoSlideScript): number {
  const allFragments: string[] = [];
  for (const cs of script.contentSlides || []) {
    for (const f of cs.fragments || []) {
      if (f && f.trim()) {
        allFragments.push(f.trim());
      }
    }
  }

  const pages = paginateContentFragments(allFragments);
  const numPages = pages.length;

  // 12s cho phần khung (Intro + Headline + Outro), cộng thêm 5.5s cho mỗi slide nội dung
  const estimated = 12 + numPages * 5.5;

  // Giới hạn trong khoảng từ 20s đến 60s
  return Math.max(20, Math.min(60, Math.round(estimated)));
}

/**
 * Lấy danh sách metadata của tất cả templates có sẵn
 */
export function getAllVideoTemplates(): VideoTemplateMeta[] {
  return TEMPLATE_LIST.map(({ render, ...meta }) => meta);
}

/**
 * Chọn ngẫu nhiên một template ID
 */
export function getRandomTemplateId(): VideoTemplateId {
  const ids: VideoTemplateId[] = ['modern_dark', 'bloomberg_terminal', 'editorial_magazine', 'neon_cyber'];
  const randomIndex = Math.floor(Math.random() * ids.length);
  return ids[randomIndex];
}

/**
 * Lấy template definition theo ID hoặc random nếu ID là 'random' hoặc không tìm thấy
 */
export function resolveTemplate(templateId?: string): { template: VideoTemplateDefinition; resolvedId: VideoTemplateId } {
  if (!templateId || templateId === 'random' || !(templateId in TEMPLATES)) {
    const randomId = getRandomTemplateId();
    return { template: TEMPLATES[randomId], resolvedId: randomId };
  }
  const id = templateId as VideoTemplateId;
  return { template: TEMPLATES[id], resolvedId: id };
}

/**
 * Render HTML cho video dựa theo templateId (hoặc random)
 */
export function renderVideoTemplate(
  templateId: string | undefined,
  script: VideoSlideScript,
  options?: TemplateRenderOptions
): { html: string; usedTemplateId: VideoTemplateId; duration: number } {
  const duration = options?.duration || calculateVideoDuration(script);
  const resolvedOptions: TemplateRenderOptions = {
    ...options,
    duration,
  };
  const { template, resolvedId } = resolveTemplate(templateId);
  const html = template.render(script, resolvedOptions);
  return { html, usedTemplateId: resolvedId, duration };
}
