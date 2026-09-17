// Data2Pro Extension Popup Logic

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const syncBtn = document.getElementById('syncBtn');
const backendUrlInput = document.getElementById('backendUrl');
const autoSyncToggle = document.getElementById('autoSync');
const logContainer = document.getElementById('logContainer');

// Load stored settings
chrome.storage.local.get(['status', 'logs', 'backendUrl', 'autoSync'], (data) => {
  if (data.status) {
    statusText.textContent = data.status;
    const isBusy = data.status.includes('Sedang') || data.status.includes('memproses');
    statusDot.className = `status-dot ${isBusy ? 'busy' : ''}`;
  }

  if (data.backendUrl) backendUrlInput.value = data.backendUrl;
  if (data.autoSync !== undefined) autoSyncToggle.checked = data.autoSync;

  renderLogs(data.logs || ['Menunggu aktivitas...']);
});

function renderLogs(logs) {
  logContainer.innerHTML = logs
    .slice(0, 20)
    .map((l) => `<div class="log-item">${escapeHtml(l)}</div>`)
    .join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Save backend URL on change
backendUrlInput.addEventListener('blur', () => {
  const url = backendUrlInput.value.trim().replace(/\/$/, '');
  if (url) {
    chrome.storage.local.set({ backendUrl: url });
  }
});

// Save auto sync toggle
autoSyncToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoSync: autoSyncToggle.checked });
});

// Manual sync button
syncBtn.addEventListener('click', () => {
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Menyinkronkan...';

  // Save backend URL before sync
  const url = backendUrlInput.value.trim().replace(/\/$/, '');
  chrome.storage.local.set({ backendUrl: url });

  chrome.runtime.sendMessage({ action: 'START_SYNC' }, (response) => {
    setTimeout(() => {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '⚡ Sinkronisasi Sekarang';
    }, 2000);
  });
});

// Poll storage updates every 1 second for live status & log refresh
setInterval(() => {
  chrome.storage.local.get(['status', 'logs'], (data) => {
    if (data.status) {
      statusText.textContent = data.status;
      const isBusy = data.status.includes('Sedang') || data.status.includes('memproses');
      statusDot.className = `status-dot ${isBusy ? 'busy' : ''}`;
    }
    if (data.logs) {
      renderLogs(data.logs);
    }
  });
}, 1000);
