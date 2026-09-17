// Data2Pro Content Script for Adobe Stock (Optimized & Robust)
console.log('[Data2Pro] Content script active on:', window.location.href);

/**
 * Clean and parse numeric search result counts
 * Supports formats: "3.547.489 results", "4,521,890", "1.2M", "450K", "0 results"
 */
function parseResultCount(text) {
  if (!text) return null;
  const clean = text.trim().replace(/\s+/g, ' ');

  // Discard irrelevant strings (filters, pagination, cart, prices, ratings)
  const blacklist = /\b(filter|cart|keranjang|selected|pilihan|page|halaman|rating|bintang|review|price|harga|rp|\$|download|unduh)\b/i;
  if (blacklist.test(clean)) {
    return null;
  }

  // Explicit 0 results pattern
  if (/\b(no results?|0 results?|0 hasil|tidak ada hasil|0 assets?|0 photos?|0 videos?|0 vectors?)\b/i.test(clean)) {
    return 0;
  }

  // Millions: "1.2M", "1,2 M", "3.4M results"
  const mMatch = clean.match(/([\d.,]+)\s*[Mm]\b/);
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/,/g, '.'));
    if (!isNaN(num)) return Math.round(num * 1_000_000);
  }

  // Thousands: "450K", "12.5k results"
  const kMatch = clean.match(/([\d.,]+)\s*[Kk]\b/);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, '.'));
    if (!isNaN(num)) return Math.round(num * 1_000);
  }

  // Full numbers with dots/commas: e.g. "3.547.489 results", "1,250 results", "350 results"
  const fullMatch = clean.match(/([\d.,]+)\s*(?:results?|hasil|photos?|videos?|vectors?|assets?|items?|item|gambar|vektor)/i);
  if (fullMatch) {
    const raw = fullMatch[1].replace(/[^\d]/g, '');
    if (raw.length > 0) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Plain number if inside a dedicated count selector
  const digitsOnly = clean.replace(/[^\d]/g, '');
  if (digitsOnly.length > 0) {
    const parsed = parseInt(digitsOnly, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

/**
 * Extract result count from Adobe Stock DOM
 */
function extractCount() {
  // 1. Check document title (often contains "keyword - X results | Adobe Stock")
  const title = document.title || '';
  if (title) {
    const titleMatch = title.match(/([\d.,]+)\s*(?:M|K|k|m)?\s*(?:results?|hasil|assets?)/i);
    if (titleMatch) {
      const parsed = parseResultCount(titleMatch[0]);
      if (parsed !== null && parsed > 0) {
        console.log('[Data2Pro] Found count in document.title:', parsed);
        return parsed;
      }
    }
  }

  // 2. High-precision Adobe Stock specific selectors
  const highPrioritySelectors = [
    '[data-t="search-results-total"]',
    '[data-t="search-results-count"]',
    '[data-t="search-header-results-count"]',
    '[data-t="search-results-header-count"]',
    '[data-t="total-results"]',
    '[data-t="result-count"]',
    '[data-t="results-count"]',
    '[data-component="SearchResultsCount"]',
    '[data-component="SearchResultsHeader"]',
    '[data-component="result-count"]',
    '[data-testid="search-results-count"]',
    '[data-testid="search-results-total"]',
    '.search-result-count',
    '.results-count',
    '.search-results-title',
    '.search-total'
  ];

  for (const sel of highPrioritySelectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = (el.innerText || el.textContent || '').trim();
        if (!text) continue;
        const count = parseResultCount(text);
        if (count !== null) {
          console.log(`[Data2Pro] Found via high-priority selector "${sel}": "${text}" → ${count}`);
          return count;
        }
      }
    } catch (_) {}
  }

  // 3. Search Headers & Headings
  const headings = document.querySelectorAll('h1, h2, [role="heading"], main h1, header h1');
  for (const h of headings) {
    const text = (h.innerText || h.textContent || '').trim();
    if (!text || text.length > 120) continue;
    if (/(?:results?|hasil|photos?|videos?|vectors?|assets?)/i.test(text)) {
      const count = parseResultCount(text);
      if (count !== null) {
        console.log(`[Data2Pro] Found in heading: "${text}" → ${count}`);
        return count;
      }
    }
  }

  // 4. Broad classes and aria labels
  const broadSelectors = [
    '[class*="resultsCount"]',
    '[class*="searchCount"]',
    '[class*="SearchResultsCount"]',
    '[class*="searchResultsHeader"]',
    '[class*="result-count"]',
    '[class*="results-count"]',
    '[aria-label*="result"]',
    '[aria-label*="hasil"]'
  ];

  for (const sel of broadSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
        if (!text || text.length > 80) continue;
        const count = parseResultCount(text);
        if (count !== null) {
          console.log(`[Data2Pro] Found via broad selector "${sel}": "${text}" → ${count}`);
          return count;
        }
      }
    } catch (_) {}
  }

  // 5. Check if page clearly states 0 results
  const bodyText = document.body ? document.body.innerText : '';
  if (/\b(no results found|0 results found|tidak ada hasil|we couldn't find any results)\b/i.test(bodyText)) {
    console.log('[Data2Pro] Zero results confirmed via body text scan.');
    return 0;
  }

  return null;
}

function sendResult(count) {
  chrome.runtime.sendMessage({
    action: 'SCRAPE_RESULT',
    resultCount: count,
    url: window.location.href
  });
}

// Fast polling strategy: every 300ms, up to 15 attempts (4.5s max)
let attempts = 0;
const MAX_ATTEMPTS = 15;

const poll = setInterval(() => {
  attempts++;
  const count = extractCount();

  if (count !== null) {
    console.log(`[Data2Pro] Result identified on attempt ${attempts}:`, count);
    clearInterval(poll);
    sendResult(count);
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    console.log('[Data2Pro] Max attempts reached without definitive count.');
    clearInterval(poll);
    sendResult(null);
  }
}, 300);
