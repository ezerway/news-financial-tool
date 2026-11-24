import { VideoSlideScript } from '../video-script-generator';
import { modernDarkTemplate, renderVideoTemplate, TemplateRenderOptions } from './templates';

export type { TemplateRenderOptions } from './templates';

/**
 * Tạo mã nguồn HTML5 hoàn chỉnh cho composition video dọc 9:16 chuẩn HyperFrames
 * Tương thích ngược với các phiên bản trước: mặc định sử dụng Modern Dark template
 */
export function buildHyperframesHtml(script: VideoSlideScript, options: TemplateRenderOptions = {}): string {
  return modernDarkTemplate.render(script, options);
}
