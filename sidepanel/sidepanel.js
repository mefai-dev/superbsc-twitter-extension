const TEMPLATES = [
  { id: 'market-brief', name: 'Market Brief' },
  { id: 'smart-money-alert', name: 'Smart Money' },
  { id: 'funding-snapshot', name: 'Funding' },
  { id: 'regime-change', name: 'Regime' },
  { id: 'custom-analysis', name: 'Custom' }
];

let currentSymbol = null;
let currentData = null;
let selectedTemplate = 'custom-analysis';
let walletConnected = false;
let walletAddress = null;

// --- Init ---
async function init() {
  setupSearch();
  setupActions();
  setupModal();
  setupTemplates();
  setupWallet();
  listenForSymbolChanges();

  const stored = await chrome.storage.local.get('selectedSymbol');
  if (stored.selectedSymbol) loadSymbol(stored.selectedSymbol);
}

function setupSearch() {
  const input = document.getElementById('symbolInput');
  const btn = document.getElementById('searchBtn');
  const search = () => {
    const val = input.value.trim().toUpperCase();
    if (val) loadSymbol(val.replace(/USDT$/, '') + 'USDT');
  };
  btn.addEventListener('click', search);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
}

function setupActions() {
  document.getElementById('btnSquare').addEventListener('click', () => openSquareModal());
  document.getElementById('btnTweet').addEventListener('click', () => composeTweet());
  document.getElementById('btnCross').addEventListener('click', () => crossPost());
}

function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('postContent').addEventListener('input', updateCharCount);
  document.getElementById('btnGenerate').addEventListener('click', generateContent);
  document.getElementById('btnPost').addEventListener('click', submitSquarePost);
}

function setupTemplates() {
  const picker = document.getElementById('templatePicker');
  TEMPLATES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'template-btn' + (t.id === selectedTemplate ? ' active' : '');
    btn.textContent = t.name;
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTemplate = t.id;
    });
    picker.appendChild(btn);
  });
}

function listenForSymbolChanges() {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.selectedSymbol?.newValue) loadSymbol(changes.selectedSymbol.newValue);
  });
}

// --- Wallet ---
// Side panel runs in extension context, not in page context.
// window.ethereum is NOT available here. We must message the content script
// which runs in the page context and can access window.ethereum.
function setupWallet() {
  document.getElementById('btnConnectWallet').addEventListener('click', connectWallet);
  document.getElementById('btnSend').addEventListener('click', sendTransaction);
  // Check if already connected
  chrome.storage.local.get(['walletAddress'], (res) => {
    if (res.walletAddress) {
      walletConnected = true;
      walletAddress = res.walletAddress;
      updateWalletUI();
    }
  });
}

async function connectWallet() {
  // Send message to content script to request wallet access
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { alert('No active tab found'); return; }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'walletConnect' });
    if (response?.address) {
      walletConnected = true;
      walletAddress = response.address;
      chrome.storage.local.set({ walletAddress: response.address });
      updateWalletUI();
      // Get balances
      const balRes = await chrome.tabs.sendMessage(tab.id, { action: 'walletBalance', address: response.address });
      if (balRes) {
        document.getElementById('walletBnb').textContent = parseFloat(balRes.bnb || 0).toFixed(4);
        document.getElementById('walletUsdt').textContent = parseFloat(balRes.usdt || 0).toFixed(2);
      }
    } else if (response?.error) {
      alert(response.error);
    }
  } catch (err) {
    alert('Wallet not detected on this page. Make sure MetaMask is installed and try on twitter.com');
  }
}

function updateWalletUI() {
  const statusEl = document.getElementById('walletStatus');
  const connectEl = document.getElementById('walletConnect');
  const infoEl = document.getElementById('walletInfo');

  if (walletConnected && walletAddress) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'wallet-status connected';
    connectEl.classList.add('hidden');
    infoEl.classList.remove('hidden');
    document.getElementById('walletAddr').textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
  } else {
    statusEl.textContent = 'Disconnected';
    statusEl.className = 'wallet-status disconnected';
    connectEl.classList.remove('hidden');
    infoEl.classList.add('hidden');
  }
}

async function sendTransaction() {
  const to = document.getElementById('sendTo').value.trim();
  const amount = document.getElementById('sendAmount').value.trim();
  const resultEl = document.getElementById('sendResult');

  if (!to || !to.startsWith('0x') || to.length !== 42) {
    showSendResult('Invalid recipient address', false);
    return;
  }
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    showSendResult('Invalid amount', false);
    return;
  }

  showSendResult('Confirming in wallet...', null);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'walletSend',
      to: to,
      amount: amount,
      from: walletAddress
    });

    if (response?.txHash) {
      resultEl.className = 'post-result success';
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = 'Sent! <a href="https://bscscan.com/tx/' + response.txHash + '" target="_blank" style="color:#0ecb81">View TX</a>';
      document.getElementById('sendTo').value = '';
      document.getElementById('sendAmount').value = '';
    } else {
      showSendResult(response?.error || 'Transaction failed', false);
    }
  } catch (err) {
    showSendResult('Error: ' + err.message, false);
  }
}

function showSendResult(msg, success) {
  const el = document.getElementById('sendResult');
  el.classList.remove('hidden');
  if (success === true) el.className = 'post-result success';
  else if (success === false) el.className = 'post-result error';
  else el.className = 'post-result';
  el.textContent = msg;
}

// --- Load Data ---
async function loadSymbol(symbol) {
  currentSymbol = symbol;
  const base = symbol.replace(/USDT$/, '');
  document.getElementById('symbolInput').value = base;

  show('loading'); hide('emptyState', 'dataContainer', 'actionBar', 'tokenHeader', 'walletSection');

  try {
    const res = await chrome.runtime.sendMessage({ action: 'getTokenData', symbol });
    if (res?.data) {
      currentData = res.data;
      renderData(res.data);
    } else {
      showEmpty('Failed to load data for ' + base);
    }
  } catch (err) {
    showEmpty('Error: ' + err.message);
  }
}

function show(...ids) { ids.forEach(id => document.getElementById(id)?.classList.remove('hidden')); }
function hide(...ids) { ids.forEach(id => document.getElementById(id)?.classList.add('hidden')); }

function showEmpty(msg) {
  hide('loading');
  show('emptyState');
  if (msg) document.getElementById('emptyState').querySelector('p').textContent = msg;
}

// --- Render ---
function renderData(data) {
  hide('loading');
  show('tokenHeader', 'dataContainer', 'actionBar', 'walletSection');

  renderTokenHeader(data);
  renderFunding(data.funding);
  renderTraders(data.traders);
  renderTaker(data.takerRatio);
  renderOI(data.openInterest, data.oiHistory);
  renderBasis(data.basis);
  renderAccountRatio(data.accountRatio);
}

function renderTokenHeader(data) {
  const base = data.symbol.replace(/USDT$/, '');
  document.getElementById('tokenSymbol').textContent = base + '/USDT';

  if (data.ticker) {
    const price = parseFloat(data.ticker.price);
    const change = parseFloat(data.ticker.change);
    const vol = parseFloat(data.ticker.volume);
    const cls = change >= 0 ? 'positive' : 'negative';
    const sign = change >= 0 ? '+' : '';

    document.getElementById('tokenPrice').textContent = fmtPrice(price);
    document.getElementById('tokenPrice').className = 'token-price ' + cls;
    document.getElementById('tokenChange').textContent = sign + change.toFixed(2) + '%';
    document.getElementById('tokenChange').className = 'token-change ' + cls;
    document.getElementById('tokenVolume').textContent = 'Vol: ' + fmtVol(vol);
    document.getElementById('tokenRange').textContent = fmtPrice(parseFloat(data.ticker.low)) + ' - ' + fmtPrice(parseFloat(data.ticker.high));
  }
}

function renderFunding(fund) {
  const sec = document.getElementById('secFunding');
  if (!fund) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const rate = fund.rate || 0;
  const cls = rate >= 0 ? 'positive' : 'negative';
  document.getElementById('fundRate').textContent = (rate * 100).toFixed(4) + '%';
  document.getElementById('fundRate').className = 'metric-value ' + cls;
  document.getElementById('fundAPR').textContent = fund.annualizedAPR.toFixed(1) + '%';
  document.getElementById('fundMark').textContent = fmtPrice(parseFloat(fund.markPrice));

  const extremeEl = document.getElementById('fundExtreme');
  if (fund.extreme) extremeEl.classList.remove('hidden');
  else extremeEl.classList.add('hidden');
}

function renderTraders(traders) {
  const sec = document.getElementById('secTraders');
  if (!traders) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const longPct = (parseFloat(traders.longRatio) * 100).toFixed(1);
  const shortPct = (parseFloat(traders.shortRatio) * 100).toFixed(1);
  document.getElementById('longBar').style.width = longPct + '%';
  document.getElementById('longPct').textContent = longPct + '%';
  document.getElementById('shortBar').style.width = shortPct + '%';
  document.getElementById('shortPct').textContent = shortPct + '%';
}

function renderTaker(taker) {
  const sec = document.getElementById('secTaker');
  if (!taker) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const ratio = taker.ratio || 1;
  document.getElementById('takerRatio').textContent = ratio.toFixed(2);

  const pressureEl = document.getElementById('takerPressure');
  pressureEl.textContent = taker.pressure;
  pressureEl.className = 'bias-badge bias-' + (taker.pressure === 'BUYERS' ? 'long' : taker.pressure === 'SELLERS' ? 'short' : 'neutral');

  const pct = Math.min(Math.max((ratio / 2) * 100, 5), 95);
  document.getElementById('takerBar').querySelector('.progress-fill').style.width = pct + '%';
}

function renderOI(oi, oiHistory) {
  const sec = document.getElementById('secOI');
  if (!oi && !oiHistory) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  if (oi) {
    document.getElementById('oiValue').textContent = fmtVol(parseFloat(oi.openInterest));
  }

  if (oiHistory) {
    const change = oiHistory.change || 0;
    const cls = change >= 0 ? 'positive' : 'negative';
    const sign = change >= 0 ? '+' : '';
    document.getElementById('oiChange').textContent = sign + change.toFixed(2) + '%';
    document.getElementById('oiChange').className = 'metric-value ' + cls;

    const trendEl = document.getElementById('oiTrend');
    const trend = oiHistory.trend || 'STABLE';
    trendEl.textContent = trend;
    trendEl.className = 'regime-badge regime-' + (trend === 'RISING' ? 'trending' : trend === 'FALLING' ? 'breakout' : 'ranging');
  }
}

function renderBasis(basis) {
  const sec = document.getElementById('secBasis');
  if (!basis) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const stateEl = document.getElementById('basisState');
  stateEl.textContent = basis.state;
  stateEl.className = 'regime-badge ' + (basis.state === 'CONTANGO' ? 'regime-trending' : 'regime-breakout');
  document.getElementById('basisPct').textContent = basis.annualizedBasis.toFixed(2) + '%';
}

function renderAccountRatio(acc) {
  const sec = document.getElementById('secAccount');
  if (!acc) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const longPct = (parseFloat(acc.longAccount) * 100).toFixed(1);
  const shortPct = (parseFloat(acc.shortAccount) * 100).toFixed(1);
  document.getElementById('accLongBar').style.width = longPct + '%';
  document.getElementById('accLongPct').textContent = longPct + '%';
  document.getElementById('accShortBar').style.width = shortPct + '%';
  document.getElementById('accShortPct').textContent = shortPct + '%';
}

// --- Square Modal ---
function openSquareModal() {
  if (!currentData) return;
  generateContent();
  show('squareModal');
  hide('postResult');
}
function closeModal() { hide('squareModal'); }

function updateCharCount() {
  document.getElementById('charCount').textContent = document.getElementById('postContent').value.length;
}

function generateContent() {
  if (!currentData) return;
  document.getElementById('postContent').value = buildContent(selectedTemplate, currentData);
  updateCharCount();
}

async function submitSquarePost() {
  const content = document.getElementById('postContent').value.trim();
  if (!content) return;
  const resultEl = document.getElementById('postResult');
  resultEl.classList.remove('hidden', 'success', 'error');
  resultEl.textContent = 'Posting...';

  const res = await chrome.runtime.sendMessage({ action: 'postToSquare', content });
  if (res?.success) {
    resultEl.className = 'post-result success';
    resultEl.innerHTML = 'Posted!' + (res.postUrl ? ' <a href="' + res.postUrl + '" target="_blank" style="color:#0ecb81">View Post</a>' : '');
  } else {
    resultEl.className = 'post-result error';
    resultEl.textContent = res?.error || 'Failed to post';
  }
}

function composeTweet() {
  if (!currentData) return;
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildContent(selectedTemplate, currentData)), '_blank');
}

async function crossPost() {
  if (!currentData) return;
  const content = buildContent(selectedTemplate, currentData);
  const res = await chrome.runtime.sendMessage({ action: 'postToSquare', content });
  let tweet = content;
  if (res?.postUrl) tweet += '\n\n' + res.postUrl;
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet), '_blank');
}

// --- Template Engine ---
function buildContent(template, d) {
  const base = d.symbol.replace(/USDT$/, '');
  const t = d.ticker || {};
  const price = fmtPrice(parseFloat(t.price));
  const change = parseFloat(t.change) || 0;
  const sign = change >= 0 ? '+' : '';
  const vol = fmtVol(parseFloat(t.volume));
  const now = new Date().toISOString().split('T')[0];
  const L = [];

  // Common header
  const header = () => { L.push(base + '  ' + price + '  ' + sign + change.toFixed(2) + '%  Vol: ' + vol); };
  const tradersLine = () => { if (d.traders) L.push('Top Traders: ' + (parseFloat(d.traders.longRatio) * 100).toFixed(0) + '% Long / ' + (parseFloat(d.traders.shortRatio) * 100).toFixed(0) + '% Short'); };
  const fundingLine = () => { if (d.funding) L.push('Funding: ' + (d.funding.rate * 100).toFixed(4) + '% (APR: ' + d.funding.annualizedAPR.toFixed(1) + '%)' + (d.funding.extreme ? ' EXTREME' : '')); };

  switch (template) {
    case 'market-brief':
      L.push('Market Brief - ' + now, '');
      header();
      L.push('');
      fundingLine();
      tradersLine();
      if (d.takerRatio) L.push('Taker Pressure: ' + d.takerRatio.pressure + ' (' + d.takerRatio.ratio.toFixed(2) + ')');
      if (d.oiHistory) L.push('OI Trend: ' + d.oiHistory.trend + ' (' + (d.oiHistory.change >= 0 ? '+' : '') + d.oiHistory.change.toFixed(1) + '% 6h)');
      L.push('', '#MarketBrief #' + base + ' #Binance', '', 'via SuperBSC');
      break;

    case 'funding-snapshot':
      L.push('Funding Rate Snapshot', '');
      fundingLine();
      L.push('', 'Price: ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      tradersLine();
      L.push('', '#FundingRate #' + base + ' #CryptoTrading', '', 'via SuperBSC');
      break;

    case 'regime-change':
      L.push('Market Structure - ' + base + 'USDT', '');
      header();
      L.push('');
      if (d.basis) L.push('Basis: ' + d.basis.state + ' (' + d.basis.annualizedBasis.toFixed(2) + '% ann.)');
      fundingLine();
      if (d.oiHistory) L.push('OI: ' + d.oiHistory.trend + ' (' + (d.oiHistory.change >= 0 ? '+' : '') + d.oiHistory.change.toFixed(1) + '%)');
      tradersLine();
      L.push('', '#MarketStructure #' + base, '', 'via SuperBSC');
      break;

    default: // custom-analysis
      L.push('Analysis - ' + base + 'USDT', '');
      L.push('Price: ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      L.push('Range: ' + fmtPrice(parseFloat(t.low)) + ' - ' + fmtPrice(parseFloat(t.high)));
      L.push('Volume: ' + vol, '');
      fundingLine();
      if (d.basis) L.push('Basis: ' + d.basis.state + ' (' + d.basis.annualizedBasis.toFixed(2) + '%)');
      if (d.openInterest) L.push('Open Interest: ' + fmtVol(parseFloat(d.openInterest.openInterest)));
      if (d.oiHistory) L.push('OI Trend: ' + d.oiHistory.trend + ' (' + (d.oiHistory.change >= 0 ? '+' : '') + d.oiHistory.change.toFixed(1) + '% 6h)');
      tradersLine();
      if (d.accountRatio) L.push('Accounts: ' + (parseFloat(d.accountRatio.longAccount) * 100).toFixed(0) + '% Long / ' + (parseFloat(d.accountRatio.shortAccount) * 100).toFixed(0) + '% Short');
      if (d.takerRatio) L.push('Taker: ' + d.takerRatio.pressure + ' (ratio: ' + d.takerRatio.ratio.toFixed(2) + ')');
      L.push('', '#' + base + ' #CryptoAnalysis #Binance #SuperBSC', '', 'via SuperBSC');
      break;
  }
  return L.join('\n');
}

// --- Helpers ---
function fmtPrice(n) {
  if (isNaN(n)) return '--';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}
function fmtVol(n) {
  if (isNaN(n)) return '--';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + (n / 1e3).toFixed(1) + 'K';
}

init();
