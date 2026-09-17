// Data2Pro Content Script for Adobe Stock
console.log('[Data2Pro] Content script active on:', window.location.href);

function parseResultCount(text) {
  if (!text) return null;
  const clean = text.trim().replace(/\s+/g, ' ');

  // Format: "1.2M results", "1,200,000"
  const mMatch = clean.match(/([\d.,]+)\s*[Mm]/);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1].replace(/,/g, '')) * 1_000_000);
  }

  // Format: "300K results"
  const kMatch = clean.match(/([\d.,]+)\s*[Kk]/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(/,/g, '')) * 1_000);
  }

  // Raw number
  const digits = clean.replace(/[^\d]/g, '');
  return digits.length > 0 ? parseInt(digits, 10) : null;
}

function extractCount() {
  // Adobe Stock result selectors (ordered by reliability)
  const selectors = [
    // Specific data-attributes
    '[data-t="search-results-total"]',
    '[data-component="SearchResultsCount"]',
    '[data-component="result-count"]',
    // Class-based
    '.search-result-count',
    '.results-count',
    '.resultCount',
    '[class*="result-count"]',
    '[class*="resultsCount"]',
    '[class*="SearchResultsCount"]',
    '[class*="search-count"]',
    '[class*="totalCount"]',
    // Generic heading/span patterns
    'main h1',
    'main span[class*="count"]',
    'header span[class*="count"]',
    'h1 span',
    // Aria
    '[aria-label*="result"]',
    '[aria-live] span',
  ];

  for (const sel of selectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = (el.innerText || el.textContent || '').trim();
        if (!text || text.length > 80) continue; // skip long prose
        if (/\d/.test(text)) {
          const count = parseResultCount(text);
          if (count !== null && count >= 0) {
            console.log(`[Data2Pro] Found via "${sel}": "${text}" → ${count}`);
            return count;
          }
        }
      }
    } catch (_) {}
  }

  // Last-resort: regex on full body text
  const body = document.body ? document.body.innerText : '';

  if (/\b(no results|0 results|tidak ada hasil)\b/i.test(body)) return 0;

  const bodyMatch = body.match(/([\d,. ]+)\s*(results?|photos?|videos?|vectors?|assets?|items?|hasil)/i);
  if (bodyMatch) {
    const count = parseResultCount(bodyMatch[1]);
    if (count !== null) {
      console.log('[Data2Pro] Found via body-regex:', count);
      return count;
    }
  }

  return null;
}

function sendResult(count) {
  chrome.runtime.sendMessage({
    action: 'SCRAPE_RESULT',
    resultCount: count !== null ? count : 0,
    url: window.location.href
  });
}

// Strategy: poll every 400ms up to 6 seconds total for the result element
let attempts = 0;
const MAX_ATTEMPTS = 15; // 15 × 400ms = 6 seconds max

const poll = setInterval(() => {
  attempts++;
  const count = extractCount();

  if (count !== null) {
    console.log('[Data2Pro] Result found on attempt', attempts, ':', count);
    clearInterval(poll);
    sendResult(count);
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    console.log('[Data2Pro] Max attempts reached. Sending 0.');
    clearInterval(poll);
    sendResult(0);
  }
}, 400);
