import { VideoSlideScript } from '../../video-script-generator';
import { TemplateRenderOptions, VideoTemplateDefinition } from './types';
import { calculateVideoDuration, paginateContentFragments } from './index';

export const crimsonBreakingTemplate: VideoTemplateDefinition = {
  id: 'crimson_breaking',
  name: 'Thời sự & Khẩn cấp (Breaking News)',
  nameEn: 'Breaking News Alert',
  tagline: 'Tone đỏ Crimson rực lửa, vạch cảnh báo radar chớp tắt và dải ticker thời sự giật gân',
  badge: 'Hot & Khẩn cấp',
  category: 'Thời sự & Tin nóng',
  previewColor: 'radial-gradient(circle at 50% 15%, #450A0A 0%, #090305 85%)',
  accentColor: '#EF4444',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  features: [
    'Tone đỏ Crimson quyền lực `#DC2626` & `#EF4444`',
    'Dải cảnh báo "🚨 BREAKING NEWS" nổi bật giật gân',
    'Thẻ card viền phản quang đỏ đậm tính thời sự',
    'Tối ưu tỷ lệ giữ chân (Retention) cực cao trên TikTok & Shorts',
  ],
  render: buildCrimsonBreakingHtml,
};

export function buildCrimsonBreakingHtml(script: VideoSlideScript, options: TemplateRenderOptions = {}): string {
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
            <div class="block-flag">
              <span class="flag-dot"></span>
              <span class="flag-num">0${blockIdx + 1}</span>
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
            <span class="breaking-pulse-badge">
              <span class="pulse-circle"></span>
              DIỄN BIẾN MỚI
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
      background: #090305;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #F8FAFC;
      -webkit-font-smoothing: antialiased;
    }

    .metric-nowrap {
      display: inline-block;
      white-space: nowrap;
      word-break: keep-all;
      color: #F87171;
      text-shadow: 0 0 16px rgba(239, 68, 68, 0.6);
      font-weight: 800;
    }

    #viewport {
      position: relative;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 12%, #380808 0%, #090305 80%);
      overflow: hidden;
    }

    /* Ambient Crimson Hazard Glow */
    .hazard-stripe-top {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, #DC2626, #F59E0B, #DC2626);
      box-shadow: 0 0 20px rgba(220, 38, 38, 0.8);
      z-index: 50;
    }

    .ambient-glow-1 {
      position: absolute;
      top: -140px;
      left: 50%;
      transform: translateX(-50%);
      width: 580px;
      height: 400px;
      background: radial-gradient(circle, rgba(220, 38, 38, 0.28) 0%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
    }

    .ambient-glow-2 {
      position: absolute;
      bottom: -150px;
      right: -100px;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(185, 28, 28, 0.22) 0%, transparent 70%);
      filter: blur(90px);
      pointer-events: none;
    }

    /* Top Ticker Bar */
    .top-breaking-bar {
      position: absolute;
      top: 24px;
      left: 36px;
      right: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 40;
    }

    .breaking-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.12em;
      border-radius: 6px;
      text-transform: uppercase;
      box-shadow: 0 4px 16px rgba(220, 38, 38, 0.5);
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 0 8px #FFFFFF;
    }

    .live-time {
      font-size: 12px;
      font-weight: 700;
      color: #FCA5A5;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    /* Bottom Ticker Line */
    .bottom-ticker-bar {
      position: absolute;
      bottom: 24px;
      left: 36px;
      right: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      border-top: 1px solid rgba(239, 68, 68, 0.25);
      z-index: 40;
    }

    .ticker-left {
      font-size: 11px;
      font-weight: 700;
      color: #F87171;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ticker-right {
      font-size: 11px;
      font-weight: 600;
      color: #94A3B8;
    }

    /* Safe Area for Scenes */
    .safe-area {
      position: absolute;
      top: 90px;
      bottom: 80px;
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

    .intro-badge-top {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 22px;
      background: rgba(220, 38, 38, 0.15);
      border: 1.5px solid rgba(239, 68, 68, 0.4);
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #F87171;
      text-transform: uppercase;
      margin-bottom: 30px;
    }

    .intro-headline-text {
      font-size: 46px;
      font-weight: 900;
      line-height: 1.18;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: #FFFFFF;
      margin-bottom: 28px;
      text-shadow: 0 8px 30px rgba(0, 0, 0, 0.8);
    }

    .intro-headline-text span {
      background: linear-gradient(135deg, #EF4444 0%, #F59E0B 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .intro-sub-tagline {
      font-size: 20px;
      font-weight: 500;
      line-height: 1.45;
      color: #CBD5E1;
      max-width: 580px;
      margin: 0 auto;
    }

    /* SCENE 2: HEADLINE */
    .card-headline {
      background: linear-gradient(180deg, rgba(30, 10, 10, 0.85) 0%, rgba(15, 5, 5, 0.95) 100%);
      border: 2px solid rgba(239, 68, 68, 0.4);
      border-radius: 26px;
      padding: 44px 34px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), inset 0 0 30px rgba(220, 38, 38, 0.1);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .headline-pill-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .breaking-tag-sm {
      padding: 5px 14px;
      background: #DC2626;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.1em;
      border-radius: 6px;
      text-transform: uppercase;
    }

    .headline-timestamp {
      font-size: 13px;
      color: #94A3B8;
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
      border-top: 1px dashed rgba(239, 68, 68, 0.3);
      font-size: 13px;
      color: #FCA5A5;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* SCENE 3..N: CONTENT */
    .content-header {
      margin-bottom: 24px;
    }

    .breaking-pulse-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: rgba(220, 38, 38, 0.2);
      border: 1px solid rgba(220, 38, 38, 0.5);
      border-radius: 6px;
      color: #F87171;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .pulse-circle {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #EF4444;
      box-shadow: 0 0 6px #EF4444;
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
      background: linear-gradient(135deg, rgba(28, 8, 8, 0.9) 0%, rgba(15, 4, 4, 0.95) 100%);
      border: 1.5px solid rgba(239, 68, 68, 0.3);
      border-left: 6px solid #DC2626;
      border-radius: 20px;
      padding: 26px 24px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: flex-start;
      gap: 16px;
      opacity: 0;
      transform: translateY(18px);
      transition: none;
    }

    .block-flag {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding-top: 2px;
      flex-shrink: 0;
    }

    .flag-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #DC2626;
      box-shadow: 0 0 10px #DC2626;
    }

    .flag-num {
      font-size: 11px;
      font-weight: 800;
      color: #F87171;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .block-body {
      flex: 1;
    }

    .block-text {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.45;
      color: #F1F5F9;
      letter-spacing: -0.01em;
    }

    /* SCENE LAST: OUTRO */
    .card-outro {
      background: linear-gradient(180deg, rgba(35, 10, 10, 0.9) 0%, rgba(12, 4, 4, 0.98) 100%);
      border: 2px solid rgba(239, 68, 68, 0.45);
      border-radius: 28px;
      padding: 50px 36px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    .outro-alert-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(220, 38, 38, 0.2);
      border: 2px solid #EF4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 0 0 30px rgba(239, 68, 68, 0.4);
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
      padding: 10px 24px;
      background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%);
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.08em;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 8px 24px rgba(220, 38, 38, 0.5);
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div class="hazard-stripe-top"></div>
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>

    <!-- Top Breaking Bar -->
    <div class="top-breaking-bar">
      <div class="breaking-tag">
        <span class="pulse-dot"></span>
        <span>${script.slide1.category || 'TIN NÓNG'}</span>
      </div>
      <div class="live-time">${script.slide1.timestamp || 'CẬP NHẬT MỚI NHẤT'}</div>
    </div>

    <!-- Bottom Ticker Bar -->
    <div class="bottom-ticker-bar">
      <div class="ticker-left">FINANCIAL NEWS ALERT</div>
      <div class="ticker-right">Theo dõi để nhận tin tức mới nhất</div>
    </div>

    <!-- SCENE 1: INTRO -->
    <div id="scene-intro" class="scene scene-intro">
      <div class="safe-area">
        <div class="intro-wrapper">
          <div class="intro-badge-top">
            <span>🔥 ${script.intro.categoryLabel || 'BẢN TIN KHẨN CẤP'}</span>
          </div>
          <h1 class="intro-headline-text">
            ${script.intro.mainTitle}
          </h1>
          <p class="intro-sub-tagline">
            ${script.intro.tagline || 'Cập nhật những diễn biến kinh tế và chuyển động thị trường chấn động nhất.'}
          </p>
        </div>
      </div>
    </div>

    <!-- SCENE 2: HEADLINE -->
    <div id="scene-headline" class="scene scene-headline">
      <div class="safe-area">
        <div class="card-headline">
          <div class="headline-pill-row">
            <span class="breaking-tag-sm">BREAKING</span>
            <span class="headline-timestamp">THỜI SỰ 24H</span>
          </div>
          <div class="headline-main-text">
            ${script.slide1.headline}
          </div>
          <div class="headline-source-bar">
            <span>⚡ Diễn biến trọng điểm được ghi nhận trong phiên giao dịch hôm nay</span>
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
          <div class="outro-alert-icon">🔔</div>
          <div class="outro-cta-heading">
            ${script.outro.ctaText || 'Đăng ký kênh để không bỏ lỡ tin nóng!'}
          </div>
          <div class="outro-subtext">
            ${script.outro.subText || 'Cập nhật tin tức tài chính, kinh tế & thị trường mỗi ngày.'}
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
