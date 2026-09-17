import { chromium } from 'playwright';

let browserInstance = null;

/**
 * Get or initialize a shared Chromium browser instance
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
  // Example: "1,450,210 results" -> "1450210"
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (!digitsOnly) return 0;
  
  return parseInt(digitsOnly, 10);
}

/**
 * Scrape Adobe Stock search results count for a single keyword
 * STRICT ANONYMITY: Completely isolated browser context per search, no cookies, no user profile.
 */
export async function scrapeAdobeStockResultCount(keyword, category) {
  const searchUrl = buildAdobeStockUrl(keyword, category);
  const browser = await getBrowser();

  // Create an isolated, anonymous context for EVERY request
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Do not pass storageState, cookies, or user credentials
    storageState: undefined
  });

  const page = await context.newPage();

  // Block unnecessary resources (images, fonts, media) to speed up loading and save bandwidth
  await page.route('**/*', (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (['image', 'media', 'font'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    console.log(`[Scraper] Navigating to: ${searchUrl}`);

    const response = await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const status = response ? response.status() : 0;
    if (status === 403 || status === 429) {
      throw new Error(`BLOCKED_OR_RATE_LIMITED: Received HTTP ${status} from Adobe Stock.`);
    }

    // Check for captcha or challenge in page content
    const pageContent = await page.content();
    if (
      pageContent.includes('captcha') ||
      pageContent.includes('Access Denied') ||
      pageContent.includes('challenge-running') ||
      pageContent.includes('Cloudflare')
    ) {
      throw new Error('CAPTCHA_OR_BLOCK_DETECTED: Adobe Stock presented a verification challenge.');
    }

    // Wait for result count element or page body render
    let extractedCount = null;

    // Selector strategies for Adobe Stock result counter
    const selectors = [
      '[data-t="search-results-total"]',
      '.search-result-count',
      '.results-count',
      'h1 span',
      '[class*="result-count"]',
      '[class*="resultsCount"]',
      'main span[class*="count"]'
    ];

    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          const text = await el.innerText();
          if (text && (text.match(/\d/) || text.toLowerCase().includes('result'))) {
            extractedCount = parseResultCount(text);
            console.log(`[Scraper] Found count with selector '${selector}': "${text}" -> ${extractedCount}`);
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
        const fullBodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
        
        // Match patterns like "1,234,567 results" or "No results found" or "0 results"
        if (fullBodyText.toLowerCase().includes('no results') || fullBodyText.toLowerCase().includes('0 results')) {
          extractedCount = 0;
        } else {
          const match = fullBodyText.match(/([\d,.]+)\s+(?:results|photos|videos|vectors|assets)/i);
          if (match && match[1]) {
            extractedCount = parseResultCount(match[1]);
            console.log(`[Scraper] Found count via regex text search: "${match[0]}" -> ${extractedCount}`);
          }
        }
      } catch (err) {
        console.warn(`[Scraper] Fallback text scan failed: ${err.message}`);
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
    console.error(`[Scraper Error] Failed to scrape "${keyword}":`, error.message);
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
