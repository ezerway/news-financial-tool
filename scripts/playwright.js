const { chromium } = require('playwright');

/**
 * CLI helper to fetch rendered HTML from a URL using Playwright Chromium.
 * Refactored to eliminate memory leaks, zombie Chromium processes, and high RAM usage.
 *
 * Usage:
 *   node scripts/playwright.js "https://example.com" "body"
 *   node scripts/playwright.js --url="https://example.com" --selector="body"
 */

function parseArgs() {
  let url = '';
  let selector = '';

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--url=')) {
      url = arg.slice(6).trim();
    } else if (arg.startsWith('--selector=')) {
      selector = arg.slice(11).trim();
    } else if (!url && !arg.startsWith('-')) {
      url = arg.trim();
    } else if (!selector && !arg.startsWith('-')) {
      selector = arg.trim();
    }
  }

  // Strip wrapping quotes if passed through shell literally
  if (url.startsWith('"') && url.endsWith('"')) url = url.slice(1, -1);
  if (selector.startsWith('"') && selector.endsWith('"')) selector = selector.slice(1, -1);

  return { url, selector };
}

async function main() {
  const { url, selector } = parseArgs();

  if (!url) {
    console.error('Error: Tham số url bị thiếu (Missing required url parameter)');
    console.error('Usage: node scripts/playwright.js <url> [selector]');
    process.exit(1);
  }

  let browser = null;
  let context = null;
  let page = null;

  // Cleanup handler for early terminations / signals to prevent orphan zombie processes
  const handleSignal = async (signal) => {
    try {
      if (page && !page.isClosed()) await page.close().catch(() => { });
      if (context) await context.close().catch(() => { });
      if (browser && browser.isConnected()) await browser.close().catch(() => { });
    } finally {
      process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
    }
  };

  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  try {
    // Launch Chromium with low-memory & sandbox-safe flags
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm (avoids memory starvation crash)
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-breakpad',
        '--disable-sync',
        '--disable-translate',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    // Create an isolated lightweight context
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    page = await context.newPage();

    // Abort heavy unnecessary resources (images, fonts, media, websocket) to minimize memory
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'websocket'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    if (selector) {
      await page.waitForSelector(selector, { timeout: 4000 }).catch(() => { });
    } else {
      await page.waitForLoadState('load', { timeout: 3000 }).catch(() => { });
    }

    let html;
    if (selector) {
      html = await page.$eval(selector, (el) => el.innerHTML);
    } else {
      html = await page.content();
    }

    console.log(html);
  } catch (err) {
    console.error('Lỗi khi thực thi playwright.js:', err.message || err);
    process.exitCode = 1;
  } finally {
    // Explicitly release all resources in reverse order to avoid memory leaks
    if (page && !page.isClosed()) {
      await page.close().catch(() => { });
      page = null;
    }
    if (context) {
      await context.close().catch(() => { });
      context = null;
    }
    if (browser && browser.isConnected()) {
      await browser.close().catch(() => { });
      browser = null;
    }
  }
}

main();
