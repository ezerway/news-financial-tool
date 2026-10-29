const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Crisp SVG with TrendPulse flame & gradient background
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <linearGradient id="flameGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="innerGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="24" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background rounded squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)"/>
  <rect width="504" height="504" x="4" y="4" rx="111" fill="none" stroke="rgba(99, 102, 241, 0.4)" stroke-width="4"/>
  <rect width="504" height="250" x="4" y="4" rx="111" fill="url(#innerGlow)" opacity="0.6"/>

  <!-- Glowing Pulse Flame Icon -->
  <g transform="translate(106, 96)" filter="url(#glow)">
    <!-- Lucide-style Flame -->
    <path
      d="M150 0C150 0 110 50 110 110C110 135 125 155 145 165C90 145 70 85 70 85C70 85 20 155 20 220C20 286.274 73.7258 340 140 340C206.274 340 260 286.274 260 220C260 140 190 70 190 70C190 70 185 100 160 115C160 115 170 50 150 0Z"
      fill="url(#flameGrad)"
    />
    <!-- Inner Core Highlight -->
    <path
      d="M140 180C140 180 115 205 115 235C115 248.8 126.2 260 140 260C153.8 260 165 248.8 165 235C165 205 140 180 140 180Z"
      fill="#ffffff"
      opacity="0.9"
    />
  </g>
</svg>
`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon.trim());

async function generatePngs() {
  const svgBuffer = Buffer.from(svgIcon);

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Generated icon-192x192.png');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Generated icon-512x512.png');

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Maskable icon (with extra padding)
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#0b0f19'
    })
    .png()
    .toFile(path.join(iconsDir, 'maskable-icon-512x512.png'));
  console.log('Generated maskable-icon-512x512.png');

  // Favicon (32x32 & 48x48)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'favicon.png'));
  console.log('Generated favicon.png');
}

generatePngs().catch(console.error);
