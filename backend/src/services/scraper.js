import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin to mask automation flags (navigator.webdriver, chrome.runtime, canvas/WebGL fingerprint, etc.)
chromium.use(stealthPlugin());

let browserInstance = null;

// Pool of modern desktop user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

// Realistic desktop viewports
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get or initialize a shared Chromium browser instance with stealth launch arguments
 */
async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ]
    });
  }
  return browserInstance;
}

/**
 * Build Adobe Stock search URL based on keyword and category
 */
export function buildAdobeStockUrl(keyword, category) {
  const encodedKeyword = encodeURIComponent(keyword.trim());

  switch (category) {
    case 'video':
      return `https://stock.adobe.com/search/video?k=${encodedKeyword}`;
    case 'vector':
      return `https://stock.adobe.com/search/vectors?k=${encodedKeyword}`;
    case 'image':
    default:
      return `https://stock.adobe.com/search/images?k=${encodedKeyword}`;
  }
}

/**
 * Parse string result count (e.g. "1,250,432 results", "45.2K", "320 results") into integer
 */
export function parseResultCount(text) {
  if (!text) return 0;

  const cleanText = text.trim().toLowerCase();

  // Match "12.5k" or "1.2m"
  const kMatch = cleanText.match(/([\d.,]+)\s*k/);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, '.'));
    return Math.round(num * 1000);
  }

  const mMatch = cleanText.match(/([\d.,]+)\s*m/);
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/,/g, '.'));
    return Math.round(num * 1000000);
  }

  // General integer parsing removing punctuation
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (!digitsOnly) return 0;

  return parseInt(digitsOnly, 10);
}

/**
 * Simulate human-like mouse movements and small scrolling behavior
 */
async function simulateHumanInteraction(page, viewport) {
  try {
    const startX = getRandomNumber(100, Math.max(200, viewport.width - 200));
    const startY = getRandomNumber(100, Math.max(200, viewport.height - 200));
    const endX = getRandomNumber(100, Math.max(200, viewport.width - 200));
    const endY = getRandomNumber(100, Math.max(200, viewport.height - 200));

    // 1. Natural mouse move with random interpolation steps
    await page.mouse.move(startX, startY, { steps: getRandomNumber(8, 15) });
    await sleep(getRandomNumber(200, 500));

    // 2. Second subtle mouse move
    await page.mouse.move(endX, endY, { steps: getRandomNumber(10, 20) });
    await sleep(getRandomNumber(300, 600));

    // 3. Natural smooth scroll down (simulating human browsing)
    const scrollAmount = getRandomNumber(150, 350);
    await page.mouse.wheel(0, scrollAmount);
    await sleep(getRandomNumber(500, 900));

    // 4. Subtle scroll back up
    await page.mouse.wheel(0, -Math.floor(scrollAmount * 0.4));
    await sleep(getRandomNumber(300, 700));
  } catch (err) {
    // Non-fatal if interaction simulation encounters an element detach
  }
}

/**
 * Scrape Adobe Stock search results count for a single keyword
 * STRICT ANONYMITY + STEALTH PLUGIN + HUMAN-LIKE BEHAVIOR
 */
export async function scrapeAdobeStockResultCount(keyword, category) {
  const searchUrl = buildAdobeStockUrl(keyword, category);
  const browser = await getBrowser();

  const selectedViewport = getRandomItem(VIEWPORTS);
  const selectedUserAgent = getRandomItem(USER_AGENTS);

  // Create an isolated, anonymous stealth context with randomized fingerprint
  const context = await browser.newContext({
    userAgent: selectedUserAgent,
    viewport: selectedViewport,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    },
    // Strictly no stored cookies or user profiles
    storageState: undefined
  });

  const page = await context.newPage();

  try {
    // Human reading delay before navigation (500ms - 1200ms)
    await sleep(getRandomNumber(500, 1200));

    console.log(`[Stealth Scraper] Navigating to: ${searchUrl}`);

    const response = await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 35000
    });

    const status = response ? response.status() : 0;
    if (status === 403 || status === 429) {
      throw new Error(`BLOCKED_OR_RATE_LIMITED: Received HTTP ${status} from Adobe Stock.`);
    }

    // Check page title and blocking indicators
    const pageTitle = (await page.title()).toLowerCase();
    if (
      pageTitle.includes('access denied') ||
      pageTitle.includes('just a moment') ||
      pageTitle.includes('attention required')
    ) {
      throw new Error('CAPTCHA_OR_BLOCK_DETECTED: Adobe Stock presented a verification challenge.');
    }

    // Check for explicit Cloudflare challenge or captcha elements in DOM
    const hasChallengeElement = await page.evaluate(() => {
      return Boolean(
        document.querySelector('#challenge-running') ||
        document.querySelector('.cf-turnstile') ||
        document.querySelector('#cf-please-wait') ||
        document.querySelector('.g-recaptcha') ||
        document.querySelector('[data-sitekey]')
      );
    });

    if (hasChallengeElement) {
      throw new Error('CAPTCHA_OR_BLOCK_DETECTED: Adobe Stock presented a verification challenge.');
    }

    // Human-like reading and scrolling simulation after DOM load
    await simulateHumanInteraction(page, selectedViewport);

    // Wait a brief human reading pause before reading count (1000ms - 2000ms)
    await sleep(getRandomNumber(1000, 2000));

    let extractedCount = null;

    // Selector strategies for Adobe Stock result counter
    const selectors = [
      '[data-t="search-results-total"]',
      '.search-result-count',
      '.results-count',
      '[class*="result-count"]',
      '[class*="resultsCount"]',
      '[class*="SearchResultsCount"]',
      'main span[class*="count"]',
      'h1 span'
    ];

    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          const text = await el.innerText();
          if (text && (text.match(/\d/) || text.toLowerCase().includes('result'))) {
            extractedCount = parseResultCount(text);
            console.log(`[Stealth Scraper] Found count with selector '${selector}': "${text}" -> ${extractedCount}`);
            break;
          }
        }
      } catch (err) {
        // continue to next selector
      }
    }

    // Fallback: search through headings or text in main container if selector was not directly matched
    if (extractedCount === null) {
      try {
        const fullBodyText = await page.evaluate(() => (document.body ? document.body.innerText : ''));

        if (
          fullBodyText.toLowerCase().includes('no results') ||
          fullBodyText.toLowerCase().includes('0 results') ||
          fullBodyText.toLowerCase().includes('tidak ada hasil')
        ) {
          extractedCount = 0;
        } else {
          const match = fullBodyText.match(/([\d,.]+)\s+(?:results|photos|videos|vectors|assets|hasil)/i);
          if (match && match[1]) {
            extractedCount = parseResultCount(match[1]);
            console.log(`[Stealth Scraper] Found count via regex text scan: "${match[0]}" -> ${extractedCount}`);
          }
        }
      } catch (err) {
        console.warn(`[Stealth Scraper] Fallback text scan failed: ${err.message}`);
      }
    }

    return {
      success: true,
      keyword,
      category,
      searchUrl,
      resultCount: extractedCount !== null ? extractedCount : 0
    };
  } catch (error) {
    console.error(`[Stealth Scraper Error] Failed for "${keyword}":`, error.message);
    return {
      success: false,
      keyword,
      category,
      searchUrl,
      resultCount: null,
      error: error.message
    };
  } finally {
    // Ensure the anonymous context is ALWAYS destroyed immediately
    await context.close().catch(() => {});
  }
}

/**
 * Utility helper to close browser on server shutdown
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
