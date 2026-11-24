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
): { html: string; usedTemplateId: VideoTemplateId } {
  const { template, resolvedId } = resolveTemplate(templateId);
  const html = template.render(script, options);
  return { html, usedTemplateId: resolvedId };
}
