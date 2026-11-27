import { VideoSlideScript } from '../../video-script-generator';
import { TemplateRenderOptions, VideoTemplateDefinition } from './types';
import { calculateVideoDuration, paginateContentFragments } from './index';

export const emeraldWealthTemplate: VideoTemplateDefinition = {
  id: 'emerald_wealth',
  name: 'Thịnh vượng & Tài chính Hoàng gia',
  nameEn: 'Royal Emerald & Gold',
  tagline: 'Xanh ngọc lục bảo sâu phối ánh kim vàng Gold quý phái, đẳng cấp quỹ đầu tư và private banking',
  badge: 'Thượng lưu',
  category: 'Đầu tư & Thịnh vượng',
  previewColor: 'radial-gradient(circle at 50% 15%, #064E3B 0%, #021B17 85%)',
  accentColor: '#10B981',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  features: [
    'Tone xanh thạch anh ngọc bích `#064E3B` & đen quyền lực',
    'Viền kép mạ vàng Hoàng gia `#F59E0B` & `#FBBF24`',
    'Huy hiệu và biểu tượng tăng trưởng tài sản đẳng cấp',
    'Hoàn hảo cho tin chứng khoán, làm giàu, bất động sản & dòng tiền',
  ],
  render: buildEmeraldWealthHtml,
};

export function buildEmeraldWealthHtml(script: VideoSlideScript, options: TemplateRenderOptions = {}): string {
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
            <div class="block-gold-tag">
              <span class="gold-diamond">◆</span>
              <span class="gold-num">MỤC ${pageIdx * 2 + blockIdx + 1}</span>
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
            <span class="wealth-badge">
              <span class="badge-icon">💎</span>
              DỮ LIỆU ĐẦU TƯ
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
      background: #021B17;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #F8FAFC;
      -webkit-font-smoothing: antialiased;
    }

    .metric-nowrap {
      display: inline-block;
      white-space: nowrap;
      word-break: keep-all;
      color: #FBBF24;
      text-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
      font-weight: 800;
    }

    #viewport {
      position: relative;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 10%, #064E3B 0%, #021612 85%);
      overflow: hidden;
    }

    /* Luxury Gold Border Frame */
    .viewport-outer-frame {
      position: absolute;
      inset: 16px;
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 20px;
      pointer-events: none;
      z-index: 45;
    }

    .viewport-inner-frame {
      position: absolute;
      inset: 22px;
      border: 1px dashed rgba(16, 185, 129, 0.2);
      border-radius: 16px;
      pointer-events: none;
      z-index: 45;
    }

    /* Ambient Emerald Glow */
    .ambient-glow-1 {
      position: absolute;
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 380px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
    }

    .ambient-glow-2 {
      position: absolute;
      bottom: -150px;
      right: -100px;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
      filter: blur(90px);
      pointer-events: none;
    }

    /* Top Bar */
    .top-wealth-bar {
      position: absolute;
      top: 36px;
      left: 42px;
      right: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 40;
    }

    .wealth-brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0.5) 100%);
      border: 1px solid rgba(16, 185, 129, 0.5);
      color: #34D399;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.2);
    }

    .wealth-time {
      font-size: 12px;
      font-weight: 700;
      color: #FBBF24;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    /* Bottom Bar */
    .bottom-wealth-bar {
      position: absolute;
      bottom: 34px;
      left: 42px;
      right: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      border-top: 1px solid rgba(245, 158, 11, 0.2);
      z-index: 40;
    }

    .wealth-footer-left {
      font-size: 11px;
      font-weight: 700;
      color: #FBBF24;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .wealth-footer-right {
      font-size: 11px;
      font-weight: 600;
      color: #94A3B8;
    }

    /* Safe Area */
    .safe-area {
      position: absolute;
      top: 100px;
      bottom: 90px;
      left: 42px;
      right: 42px;
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

    .intro-gold-crown {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 24px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
      border: 1.5px solid rgba(245, 158, 11, 0.45);
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #FBBF24;
      text-transform: uppercase;
      margin-bottom: 28px;
      box-shadow: 0 4px 20px rgba(245, 158, 11, 0.2);
    }

    .intro-headline-text {
      font-size: 46px;
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: #FFFFFF;
      margin-bottom: 26px;
      text-shadow: 0 8px 30px rgba(0, 0, 0, 0.8);
    }

    .intro-headline-text span {
      background: linear-gradient(135deg, #FBBF24 0%, #34D399 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .intro-sub-tagline {
      font-size: 20px;
      font-weight: 500;
      line-height: 1.45;
      color: #D1D5DB;
      max-width: 580px;
      margin: 0 auto;
    }

    /* SCENE 2: HEADLINE */
    .card-headline {
      background: linear-gradient(180deg, rgba(6, 44, 34, 0.85) 0%, rgba(2, 24, 20, 0.95) 100%);
      border: 2px solid rgba(245, 158, 11, 0.4);
      border-radius: 26px;
      padding: 44px 34px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), inset 0 0 40px rgba(16, 185, 129, 0.08);
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

    .gold-badge-sm {
      padding: 5px 14px;
      background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
      color: #021B17;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.1em;
      border-radius: 6px;
      text-transform: uppercase;
    }

    .headline-timestamp {
      font-size: 13px;
      color: #A7F3D0;
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
      border-top: 1px dashed rgba(245, 158, 11, 0.3);
      font-size: 13px;
      color: #FDE68A;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* SCENE 3..N: CONTENT */
    .content-header {
      margin-bottom: 24px;
    }

    .wealth-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.45);
      border-radius: 6px;
      color: #34D399;
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
      background: linear-gradient(135deg, rgba(6, 40, 32, 0.9) 0%, rgba(2, 20, 16, 0.95) 100%);
      border: 1.5px solid rgba(245, 158, 11, 0.3);
      border-left: 6px solid #F59E0B;
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

    .block-gold-tag {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding-top: 2px;
      flex-shrink: 0;
    }

    .gold-diamond {
      color: #F59E0B;
      font-size: 12px;
      text-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
    }

    .gold-num {
      font-size: 10px;
      font-weight: 800;
      color: #FDE68A;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.05em;
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
      background: linear-gradient(180deg, rgba(8, 50, 40, 0.9) 0%, rgba(2, 22, 18, 0.98) 100%);
      border: 2px solid rgba(245, 158, 11, 0.45);
      border-radius: 28px;
      padding: 50px 36px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    .outro-wealth-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(16, 185, 129, 0.25) 100%);
      border: 2px solid #F59E0B;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 0 0 30px rgba(245, 158, 11, 0.4);
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
      background: linear-gradient(135deg, #F59E0B 0%, #10B981 100%);
      color: #021B17;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.08em;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div class="viewport-outer-frame"></div>
    <div class="viewport-inner-frame"></div>
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>

    <!-- Top Wealth Bar -->
    <div class="top-wealth-bar">
      <div class="wealth-brand-badge">
        <span>👑 ${script.slide1.category || 'TÀI CHÍNH HOÀNG GIA'}</span>
      </div>
      <div class="wealth-time">${script.slide1.timestamp || 'BẢN TIN CAO CẤP'}</div>
    </div>

    <!-- Bottom Wealth Bar -->
    <div class="bottom-wealth-bar">
      <div class="wealth-footer-left">
        <span>◆</span>
        <span>WEALTH & PRIVATE BANKING</span>
      </div>
      <div class="wealth-footer-right">Theo dõi để cập nhật cơ hội đầu tư</div>
    </div>

    <!-- SCENE 1: INTRO -->
    <div id="scene-intro" class="scene scene-intro">
      <div class="safe-area">
        <div class="intro-wrapper">
          <div class="intro-gold-crown">
            <span>✨ ${script.intro.categoryLabel || 'TIÊU ĐIỂM THỊ TRƯỜNG'}</span>
          </div>
          <h1 class="intro-headline-text">
            ${script.intro.mainTitle}
          </h1>
          <p class="intro-sub-tagline">
            ${script.intro.tagline || 'Chiến lược tài chính và góc nhìn thị trường đỉnh cao dành cho nhà đầu tư.'}
          </p>
        </div>
      </div>
    </div>

    <!-- SCENE 2: HEADLINE -->
    <div id="scene-headline" class="scene scene-headline">
      <div class="safe-area">
        <div class="card-headline">
          <div class="headline-pill-row">
            <span class="gold-badge-sm">TIÊU ĐIỂM</span>
            <span class="headline-timestamp">THỊ TRƯỜNG TÀI CHÍNH</span>
          </div>
          <div class="headline-main-text">
            ${script.slide1.headline}
          </div>
          <div class="headline-source-bar">
            <span>📈 Dữ liệu và phân tích chuyên sâu được tổng hợp từ các cơ quan uy tín</span>
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
          <div class="outro-wealth-icon">👑</div>
          <div class="outro-cta-heading">
            ${script.outro.ctaText || 'Đăng ký kênh để đón đầu cơ hội đầu tư!'}
          </div>
          <div class="outro-subtext">
            ${script.outro.subText || 'Cập nhật phân tích tài chính & chuyển động thị trường mỗi ngày.'}
          </div>
          <div class="outro-social-pill">
            <span>THEO DÕI NGAY</span>
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
