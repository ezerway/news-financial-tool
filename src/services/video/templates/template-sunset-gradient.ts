import { VideoSlideScript } from '../../video-script-generator';
import { TemplateRenderOptions, VideoTemplateDefinition } from './types';
import { calculateVideoDuration, paginateContentFragments } from './index';

export const sunsetGradientTemplate: VideoTemplateDefinition = {
  id: 'sunset_gradient',
  name: 'TikTok GenZ & Khởi nghiệp (Sunset Glow)',
  nameEn: 'Sunset Vibrant GenZ',
  tagline: 'Gradient hoàng hôn Cam san hô & Tím Neon sôi động, thẻ kính mờ Frost Glass bo tròn trẻ trung cuốn hút',
  badge: 'Viral TikTok',
  category: 'GenZ & Xu hướng',
  previewColor: 'radial-gradient(circle at 50% 15%, #4C1D95 0%, #0F0A1C 85%)',
  accentColor: '#F97316',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  features: [
    'Tone tím vũ trụ `#0F0A1C` phối Cam san hô `#F97316` & Hồng `#FB7185`',
    'Hiệu ứng kính mờ Frost Glass bo góc 28px thời thượng',
    'Icon động rực rỡ và kiểu chữ hiện đại đậm chất GenZ',
    'Tối ưu tương tác like, thả tim & share mạnh mẽ trên TikTok/Reels',
  ],
  render: buildSunsetGradientHtml,
};

export function buildSunsetGradientHtml(script: VideoSlideScript, options: TemplateRenderOptions = {}): string {
  const width = options.width || 720;
  const height = options.height || 1280;
  const duration = options.duration || calculateVideoDuration(script);

  const allFragments: string[] = [];
  for (const cs of script.contentSlides || []) {
    for (const f of cs.fragments || []) {
      if (f && f.trim()) {
        allFragments.push(f.trim());
      }
    }
  }

  const slidePages = paginateContentFragments(allFragments);
  const numPages = slidePages.length;

  const contentScenesHtml = slidePages
    .map((pageFragments, pageIdx) => {
      const blocksHtml = pageFragments
        .map(
          (frag, blockIdx) => `
          <div class="content-block page-${pageIdx + 1}-block-${blockIdx + 1}">
            <div class="block-glow-pill">
              <span>0${blockIdx + 1}</span>
            </div>
            <div class="block-body">
              <div class="block-text">${frag}</div>
            </div>
          </div>
        `
        )
        .join('');

      return `
      <!-- SCENE: NỘI DUNG TRANG ${pageIdx + 1} / ${numPages} -->
      <div id="scene-content-${pageIdx + 1}" class="scene scene-content">
        <div class="safe-area">
          <div class="content-header">
            <span class="sunset-pill-badge">
              <span>✨</span>
              TRENDING TODAY
            </span>
            <div class="content-header-title">${script.slide1.headline || script.intro.mainTitle}</div>
          </div>
          <div class="content-blocks-wrap">
            ${blocksHtml}
          </div>
        </div>
      </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1.0">
  <title>${script.intro.mainTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html, body {
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #0F0A1C;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #F8FAFC;
      -webkit-font-smoothing: antialiased;
    }

    .metric-nowrap {
      display: inline-block;
      white-space: nowrap;
      word-break: keep-all;
      color: #FB923C;
      text-shadow: 0 0 16px rgba(249, 115, 22, 0.6);
      font-weight: 800;
    }

    #viewport {
      position: relative;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 12%, #3B0764 0%, #0F0A1C 80%);
      overflow: hidden;
    }

    /* Ambient Sunset Neon Glows */
    .ambient-glow-1 {
      position: absolute;
      top: -150px;
      right: -100px;
      width: 550px;
      height: 550px;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.28) 0%, transparent 70%);
      filter: blur(85px);
      pointer-events: none;
    }

    .ambient-glow-2 {
      position: absolute;
      bottom: -150px;
      left: -100px;
      width: 550px;
      height: 550px;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 70%);
      filter: blur(95px);
      pointer-events: none;
    }

    .ambient-glow-3 {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(244, 63, 94, 0.15) 0%, transparent 70%);
      filter: blur(100px);
      pointer-events: none;
    }

    /* Top Bar */
    .top-sunset-bar {
      position: absolute;
      top: 32px;
      left: 36px;
      right: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 40;
    }

    .sunset-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 18px;
      background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.1em;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);
    }

    .sunset-time {
      font-size: 12px;
      font-weight: 700;
      color: #F472B6;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    /* Bottom Bar */
    .bottom-sunset-bar {
      position: absolute;
      bottom: 30px;
      left: 36px;
      right: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      border-top: 1px solid rgba(249, 115, 22, 0.2);
      z-index: 40;
    }

    .sunset-footer-left {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: linear-gradient(90deg, #F97316, #EC4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .sunset-footer-right {
      font-size: 11px;
      font-weight: 600;
      color: #94A3B8;
    }

    /* Safe Area */
    .safe-area {
      position: absolute;
      top: 96px;
      bottom: 86px;
      left: 36px;
      right: 36px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .scene {
      position: absolute;
      inset: 0;
      opacity: 0;
      visibility: hidden;
      will-change: opacity, transform;
    }

    .scene.active {
      visibility: visible;
    }

    /* SCENE 1: INTRO */
    .intro-wrapper {
      text-align: center;
      padding: 0 16px;
    }

    .intro-sunset-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 24px;
      background: rgba(249, 115, 22, 0.15);
      border: 1.5px solid rgba(249, 115, 22, 0.4);
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #FB923C;
      text-transform: uppercase;
      margin-bottom: 28px;
      box-shadow: 0 4px 20px rgba(249, 115, 22, 0.2);
    }

    .intro-headline-text {
      font-size: 48px;
      font-weight: 900;
      line-height: 1.18;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: #FFFFFF;
      margin-bottom: 26px;
      text-shadow: 0 8px 30px rgba(0, 0, 0, 0.8);
    }

    .intro-headline-text span {
      background: linear-gradient(135deg, #F97316 0%, #FB7185 50%, #C084FC 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .intro-sub-tagline {
      font-size: 20px;
      font-weight: 500;
      line-height: 1.45;
      color: #E2E8F0;
      max-width: 580px;
      margin: 0 auto;
    }

    /* SCENE 2: HEADLINE */
    .card-headline {
      background: linear-gradient(180deg, rgba(35, 15, 55, 0.85) 0%, rgba(18, 10, 30, 0.95) 100%);
      border: 2px solid rgba(249, 115, 22, 0.4);
      border-radius: 28px;
      padding: 44px 34px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), inset 0 0 40px rgba(244, 63, 94, 0.08);
      backdrop-filter: blur(25px);
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .headline-pill-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sunset-badge-sm {
      padding: 5px 14px;
      background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.1em;
      border-radius: 9999px;
      text-transform: uppercase;
    }

    .headline-timestamp {
      font-size: 13px;
      color: #F472B6;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .headline-main-text {
      font-size: 38px;
      font-weight: 900;
      line-height: 1.25;
      letter-spacing: -0.01em;
      color: #FFFFFF;
    }

    .headline-source-bar {
      padding-top: 18px;
      border-top: 1px dashed rgba(249, 115, 22, 0.3);
      font-size: 13px;
      color: #FED7AA;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* SCENE 3..N: CONTENT */
    .content-header {
      margin-bottom: 24px;
    }

    .sunset-pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 14px;
      background: rgba(249, 115, 22, 0.18);
      border: 1px solid rgba(249, 115, 22, 0.45);
      border-radius: 9999px;
      color: #FB923C;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .content-header-title {
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .content-blocks-wrap {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .content-block {
      background: linear-gradient(135deg, rgba(32, 14, 50, 0.9) 0%, rgba(16, 8, 28, 0.95) 100%);
      border: 1.5px solid rgba(249, 115, 22, 0.35);
      border-left: 6px solid #F97316;
      border-radius: 22px;
      padding: 26px 24px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: flex-start;
      gap: 16px;
      opacity: 0;
      transform: translateY(18px);
      transition: none;
    }

    .block-glow-pill {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 900;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.5);
      flex-shrink: 0;
    }

    .block-body {
      flex: 1;
    }

    .block-text {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.45;
      color: #F8FAFC;
      letter-spacing: -0.01em;
    }

    /* SCENE LAST: OUTRO */
    .card-outro {
      background: linear-gradient(180deg, rgba(40, 16, 60, 0.9) 0%, rgba(15, 7, 26, 0.98) 100%);
      border: 2px solid rgba(249, 115, 22, 0.45);
      border-radius: 30px;
      padding: 50px 36px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    .outro-sunset-icon {
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 34px;
      box-shadow: 0 0 35px rgba(249, 115, 22, 0.5);
    }

    .outro-cta-heading {
      font-size: 34px;
      font-weight: 900;
      color: #FFFFFF;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .outro-subtext {
      font-size: 18px;
      color: #CBD5E1;
      font-weight: 500;
      line-height: 1.45;
      max-width: 460px;
    }

    .outro-social-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 26px;
      background: linear-gradient(135deg, #F97316 0%, #EC4899 100%);
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.08em;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.5);
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>
    <div class="ambient-glow-3"></div>

    <!-- Top Sunset Bar -->
    <div class="top-sunset-bar">
      <div class="sunset-tag">
        <span>🔥 ${script.slide1.category || 'XU HƯỚNG MỚI'}</span>
      </div>
      <div class="sunset-time">${script.slide1.timestamp || 'CẬP NHẬT'}</div>
    </div>

    <!-- Bottom Sunset Bar -->
    <div class="bottom-sunset-bar">
      <div class="sunset-footer-left">SUNSET VIBRANT GENZ</div>
      <div class="sunset-footer-right">Thả tim & Follow để cập nhật xu hướng</div>
    </div>

    <!-- SCENE 1: INTRO -->
    <div id="scene-intro" class="scene scene-intro">
      <div class="safe-area">
        <div class="intro-wrapper">
          <div class="intro-sunset-badge">
            <span>✨ ${script.intro.categoryLabel || 'TIN NÓNG MỖI NGÀY'}</span>
          </div>
          <h1 class="intro-headline-text">
            ${script.intro.mainTitle}
          </h1>
          <p class="intro-sub-tagline">
            ${script.intro.tagline || 'Khám phá các chuyển động kinh tế & đời sống nổi bật nhất cùng góc nhìn giới trẻ.'}
          </p>
        </div>
      </div>
    </div>

    <!-- SCENE 2: HEADLINE -->
    <div id="scene-headline" class="scene scene-headline">
      <div class="safe-area">
        <div class="card-headline">
          <div class="headline-pill-row">
            <span class="sunset-badge-sm">TIÊU ĐIỂM</span>
            <span class="headline-timestamp">HOT TRENDING</span>
          </div>
          <div class="headline-main-text">
            ${script.slide1.headline}
          </div>
          <div class="headline-source-bar">
            <span>🚀 Nội dung đang thu hút lượng quan tâm lớn nhất cộng đồng mạng</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SCENE 3..N: CONTENT SLIDES -->
    ${contentScenesHtml}

    <!-- SCENE OUTRO -->
    <div id="scene-outro" class="scene scene-outro">
      <div class="safe-area">
        <div class="card-outro">
          <div class="outro-sunset-icon">🚀</div>
          <div class="outro-cta-heading">
            ${script.outro.ctaText || 'Nhấn theo dõi để đón đầu xu hướng!'}
          </div>
          <div class="outro-subtext">
            ${script.outro.subText || 'Cảm ơn bạn đã đồng hành cùng kênh.'}
          </div>
          <div class="outro-social-pill">
            <span>FOLLOW NGAY</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const DURATION = ${duration};
    const numPages = ${numPages};

    const sceneIntro = document.getElementById('scene-intro');
    const sceneHeadline = document.getElementById('scene-headline');
    const contentScenes = [];
    for (let p = 1; p <= numPages; p++) {
      const el = document.getElementById('scene-content-' + p);
      if (el) contentScenes.push(el);
    }
    const sceneOutro = document.getElementById('scene-outro');

    window.seekTo = function(timeInSeconds) {
      const clamped = Math.max(0, Math.min(DURATION, timeInSeconds));

      // Reset all scenes
      sceneIntro.classList.remove('active');
      sceneHeadline.classList.remove('active');
      contentScenes.forEach(s => s.classList.remove('active'));
      sceneOutro.classList.remove('active');

      sceneIntro.style.visibility = 'hidden';
      sceneHeadline.style.visibility = 'hidden';
      contentScenes.forEach(s => s.style.visibility = 'hidden');
      sceneOutro.style.visibility = 'hidden';

      const contentStartTime = numPages > 1 ? 6.8 : 7.2;
      const outroDuration = 4.5;
      const outroStartTime = DURATION - outroDuration;
      const contentTotalTime = outroStartTime - contentStartTime;
      const timePerPage = contentTotalTime / numPages;

      if (clamped < 3.0) {
        sceneIntro.classList.add('active');
        sceneIntro.style.visibility = 'visible';
        const progress = clamped / 3.0;
        const opacity = clamped < 0.4 ? (clamped / 0.4) : (clamped > 2.6 ? (3.0 - clamped) / 0.4 : 1);
        const scale = 0.95 + (progress * 0.05);
        sceneIntro.style.opacity = Math.max(0, Math.min(1, opacity));
        sceneIntro.style.transform = 'scale(' + scale + ')';
      } else if (clamped < contentStartTime) {
        sceneHeadline.classList.add('active');
        sceneHeadline.style.visibility = 'visible';
        const headlineDuration = contentStartTime - 3.0;
        const relTime = clamped - 3.0;
        const opacity = relTime < 0.4 ? (relTime / 0.4) : (relTime > headlineDuration - 0.4 ? (headlineDuration - relTime) / 0.4 : 1);
        const translateY = relTime < 0.4 ? (1 - (relTime / 0.4)) * 24 : 0;
        sceneHeadline.style.opacity = Math.max(0, Math.min(1, opacity));
        sceneHeadline.style.transform = 'translateY(' + translateY + 'px)';
      } else if (clamped < outroStartTime) {
        const contentRelTime = clamped - contentStartTime;
        const activePageIdx = Math.min(numPages - 1, Math.floor(contentRelTime / timePerPage));
        const activeScene = contentScenes[activePageIdx];

        if (activeScene) {
          activeScene.classList.add('active');
          activeScene.style.visibility = 'visible';
          const pageRelTime = contentRelTime - (activePageIdx * timePerPage);
          const pageOpacity = pageRelTime < 0.35 ? (pageRelTime / 0.35) : (pageRelTime > timePerPage - 0.35 ? (timePerPage - pageRelTime) / 0.35 : 1);
          activeScene.style.opacity = Math.max(0, Math.min(1, pageOpacity));

          const blocks = activeScene.querySelectorAll('.content-block');
          blocks.forEach(function(block, bIdx) {
            const bStartTime = bIdx * 1.4;
            if (pageRelTime >= bStartTime) {
              const bRel = pageRelTime - bStartTime;
              const bOpacity = Math.min(1, bRel / 0.3);
              const bY = Math.max(0, (1 - (bRel / 0.3)) * 18);
              block.style.opacity = bOpacity;
              block.style.transform = 'translateY(' + bY + 'px)';
            } else {
              block.style.opacity = '0';
              block.style.transform = 'translateY(18px)';
            }
          });
        }
      } else {
        sceneOutro.classList.add('active');
        sceneOutro.style.visibility = 'visible';
        const relTime = clamped - outroStartTime;
        const opacity = relTime < 0.4 ? (relTime / 0.4) : 1;
        const scale = 0.94 + (Math.min(1, relTime / 0.4) * 0.06);
        sceneOutro.style.opacity = Math.max(0, Math.min(1, opacity));
        sceneOutro.style.transform = 'scale(' + scale + ')';
      }
    };

    window.seekTo(0);

    if (window.__AUTO_PLAY__) {
      let startTime = null;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;
        window.seekTo(elapsed);
        if (elapsed < DURATION) {
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    }
  </script>
</body>
</html>`;
}
