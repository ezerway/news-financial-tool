import { VideoSlideScript } from '../../video-script-generator';

export type VideoTemplateId =
  | 'modern_dark'
  | 'bloomberg_terminal'
  | 'editorial_magazine'
  | 'neon_cyber';

export interface TemplateRenderOptions {
  width?: number; // 720 hoặc 1080
  height?: number; // 1280 hoặc 1920
  duration?: number; // 20 (seconds)
}

export interface VideoTemplateMeta {
  id: VideoTemplateId;
  name: string;
  nameEn: string;
  tagline: string;
  badge: string;
  category: string;
  previewColor: string; // Background visual representation (hex/gradient)
  accentColor: string; // Accent color hex
  fontFamily: string;
  features: string[];
}

export type TemplateRenderFunction = (
  script: VideoSlideScript,
  options?: TemplateRenderOptions
) => string;

export interface VideoTemplateDefinition extends VideoTemplateMeta {
  render: TemplateRenderFunction;
}
