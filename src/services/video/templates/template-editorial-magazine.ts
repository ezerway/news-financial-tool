import { VideoSlideScript } from '../../video-script-generator';
import { TemplateRenderOptions, VideoTemplateDefinition } from './types';
import { calculateVideoDuration, paginateContentFragments } from './index';

export const editorialMagazineTemplate: VideoTemplateDefinition = {
  id: 'editorial_magazine',
  name: 'Tạp chí Sang trọng',
  nameEn: 'Editorial Luxury',
  tagline: 'Phong cách tạp chí tài chính cao cấp (Forbes/FT), viền vàng champagne và kiểu chữ thanh lịch',
  badge: 'Sang trọng',
  category: 'Phân tích & Chuyên sâu',
  previewColor: 'radial-gradient(circle at 50% 12%, #1E1B18 0%, #080C14 80%)',
  accentColor: '#E2B150',
  fontFamily: 'Playfair Display / Georgia / Inter',
  features: [
    'Tone màu vàng Champagne `#E2B150` quý phái trên nền Obsidian',
    'Kiểu chữ tiêu đề mang hơi hướng tạp chí tài chính danh tiếng',
    'Thẻ card viền kép ánh kim thanh mảnh và trang nhã',
    'Tối ưu cho tin tức kinh doanh cao cấp, bất động sản & tài sản lớn',
  ],
  render: buildEditorialMagazineHtml,
};

export function buildEditorialMagazineHtml(script: VideoSlideScript, options: TemplateRenderOptions = {}): string {
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
          <div class="editorial-block page-${pageIdx + 1}-block-${blockIdx + 1}">
            <div class="editorial-accent-pillar"></div>
            <div class="editorial-text">${frag}</div>
          </div>
        `
        )
        .join('\n');

      return `
        <!-- Content Slide ${pageIdx + 1}/${numPages} -->
        <div id="scene-content-${pageIdx + 1}" class="scene scene-content">
          <div class="content-slide-wrapper">
            <div class="editorial-content-header">
              <span class="editorial-header-title">${script.contentSlides[0]?.title || 'GÓC NHÌN & DỮ LIỆU TÀI CHÍNH'}</span>
              <!-- <span class="editorial-header-badge">INSIGHT</span> -->
            </div>
            <div class="content-blocks-container">
              ${blocksHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1.0">
  <title>${script.slide1.headline || 'Financial Insights'}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: #080C14;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #F8FAFC;
      position: relative;
      user-select: none;
      -webkit-font-smoothing: antialiased;
    }

    .luxury-canvas {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 15%, rgba(226, 177, 80, 0.16) 0%, rgba(8, 12, 20, 1) 75%);
      z-index: 1;
    }

    .luxury-frame {
      position: absolute;
      inset: 16px;
      border: 1px solid rgba(226, 177, 80, 0.2);
      border-radius: 20px;
      pointer-events: none;
      z-index: 3;
    }

    .container {
      position: relative;
      z-index: 10;
      width: 100%;
      height: 100%;
      padding: 46px 52px 30px 52px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid rgba(226, 177, 80, 0.3);
      padding-bottom: 18px;
      white-space: nowrap;
      overflow: hidden;
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 18px;
      border-radius: 9999px;
      background: rgba(226, 177, 80, 0.12);
      border: 1px solid rgba(226, 177, 80, 0.45);
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #FDE047;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .live-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background-color: #E2B150;
      box-shadow: 0 0 10px #E2B150;
      flex-shrink: 0;
    }

    .header-category {
      font-size: 19px;
      font-weight: 700;
      color: #CBD5E1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 1;
      min-width: 0;
    }

    .scenes-wrapper {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
    }

    .scene {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: none;
    }

    .scene.active {
      opacity: 1;
      visibility: visible;
    }

    .intro-box {
      text-align: center;
      padding: 30px 20px;
    }

    .intro-tag {
      display: inline-block;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.16em;
      color: #E2B150;
      text-transform: uppercase;
      margin-bottom: 24px;
      padding: 8px 24px;
      border-radius: 9999px;
      background: rgba(226, 177, 80, 0.12);
      border: 1px solid rgba(226, 177, 80, 0.35);
    }

    .intro-title {
      font-size: 76px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 24px;
      background: linear-gradient(135deg, #FFFFFF 20%, #FDE047 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    }

    .intro-tagline {
      font-size: 32px;
      font-weight: 500;
      color: #E2E8F0;
      line-height: 1.45;
      max-width: 600px;
      margin: 0 auto;
    }

    .card-headline {
      background: rgba(13, 19, 33, 0.94);
      border: 1.5px solid rgba(226, 177, 80, 0.35);
      border-radius: 24px;
      padding: 44px 34px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 26px;
    }

    .headline-category {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #FDE047;
      text-transform: uppercase;
    }

    .headline-category svg {
      width: 26px;
      height: 26px;
      flex-shrink: 0;
    }

    .headline-title {
      font-size: 54px;
      font-weight: 900;
      line-height: 1.25;
      color: #FFFFFF;
      letter-spacing: -0.02em;
    }

    .headline-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(226, 177, 80, 0.2);
      padding-top: 22px;
      font-size: 21px;
      color: #94A3B8;
      font-weight: 600;
    }

    .content-slide-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .editorial-content-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(226, 177, 80, 0.25);
    }

    .editorial-header-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #E2B150;
    }

    .editorial-header-badge {
      font-size: 17px;
      font-weight: 800;
      color: #FDE047;
      background: rgba(226, 177, 80, 0.12);
      border: 1px solid rgba(226, 177, 80, 0.35);
      padding: 4px 14px;
      border-radius: 9999px;
      letter-spacing: 0.08em;
    }

    .content-blocks-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    .editorial-block {
      display: flex;
      align-items: stretch;
      background: rgba(13, 19, 33, 0.94);
      border: 1px solid rgba(226, 177, 80, 0.25);
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(16px);
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px);
    }

    .editorial-accent-pillar {
      width: 6px;
      flex-shrink: 0;
      background: linear-gradient(to bottom, #FDE047, #D97706);
    }

    .editorial-text {
      padding: 24px 28px;
      font-size: 38px;
      font-weight: 600;
      line-height: 1.42;
      color: #F8FAFC;
      letter-spacing: -0.01em;
      flex: 1;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .metric-nowrap {
      white-space: nowrap !important;
      display: inline-block !important;
      color: #FDE047 !important;
      font-weight: 900 !important;
      text-shadow: 0 0 12px rgba(253, 224, 71, 0.35) !important;
    }

    .card-outro {
      text-align: center;
      background: rgba(13, 19, 33, 0.96);
      border: 1.5px solid rgba(226, 177, 80, 0.35);
      border-radius: 26px;
      padding: 40px 28px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      width: 100%;
    }

    .outro-thanks {
      font-size: 25px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #E2B150;
    }

    .outro-headline {
      font-size: 42px;
      font-weight: 900;
      line-height: 1.25;
      color: #FFFFFF;
      letter-spacing: -0.02em;
      max-width: 580px;
    }

    .outro-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 18px 34px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #E2B150 0%, #B45309 100%);
      color: #080C14;
      box-shadow: 0 10px 30px rgba(226, 177, 80, 0.4);
      border: 1.5px solid rgba(254, 240, 138, 0.6);
      cursor: pointer;
    }

    .cta-pulse-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #080C14;
    }

    .cta-text {
      font-size: 29px;
      font-weight: 900;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    .cta-arrow {
      width: 26px;
      height: 26px;
      stroke: #080C14;
    }

    .platforms-wrapper {
      margin-top: 10px;
      width: 100%;
      border-top: 1px solid rgba(226, 177, 80, 0.2);
      padding-top: 18px;
      display: flex;
      justify-content: center;
    }

    .platforms-grid {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
    }

    .platform-item {
      width: 62px;
      height: 62px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.05);
      border: 1.5px solid rgba(226, 177, 80, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    }

    .platform-svg {
      width: 32px;
      height: 32px;
    }

    .footer-bar {
      width: 100%;
      padding-top: 8px;
    }

    .progress-track {
      width: 100%;
      height: 5px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }

    .progress-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(to right, #E2B150, #FDE047);
      border-radius: 9999px;
    }
  </style>
</head>
<body>
  <div class="luxury-canvas"></div>
  <div class="luxury-frame"></div>

  <div class="container">
    <div class="header-bar">
      <div class="brand-badge">
        <span class="live-dot"></span>
        <span>FINANCIAL NEWS</span>
      </div>
      <div class="header-category">${script.intro.categoryLabel || 'BẢN TIN THỊ TRƯỜNG'}</div>
    </div>

    <div class="scenes-wrapper">
      <div id="scene-intro" class="scene">
        <div class="intro-box">
          <div class="intro-tag">TRENDING</div>
          <h1 class="intro-title">${script.intro.mainTitle || 'Financial News'}</h1>
          <p class="intro-tagline">${script.intro.tagline || 'Cập nhật chuyển động kinh tế & thị trường'}</p>
        </div>
      </div>

      <div id="scene-headline" class="scene">
        <div class="card-headline">
          <div class="headline-category">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"/>
            </svg>
            <span>${script.slide1.category || 'TIÊU ĐIỂM KINH TẾ'}</span>
          </div>
          <h2 class="headline-title">${script.slide1.headline}</h2>
          <div class="headline-footer">
            <span>CHUYỂN ĐỘNG TRỌNG TÂM</span>
            <span>${script.slide1.timestamp || 'Hôm nay'}</span>
          </div>
        </div>
      </div>

      ${contentScenesHtml}

      <div id="scene-outro" class="scene">
        <div class="card-outro">
          <div class="outro-thanks">Cảm ơn bạn đã theo dõi</div>
          <div class="outro-headline">Đừng bỏ lỡ chuyển động thị trường & tài chính</div>
          
          <div class="outro-cta-btn">
            <span class="cta-pulse-dot"></span>
            <span class="cta-text">Đăng ký để nhận tin mỗi ngày</span>
            <svg class="cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>

          <div class="platforms-wrapper">
            <div class="platforms-grid">
              <div class="platform-item fb" title="Facebook Reels">
                <svg viewBox="0 0 24 24" fill="#1877F2" class="platform-svg">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>

              <div class="platform-item tt" title="TikTok">
                <svg viewBox="0 0 24 24" fill="#FFFFFF" class="platform-svg">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.27 6.27 0 0 0 1.87-4.48V8.69a8.18 8.18 0 0 0 4.9 1.63v-3.63h-1z" />
                </svg>
              </div>

              <div class="platform-item yt" title="YouTube Shorts">
                <svg viewBox="0 0 24 24" fill="#FF0000" class="platform-svg">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>

              <div class="platform-item zalo" title="Zalo Video">
                <svg viewBox="0 0 24 24" fill="#0068FF" class="platform-svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.48 5.43 3.79 7.04-.16 1.25-.77 3.16-.81 3.25-.06.18.08.36.27.32 1.63-.33 3.68-1.12 4.55-1.51.72.16 1.45.25 2.2.25 5.52 0 10-4.03 10-9s-4.48-9-10-9zm-4.2 13.5l4.6-6H8.2V7.7h6.2v1.7l-4.6 6h4.8v1.8H7.8v-1.7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <div class="progress-track">
        <div id="progress-fill" class="progress-fill"></div>
      </div>
    </div>
  </div>

  <script>
    const DURATION = ${duration};
    const numPages = ${numPages};

    const sceneIntro = document.getElementById('scene-intro');
    const sceneHeadline = document.getElementById('scene-headline');
    const sceneOutro = document.getElementById('scene-outro');
    const progressFill = document.getElementById('progress-fill');
    const contentScenes = Array.from(document.querySelectorAll('.scene-content'));

    function hideAllScenes() {
      if (sceneIntro) {
        sceneIntro.classList.remove('active');
        sceneIntro.style.opacity = '0';
        sceneIntro.style.visibility = 'hidden';
      }
      if (sceneHeadline) {
        sceneHeadline.classList.remove('active');
        sceneHeadline.style.opacity = '0';
        sceneHeadline.style.visibility = 'hidden';
      }
      contentScenes.forEach(function(s) {
        s.classList.remove('active');
        s.style.opacity = '0';
        s.style.visibility = 'hidden';
      });
      if (sceneOutro) {
        sceneOutro.classList.remove('active');
        sceneOutro.style.opacity = '0';
        sceneOutro.style.visibility = 'hidden';
      }
    }

    window.seekTo = function(t) {
      const clamped = Math.max(0, Math.min(DURATION, t));

      if (progressFill) {
        progressFill.style.width = ((clamped / DURATION) * 100) + '%';
      }

      hideAllScenes();

      const contentStartTime = numPages > 1 ? 6.8 : 7.2;
      const outroDuration = 4.5;
      const outroStartTime = DURATION - outroDuration;
      const contentTotalTime = outroStartTime - contentStartTime;
      const timePerPage = contentTotalTime / numPages;

      if (clamped < 3.0) {
        sceneIntro.classList.add('active');
        sceneIntro.style.visibility = 'visible';
        const introProgress = clamped / 3.0;
        const opacity = clamped < 0.4 ? (clamped / 0.4) : (clamped > 2.6 ? (3.0 - clamped) / 0.4 : 1);
        const scale = 0.95 + (introProgress * 0.05);
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

          const blocks = activeScene.querySelectorAll('.editorial-block');
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
