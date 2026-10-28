// scripts/captureLanding.mjs

// Takes the landing page's pictures of the demo's results list, light and dark,
// into app/_shared/assets/images/landing/. Run by hand against a dev server:
//
//   npm run dev -- -p 3005
//   node scripts/captureLanding.mjs
//
// Playwright isn't a dependency of the app. Point the script at an install:
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright   the package folder
//   CHROMIUM_PATH=/path/to/chrome-headless-shell          a browser it can launch
// Without them it imports `playwright` and uses its own browser.

import { createRequire } from 'node:module';

const BASE = process.env.LANDING_BASE_URL ?? 'http://localhost:3005';
const OUT = new URL('../app/_shared/assets/images/landing/', import.meta.url);
// About the width the landing page shows it at, so its words stay readable there
const VIEWPORT = { width: 720, height: 760 };
// The title, the filters and the first few businesses
const HEIGHT = 620;
const MARGIN = 24;

function stop(message) {
  console.error(message);
  process.exit(1);
}

async function loadPlaywright() {
  const from = process.env.PLAYWRIGHT_MODULE;
  if (from) return createRequire(import.meta.url)(from);
  try {
    return await import('playwright');
  } catch {
    return stop('Playwright not found: set PLAYWRIGHT_MODULE to its package folder');
  }
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function capture(theme, file) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: theme });
  // The theme toggle keeps its choice in localStorage
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
  const res = await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
  if (!res?.ok()) stop(`${BASE}/demo answered ${res?.status() ?? 'nothing'}: is the dev server running?`);
  // The dev server's badge sits over the page
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

  const list = page.locator('section:has(> #results-title)');
  const box = await list.boundingBox();
  if (!box) stop("Couldn't find the results list on /demo");
  const path = new URL(file, OUT).pathname;
  await page.screenshot({
    path,
    fullPage: true,
    clip: { x: box.x - MARGIN, y: box.y - MARGIN, width: box.width + MARGIN * 2, height: HEIGHT },
  });
  console.log(`Wrote ${path}`);
  await page.close();
}

await capture('light', 'resultsLight.png');
await capture('dark', 'resultsDark.png');
await browser.close();
