async function init() {
  await loadSettings();
  setupEventListeners();
}

async function loadSettings() {
  // Square API Key
  const keyRes = await chrome.runtime.sendMessage({ action: 'getSquareKey' });
  if (keyRes?.key) {
    document.getElementById('squareKey').value = keyRes.key;
    showKeyStatus('Key configured', 'success');
  }

  // Settings
  const settingsRes = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const s = settingsRes?.settings || {};
  document.getElementById('autoEnrich').checked = s.autoEnrich !== false;
  document.getElementById('hoverTooltip').checked = s.hoverTooltip !== false;
  document.getElementById('defaultTemplate').value = s.defaultTemplate || 'custom-analysis';
  document.getElementById('postSignature').value = s.postSignature || 'via SuperBSC';

  // Watchlist
  const wlRes = await chrome.storage.local.get('watchlist');
  const symbols = wlRes.watchlist || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  document.getElementById('watchlistInput').value = symbols.map(s => s.replace('USDT', '')).join(', ');
}

function setupEventListeners() {
  // Toggle key visibility
  document.getElementById('toggleKey').addEventListener('click', () => {
    const input = document.getElementById('squareKey');
    const btn = document.getElementById('toggleKey');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });

  // Save key
  document.getElementById('saveKey').addEventListener('click', async () => {
    const key = document.getElementById('squareKey').value.trim();
    if (!key) {
      showKeyStatus('Key cannot be empty', 'error');
      return;
    }
    await chrome.runtime.sendMessage({ action: 'saveSquareKey', key });
    showKeyStatus('Key saved', 'success');
  });

  // Auto-save settings on change
  const settingInputs = ['autoEnrich', 'hoverTooltip', 'defaultTemplate', 'postSignature'];
  settingInputs.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', saveSettings);
    if (el.type === 'text') el.addEventListener('blur', saveSettings);
  });

  // Save watchlist
  document.getElementById('saveWatchlist').addEventListener('click', async () => {
    const input = document.getElementById('watchlistInput').value;
    const symbols = input.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).map(s => s.replace(/USDT$/, '') + 'USDT');
    await chrome.runtime.sendMessage({ action: 'saveWatchlist', symbols });
    showKeyStatus('Watchlist saved', 'success');
  });
}

async function saveSettings() {
  const settings = {
    autoEnrich: document.getElementById('autoEnrich').checked,
    hoverTooltip: document.getElementById('hoverTooltip').checked,
    defaultTemplate: document.getElementById('defaultTemplate').value,
    postSignature: document.getElementById('postSignature').value
  };
  await chrome.runtime.sendMessage({ action: 'saveSettings', settings });
}

function showKeyStatus(msg, type) {
  const el = document.getElementById('keyStatus');
  el.textContent = msg;
  el.className = 'field-status ' + type;
  setTimeout(() => { el.textContent = ''; }, 3000);
}

init();
