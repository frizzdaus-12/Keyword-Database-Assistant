// ============================================================
// Data2Pro Background Service Worker (Manifest V3)
// ============================================================

let isProcessing = false;
let currentTabId = null;

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function getBackendUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['backendUrl'], (data) => {
      resolve((data.backendUrl || 'http://localhost:5000').replace(/\/$/, ''));
    });
  });
}

function addLog(message) {
  const time = new Date().toLocaleTimeString('id-ID');
  const entry = `[${time}] ${message}`;
  console.log(entry);
  chrome.storage.local.get(['logs'], (data) => {
    const logs = Array.isArray(data.logs) ? data.logs : [];
    logs.unshift(entry);
    chrome.storage.local.set({ logs: logs.slice(0, 30) });
  });
}

function setStatus(text) {
  chrome.storage.local.set({ status: text });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(keyword, category) {
  const q = encodeURIComponent(keyword.trim());
  if (category === 'video')  return `https://stock.adobe.com/search/video?k=${q}`;
  if (category === 'vector') return `https://stock.adobe.com/search/vectors?k=${q}`;
  return `https://stock.adobe.com/search/images?k=${q}`;
}

// -----------------------------------------------------------
// API calls to backend
// -----------------------------------------------------------

async function fetchPendingKeywords() {
  try {
    const base = await getBackendUrl();
    const res = await fetch(`${base}/api/keywords/pending`);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.keywords) ? json.keywords : [];
  } catch (err) {
    console.error('[fetchPendingKeywords]', err.message);
    return [];
  }
}

async function updateKeywordResult(id, resultCount, searchUrl) {
  try {
    const base = await getBackendUrl();
    const res = await fetch(`${base}/api/keywords/update-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resultCount, searchUrl })
    });
    return res.ok;
  } catch (err) {
    console.error('[updateKeywordResult]', err.message);
    return false;
  }
}

// -----------------------------------------------------------
// Main queue processor
// -----------------------------------------------------------

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    setStatus('Mengecek antrean keyword...');
    const pending = await fetchPendingKeywords();

    if (pending.length === 0) {
      setStatus('Tidak ada antrean baru');
      return;
    }

    addLog(`${pending.length} keyword pending ditemukan. Memulai...`);

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      const targetUrl = buildSearchUrl(item.keyword, item.category);

      setStatus(`Memproses (${i + 1}/${pending.length}): "${item.keyword}"`);
      addLog(`Membuka: "${item.keyword}" (${item.category})...`);

      // Open Adobe Stock in a background tab
      const tab = await chrome.tabs.create({ url: targetUrl, active: false });
      currentTabId = tab.id;

      // Wait for content.js to send SCRAPE_RESULT (max 15s)
      const result = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          resolve({ resultCount: null });
        }, 15000);

        function listener(msg, sender) {
          if (
            msg.action === 'SCRAPE_RESULT' &&
            sender.tab &&
            sender.tab.id === currentTabId
          ) {
            clearTimeout(timer);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(msg);
          }
        }

        chrome.runtime.onMessage.addListener(listener);
      });

      // Close background tab
      if (currentTabId) {
        await chrome.tabs.remove(currentTabId).catch(() => {});
        currentTabId = null;
      }

      const count = result.resultCount !== null ? result.resultCount : 0;
      await updateKeywordResult(item.id, count, targetUrl);
      addLog(`✓ "${item.keyword}" → ${count.toLocaleString('id-ID')} hasil`);

      // Random delay between keywords
      if (i < pending.length - 1) {
        await sleep(2000 + Math.floor(Math.random() * 1500));
      }
    }

    setStatus('Semua antrean selesai! ✓');
    addLog('Semua keyword berhasil disinkronisasi.');
  } catch (err) {
    console.error('[processQueue]', err);
    addLog(`Error: ${err.message}`);
    setStatus(`Error: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

// -----------------------------------------------------------
// Alarm: created once on install, recreated on startup
// -----------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    autoSync:   true,
    backendUrl: 'http://localhost:5000',
    status:     'Siap digunakan',
    logs:       ['Ekstensi Data2Pro berhasil dipasang!']
  });
  // Create periodic alarm (Chrome MV3 minimum = 1 minute)
  chrome.alarms.create('d2p_sync', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get('d2p_sync', (alarm) => {
    if (!alarm) chrome.alarms.create('d2p_sync', { periodInMinutes: 1 });
  });
});

// Recreate alarm if missing (service worker wake-up)
chrome.alarms.get('d2p_sync', (alarm) => {
  if (!alarm) chrome.alarms.create('d2p_sync', { periodInMinutes: 1 });
});

// -----------------------------------------------------------
// Alarm listener
// -----------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'd2p_sync') return;
  chrome.storage.local.get(['autoSync'], (data) => {
    if (data.autoSync && !isProcessing) {
      processQueue().catch((err) => {
        console.error('[alarm] processQueue error:', err);
        addLog(`⚠️ Sync error: ${err.message}`);
      });
    }
  });
});

// -----------------------------------------------------------
// Message listener (from popup)
// -----------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SYNC') {
    processQueue().catch((err) => {
      console.error('[manual] processQueue error:', err);
      addLog(`⚠️ Manual sync error: ${err.message}`);
    });
    sendResponse({ success: true });
  }
  return true;
});
