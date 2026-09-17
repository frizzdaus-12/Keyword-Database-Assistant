// Data2Pro Content Script for Adobe Stock
console.log('[Data2Pro Helper] Content script active on:', window.location.href);

function parseResultCount(text) {
  if (!text) return 0;
  const clean = text.trim().toLowerCase();

  const kMatch = clean.match(/([\d.,]+)\s*k/);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, '.'));
    return Math.round(num * 1000);
  }

  const mMatch = clean.match(/([\d.,]+)\s*m/);
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/,/g, '.'));
    return Math.round(num * 1000000);
  }

  const digits = text.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function extractCount() {
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
    const el = document.querySelector(selector);
    if (el) {
      const text = el.innerText || el.textContent;
      if (text && (text.match(/\d/) || text.toLowerCase().includes('result') || text.toLowerCase().includes('hasil'))) {
        return parseResultCount(text);
      }
    }
  }

  // Fallback regex search on body text
  const bodyText = document.body ? document.body.innerText : '';
  if (bodyText.toLowerCase().includes('no results') || bodyText.toLowerCase().includes('0 results') || bodyText.toLowerCase().includes('tidak ada hasil')) {
    return 0;
  }

  const match = bodyText.match(/([\d,.]+)\s+(?:results|photos|videos|vectors|assets|hasil)/i);
  if (match && match[1]) {
    return parseResultCount(match[1]);
  }

  return null;
}

// Allow dynamic rendering to finish
setTimeout(() => {
  let count = extractCount();
  console.log('[Data2Pro Helper] Extracted result count:', count);

  // If not immediately found, try once more after a brief delay
  if (count === null) {
    setTimeout(() => {
      count = extractCount();
      console.log('[Data2Pro Helper] Second attempt count:', count);
      chrome.runtime.sendMessage({
        action: 'SCRAPE_RESULT',
        resultCount: count !== null ? count : 0,
        url: window.location.href
      });
    }, 1500);
  } else {
    chrome.runtime.sendMessage({
      action: 'SCRAPE_RESULT',
      resultCount: count,
      url: window.location.href
    });
  }
}, 1000);
