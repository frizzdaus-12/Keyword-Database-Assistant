// Data2Pro Background Service Worker
let isProcessing = false;
let currentTabId = null;
let currentKeywordItem = null;
let backendUrl = 'http://localhost:5000';

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    autoSync: true,
    backendUrl: 'http://localhost:5000',
    status: 'Siap digunakan',
    logs: ['Ekstensi Data2Pro berhasil dipasang!']
  });
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

// Build search URL
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

// Fetch pending keywords from Data2Pro Backend
async function fetchPendingKeywords() {
  try {
    const data = await chrome.storage.local.get(['backendUrl']);
    const baseUrl = data.backendUrl || backendUrl;

    const res = await fetch(`${baseUrl}/api/keywords/pending`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.keywords || [];
  } catch (err) {
    console.error('Failed to fetch pending keywords:', err);
    return [];
  }
}

// Update result count to Backend
async function updateKeywordResult(id, resultCount, searchUrl) {
  try {
    const data = await chrome.storage.local.get(['backendUrl']);
    const baseUrl = data.backendUrl || backendUrl;

    const res = await fetch(`${baseUrl}/api/keywords/update-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resultCount, searchUrl })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to update keyword result:', err);
    return false;
  }
}

// Process single keyword queue
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    chrome.storage.local.set({ status: 'Mengecek antrean keyword...' });
    const pendingList = await fetchPendingKeywords();

    if (pendingList.length === 0) {
      chrome.storage.local.set({ status: 'Tidak ada antrean baru (Semua sudah selesai)' });
      isProcessing = false;
      return;
    }

    addLog(`Ditemukan ${pendingList.length} keyword pending. Memulai proses scraping...`);

    for (let i = 0; i < pendingList.length; i++) {
      const item = pendingList[i];
      currentKeywordItem = item;
      const targetUrl = buildSearchUrl(item.keyword, item.category);

      chrome.storage.local.set({
        status: `Sedang memproses (${i + 1}/${pendingList.length}): "${item.keyword}"`
      });
      addLog(`Membuka: "${item.keyword}" (${item.category})...`);

      // Open background tab (active: false so it doesn't interrupt the user)
      const tab = await chrome.tabs.create({
        url: targetUrl,
        active: false
      });
      currentTabId = tab.id;

      // Wait for content script to send SCRAPE_RESULT or timeout after 12s
      const scrapeResult = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ resultCount: null, url: targetUrl });
        }, 12000);

        const listener = (msg, sender) => {
          if (sender.tab && sender.tab.id === currentTabId && msg.action === 'SCRAPE_RESULT') {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(msg);
          }
        };

        chrome.runtime.onMessage.addListener(listener);
      });

      // Close background tab
      if (currentTabId) {
        await chrome.tabs.remove(currentTabId).catch(() => {});
        currentTabId = null;
      }

      // Update to Supabase via backend
      const count = scrapeResult.resultCount !== null ? scrapeResult.resultCount : 0;
      await updateKeywordResult(item.id, count, targetUrl);

      addLog(`✓ Selesai: "${item.keyword}" -> ${count.toLocaleString('id-ID')} hasil.`);

      // Random delay 2-3.5s before next keyword
      if (i < pendingList.length - 1) {
        await sleep(Math.floor(Math.random() * 1500) + 2000);
      }
    }

    chrome.storage.local.set({ status: 'Semua antrean selesai diproses! ✓' });
    addLog('Semua antrean keyword berhasil disinkronisasi ke Data2Pro.');
  } catch (err) {
    console.error('Queue processing error:', err);
    addLog(`Error: ${err.message}`);
    chrome.storage.local.set({ status: `Terjadi kendala: ${err.message}` });
  } finally {
    isProcessing = false;
  }
}

// Periodic auto-sync alarm every 20 seconds
chrome.alarms.create('checkPendingKeywords', { periodInMinutes: 0.35 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkPendingKeywords') {
    chrome.storage.local.get(['autoSync'], (data) => {
      if (data.autoSync && !isProcessing) {
        processQueue();
      }
    });
  }
});

// Listen for manual triggers from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SYNC') {
    processQueue();
    sendResponse({ success: true, message: 'Sync started' });
  }
});
