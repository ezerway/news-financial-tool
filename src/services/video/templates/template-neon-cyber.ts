import { VideoSlideScript } from '../../video-script-generator';
import { TemplateRenderOptions, VideoTemplateDefinition } from './types';

export const neonCyberTemplate: VideoTemplateDefinition = {
  id: 'neon_cyber',
  name: 'Cyberpunk Neon',
  nameEn: 'Cyberpunk Fintech',
  tagline: 'Phong cách công nghệ cao với viền neon Cyan & Pink, nền dark space và hiệu ứng kính mờ glassmorphism',
  badge: 'Fintech AI',
  category: 'Công nghệ & Fintech',
  previewColor: 'radial-gradient(circle at 50% 15%, #18052B 0%, #06020C 85%)',
  accentColor: '#06B6D4',
  fontFamily: 'Space Grotesk / JetBrains Mono',
  features: [
    'Tone tím đen công nghệ tương lai `#06020C`',
    'Hiệu ứng viền Neon Cyan `#06B6D4` & Magenta `#EC4899` phản quang',
    'Thẻ card kính mờ Glassmorphism sang chảnh sắc sảo',
    'Rất phù hợp cho xu hướng AI, FinTech, Crypto & Đổi mới sáng tạo',
  ],
  render: buildNeonCyberHtml,
};

export function buildNeonCyberHtml(script: VideoSlideScript, options: TemplateRenderOptions = {}): string {
  const width = options.width || 720;
  const height = options.height || 1280;
  const duration = options.duration || 20;

  const allFragments: string[] = [];
  for (const cs of script.contentSlides || []) {
    for (const f of cs.fragments || []) {
      if (f && f.trim()) {
        allFragments.push(f.trim());
      }
    }
  }

  const maxBlocksPerSlide = 2;
  const slidePages: string[][] = [];
  for (let i = 0; i < allFragments.length; i += maxBlocksPerSlide) {
    slidePages.push(allFragments.slice(i, i + maxBlocksPerSlide));
  }
  if (slidePages.length === 0) {
    slidePages.push(['Dữ liệu công nghệ tài chính đang được cập nhật liên tục từ các nguồn chính thống.']);
  }

  const numPages = slidePages.length;

  const contentScenesHtml = slidePages
    .map((pageFragments, pageIdx) => {
      const blocksHtml = pageFragments
        .map(
          (frag, blockIdx) => `
          <div class="content-block page-${pageIdx + 1}-block-${blockIdx + 1}">
            <div class="block-indicator">
              <span class="block-pulse"></span>
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
            <span class="content-badge">FINTECH INTEL</span>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html, body {
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #06020C;
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
      color: #F8FAFC;
      -webkit-font-smoothing: antialiased;
    }

    .metric-nowrap {
      display: inline-block;
      white-space: nowrap;
      word-break: keep-all;
      color: #06B6D4;
      text-shadow: 0 0 16px rgba(6, 182, 212, 0.6);
      font-weight: 800;
    }

    #viewport {
      position: relative;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 15%, #18052B 0%, #06020C 85%);
      overflow: hidden;
    }

    /* Ambient Cyber Glow & Grid */
    .cyber-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px);
      background-size: 54px 54px;
      opacity: 0.7;
      pointer-events: none;
    }

    .ambient-glow-1 {
      position: absolute;
      top: -150px;
      right: -100px;
      width: 480px;
      height: 480px;
      background: radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
    }

    .ambient-glow-2 {
      position: absolute;
      bottom: -150px;
      left: -100px;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, transparent 70%);
      filter: blur(90px);
      pointer-events: none;
    }

    .scan-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #06B6D4, #EC4899, transparent);
      box-shadow: 0 0 16px #06B6D4;
      opacity: 0.6;
      pointer-events: none;
      z-index: 20;
    }

    /* Header vĩnh cửu */
    .header-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 74px;
      padding: 0 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 50;
      background: rgba(6, 2, 12, 0.85);
      border-bottom: 1px solid rgba(6, 182, 212, 0.25);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .brand-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #06B6D4;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.4);
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
    }

    .brand-badge::before {
      content: '';
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #06B6D4;
      box-shadow: 0 0 8px #06B6D4;
    }

    .header-clock {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #94A3B8;
      letter-spacing: 1.5px;
    }

    /* Footer vĩnh cửu */
    .footer-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 48px;
      padding: 0 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 50;
      background: rgba(6, 2, 12, 0.9);
      border-top: 1px solid rgba(6, 182, 212, 0.2);
    }

    .progress-track {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      overflow: hidden;
      margin-right: 18px;
    }

    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #06B6D4, #EC4899);
      box-shadow: 0 0 10px #06B6D4;
      border-radius: 999px;
    }

    .footer-terminal {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
      letter-spacing: 1px;
    }
    .footer-terminal span {
      color: #06B6D4;
    }

    /* SCENE CƠ BẢN */
    .scene {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: translateY(24px) scale(0.98);
      transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      z-index: 10;
    }

    .scene.active {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .safe-area {
      width: 100%;
      height: 100%;
      padding: 98px 34px 68px 34px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    /* SCENE INTRO */
    .intro-box {
      background: rgba(15, 10, 26, 0.7);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 26px;
      padding: 44px 34px;
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(6, 182, 212, 0.1);
      position: relative;
    }

    .intro-tag {
      display: inline-flex;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #EC4899;
      background: rgba(236, 72, 153, 0.12);
      border: 1px solid rgba(236, 72, 153, 0.35);
      padding: 6px 14px;
      border-radius: 8px;
      margin-bottom: 22px;
      text-transform: uppercase;
    }

    .intro-title {
      font-size: 40px;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: -0.5px;
      color: #FFFFFF;
      margin-bottom: 18px;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    }

    .intro-desc {
      font-size: 20px;
      font-weight: 500;
      line-height: 1.5;
      color: #CBD5E1;
    }

    /* SCENE HEADLINE */
    .headline-box {
      background: rgba(15, 10, 26, 0.75);
      border: 1px solid rgba(6, 182, 212, 0.35);
      border-left: 6px solid #06B6D4;
      border-radius: 22px;
      padding: 38px 30px;
      backdrop-filter: blur(26px);
      -webkit-backdrop-filter: blur(26px);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6);
    }

    .headline-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 800;
      color: #06B6D4;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 16px;
      display: inline-block;
    }

    .headline-main {
      font-size: 34px;
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: -0.5px;
      color: #FFFFFF;
      margin-bottom: 14px;
    }

    .headline-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #94A3B8;
      font-weight: 600;
    }

    /* SCENE CONTENT */
    .content-header {
      margin-bottom: 24px;
    }

    .content-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #06B6D4;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 12px;
    }

    .content-header-title {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: -0.3px;
      color: #FFFFFF;
    }

    .content-blocks-wrap {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .content-block {
      background: rgba(15, 10, 26, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-top: 1px solid rgba(6, 182, 212, 0.35);
      border-radius: 20px;
      padding: 24px 22px;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
      display: flex;
      gap: 16px;
      align-items: flex-start;
      position: relative;
      overflow: hidden;
    }

    .content-block::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #06B6D4, #EC4899);
    }

    .block-indicator {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .block-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #06B6D4;
      box-shadow: 0 0 8px #06B6D4;
    }

    .block-body {
      flex: 1;
    }

    .block-text {
      font-size: 20px;
      line-height: 1.5;
      font-weight: 500;
      color: #F1F5F9;
    }

    /* SCENE OUTRO */
    .outro-card {
      background: rgba(15, 10, 26, 0.78);
      border: 1px solid rgba(6, 182, 212, 0.35);
      border-radius: 28px;
      padding: 42px 30px;
      text-align: center;
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.65);
    }

    .outro-thanks {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #06B6D4;
      margin-bottom: 14px;
      text-shadow: 0 0 12px rgba(6, 182, 212, 0.5);
    }

    .outro-title {
      font-size: 32px;
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: -0.5px;
      color: #FFFFFF;
      margin-bottom: 24px;
    }

    .outro-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #06B6D4 0%, #0284C7 100%);
      color: #06020C;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 16px 36px;
      border-radius: 999px;
      box-shadow: 0 0 30px rgba(6, 182, 212, 0.45);
      margin-bottom: 28px;
      border: 1px solid rgba(255, 255, 255, 0.4);
    }

    .outro-platforms {
      display: flex;
      justify-content: center;
      gap: 16px;
    }

    .platform-icon-item {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    }

    .platform-icon-item svg {
      width: 26px;
      height: 26px;
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div class="cyber-grid"></div>
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>
    <div class="scan-line" id="scanLine"></div>

    <!-- HEADER VĨNH CỬU -->
    <div class="header-bar">
      <div class="brand-wrap">
        <div class="brand-badge">CYBER INTEL</div>
      </div>
      <div class="header-clock" id="timerCode">00:00</div>
    </div>

    <!-- FOOTER VĨNH CỬU -->
    <div class="footer-bar">
      <div class="progress-track">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="footer-terminal">NODE: <span>ACTIVE</span></div>
    </div>

    <!-- SCENE 1: INTRO -->
    <div id="scene-intro" class="scene active">
      <div class="safe-area">
        <div class="intro-box">
          <div class="intro-tag">${script.intro.categoryLabel || 'BẢN TIN FINTECH'}</div>
          <div class="intro-title">${script.intro.mainTitle}</div>
          <div class="intro-desc">${script.intro.tagline}</div>
        </div>
      </div>
    </div>

    <!-- SCENE 2: HEADLINE -->
    <div id="scene-headline" class="scene">
      <div class="safe-area">
        <div class="headline-box">
          <div class="headline-pill">${script.slide1.category || 'TIÊU ĐIỂM CÔNG NGHỆ'}</div>
          <div class="headline-main">${script.slide1.headline}</div>
          <div class="headline-time">${script.slide1.timestamp || 'Cập nhật trực tiếp'}</div>
        </div>
      </div>
    </div>

    <!-- SCENES: CONTENT -->
    ${contentScenesHtml}

    <!-- SCENE CUỐI: OUTRO -->
    <div id="scene-outro" class="scene">
      <div class="safe-area">
        <div class="outro-card">
          <div class="outro-thanks">CẢM ƠN BẠN ĐÃ THEO DÕI</div>
          <div class="outro-title">${script.intro.mainTitle}</div>
          <div class="outro-cta-btn">Đăng ký để nhận tin mỗi ngày</div>
          <div class="outro-platforms">
            <!-- Facebook -->
            <div class="platform-icon-item" title="Facebook">
              <svg viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <!-- TikTok -->
            <div class="platform-icon-item" title="TikTok">
              <svg viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.89 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3 15.67 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.34-6.33V9.05a7.97 7.97 0 0 0 4.91 1.74V7.32a4.85 4.85 0 0 1-1-.63z"/>
              </svg>
            </div>
            <!-- YouTube Shorts -->
            <div class="platform-icon-item" title="YouTube Shorts">
              <svg viewBox="0 0 24 24" fill="#FF0000">
                <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73z"/>
              </svg>
            </div>
            <!-- Zalo Video -->
            <div class="platform-icon-item" title="Zalo Video">
              <svg viewBox="0 0 24 24" fill="#0068FF">
                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.5 5.42 3.84 7.02l-.84 3.08c-.1.37.26.7.61.55l3.58-1.54c.9.27 1.84.42 2.81.42 5.52 0 10-4.03 10-9s-4.48-9-10-9zm-1.8 12.8h-2.4v-1.6l2.4-3.2v-1.6h-3.6v1.6h2.4l-2.4 3.2v1.6h3.6v-1.6zm5.6 0h-1.6v-6.4h1.6v6.4z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const totalDuration = ${duration};
    const introDuration = 4;
    const headlineDuration = 4;
    const outroDuration = 5;
    const numPages = ${numPages};
    const contentTotalDuration = totalDuration - introDuration - headlineDuration - outroDuration;
    const contentPageDuration = contentTotalDuration / numPages;

    function hideAllScenes() {
      const scenes = document.querySelectorAll('.scene');
      scenes.forEach(s => s.classList.remove('active'));
    }

    function formatTimeCode(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    window.seekTo = function(seconds) {
      const clamped = Math.max(0, Math.min(seconds, totalDuration));
      
      const pFill = document.getElementById('progressFill');
      if (pFill) {
        const percent = (clamped / totalDuration) * 100;
        pFill.style.width = percent + '%';
      }

      const timerEl = document.getElementById('timerCode');
      if (timerEl) {
        timerEl.textContent = formatTimeCode(clamped);
      }

      const scanLine = document.getElementById('scanLine');
      if (scanLine) {
        const percent = ((clamped % 3) / 3) * 100;
        scanLine.style.top = percent + '%';
      }

      hideAllScenes();

      if (clamped < introDuration) {
        const intro = document.getElementById('scene-intro');
        if (intro) intro.classList.add('active');
      } else if (clamped < introDuration + headlineDuration) {
        const headline = document.getElementById('scene-headline');
        if (headline) headline.classList.add('active');
      } else if (clamped < totalDuration - outroDuration) {
        const contentElapsed = clamped - (introDuration + headlineDuration);
        const pageIdx = Math.min(Math.floor(contentElapsed / contentPageDuration), numPages - 1);
        const content = document.getElementById('scene-content-' + (pageIdx + 1));
        if (content) content.classList.add('active');
      } else {
        const outro = document.getElementById('scene-outro');
        if (outro) outro.classList.add('active');
      }
    };

    window.seekTo(0);

    if (window.__AUTO_PLAY__) {
      let startTime = null;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;
        window.seekTo(elapsed);
        if (elapsed < totalDuration) {
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    }
  </script>
</body>
</html>`;
}
