// Data2Pro Background Service Worker
let isProcessing = false;
let currentTabId = null;
let backendUrl = 'http://localhost:5000';

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    autoSync: true,
    backendUrl: 'http://localhost:5000',
    status: 'Siap digunakan',
    logs: ['Ekstensi Data2Pro berhasil dipasang!']
  });

  // Create alarm INSIDE onInstalled to avoid duplicate creation issues
  chrome.alarms.create('checkPendingKeywords', { periodInMinutes: 1 });
});

// Also create alarm on startup (in case service worker restarts)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get('checkPendingKeywords', (alarm) => {
    if (!alarm) {
      chrome.alarms.create('checkPendingKeywords', { periodInMinutes: 1 });
    }
  });
});

// Ensure alarm exists when service worker wakes up
chrome.alarms.get('checkPendingKeywords', (alarm) => {
  if (!alarm) {
    chrome.alarms.create('checkPendingKeywords', { periodInMinutes: 1 });
  }
});

function addLog(message) {
  const time = new Date().toLocaleTimeString('id-ID');
  const logEntry = `[${time}] ${message}`;
  console.log(logEntry);

  chrome.storage.local.get(['logs'], (data) => {
    const logs = data.logs || [];
    logs.unshift(logEntry);
    chrome.storage.local.set({ logs: logs.slice(0, 30) });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(keyword, category) {
  const encoded = encodeURIComponent(keyword.trim());
  switch (category) {
    case 'video':
      return `https://stock.adobe.com/search/video?k=${encoded}`;
    case 'vector':
      return `https://stock.adobe.com/search/vectors?k=${encoded}`;
    case 'image':
    default:
      return `https://stock.adobe.com/search/images?k=${encoded}`;
  }
}

async function fetchPendingKeywords() {
  try {
    const data = await chrome.storage.local.get(['backendUrl']);
    const baseUrl = (data.backendUrl || backendUrl).replace(/\/$/, '');

    const res = await fetch(`${baseUrl}/api/keywords/pending`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.keywords || [];
  } catch (err) {
    console.error('Failed to fetch pending keywords:', err.message);
    return [];
  }
}

async function updateKeywordResult(id, resultCount, searchUrl) {
  try {
    const data = await chrome.storage.local.get(['backendUrl']);
    const baseUrl = (data.backendUrl || backendUrl).replace(/\/$/, '');

    const res = await fetch(`${baseUrl}/api/keywords/update-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resultCount, searchUrl })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to update keyword result:', err.message);
    return false;
  }
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    chrome.storage.local.set({ status: 'Mengecek antrean keyword...' });
    const pendingList = await fetchPendingKeywords();

    if (pendingList.length === 0) {
      chrome.storage.local.set({ status: 'Tidak ada antrean baru' });
      isProcessing = false;
      return;
    }

    addLog(`${pendingList.length} keyword pending ditemukan. Memulai...`);

    for (let i = 0; i < pendingList.length; i++) {
      const item = pendingList[i];
      const targetUrl = buildSearchUrl(item.keyword, item.category);

      chrome.storage.local.set({
        status: `Memproses (${i + 1}/${pendingList.length}): "${item.keyword}"`
      });
      addLog(`Membuka: "${item.keyword}" (${item.category})...`);

      const tab = await chrome.tabs.create({ url: targetUrl, active: false });
      currentTabId = tab.id;

      const scrapeResult = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ resultCount: null, url: targetUrl });
        }, 15000);

        const listener = (msg, sender) => {
          if (sender.tab && sender.tab.id === currentTabId && msg.action === 'SCRAPE_RESULT') {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(msg);
          }
        };

        chrome.runtime.onMessage.addListener(listener);
      });

      if (currentTabId) {
        await chrome.tabs.remove(currentTabId).catch(() => {});
        currentTabId = null;
      }

      const count = scrapeResult.resultCount !== null ? scrapeResult.resultCount : 0;
      await updateKeywordResult(item.id, count, targetUrl);
      addLog(`✓ "${item.keyword}" → ${count.toLocaleString('id-ID')} hasil`);

      if (i < pendingList.length - 1) {
        await sleep(Math.floor(Math.random() * 1500) + 2000);
      }
    }

    chrome.storage.local.set({ status: 'Semua selesai! ✓' });
    addLog('Semua keyword berhasil disinkronisasi.');
  } catch (err) {
    console.error('Queue processing error:', err);
    addLog(`Error: ${err.message}`);
    chrome.storage.local.set({ status: `Error: ${err.message}` });
  } finally {
    isProcessing = false;
  }
}

// Auto-sync via alarm (minimum 1 minute for MV3)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkPendingKeywords') {
    chrome.storage.local.get(['autoSync'], (data) => {
      if (data.autoSync && !isProcessing) {
        processQueue();
      }
    });
  }
});

// Manual trigger from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SYNC') {
    processQueue();
    sendResponse({ success: true });
  }
  return true; // keep channel open for async
});
