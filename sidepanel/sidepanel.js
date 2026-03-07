const TEMPLATES = [
  { id: 'market-brief', name: 'Market Brief' },
  { id: 'smart-money-alert', name: 'Smart Money' },
  { id: 'funding-snapshot', name: 'Funding' },
  { id: 'sector-rotation', name: 'Sector' },
  { id: 'regime-change', name: 'Regime' },
  { id: 'accumulation-watchlist', name: 'Accumulation' },
  { id: 'custom-analysis', name: 'Custom' }
];

let currentSymbol = null;
let currentData = null;
let selectedTemplate = 'custom-analysis';
let walletConnected = false;
let walletProvider = null;
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
function setupWallet() {
  document.getElementById('btnConnectWallet').addEventListener('click', connectWallet);
  document.getElementById('btnSend').addEventListener('click', sendTransaction);
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    alert('No wallet detected. Please install MetaMask or another Web3 wallet.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts.length > 0) {
      walletConnected = true;
      walletAddress = accounts[0];
      walletProvider = window.ethereum;
      updateWalletUI();

      // Switch to BSC if not already
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }] // BSC Mainnet
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'BNB Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com']
            }]
          });
        }
      }
      loadWalletBalance();
    }
  } catch (err) {
    console.error('Wallet connect failed:', err);
  }
}

function updateWalletUI() {
  const statusEl = document.getElementById('walletStatus');
  const connectEl = document.getElementById('walletConnect');
  const infoEl = document.getElementById('walletInfo');
  const addrEl = document.getElementById('walletAddr');

  if (walletConnected) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'wallet-status connected';
    connectEl.classList.add('hidden');
    infoEl.classList.remove('hidden');
    addrEl.textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
  } else {
    statusEl.textContent = 'Disconnected';
    statusEl.className = 'wallet-status disconnected';
    connectEl.classList.remove('hidden');
    infoEl.classList.add('hidden');
  }
}

async function loadWalletBalance() {
  if (!walletProvider || !walletAddress) return;
  try {
    const balHex = await walletProvider.request({
      method: 'eth_getBalance',
      params: [walletAddress, 'latest']
    });
    const bnb = parseInt(balHex, 16) / 1e18;
    document.getElementById('walletBnb').textContent = bnb.toFixed(4);

    // USDT balance (BEP-20)
    const usdtContract = '0x55d398326f99059fF775485246999027B3197955';
    const balanceOfSig = '0x70a08231000000000000000000000000' + walletAddress.slice(2);
    const usdtHex = await walletProvider.request({
      method: 'eth_call',
      params: [{ to: usdtContract, data: balanceOfSig }, 'latest']
    });
    const usdt = parseInt(usdtHex, 16) / 1e18;
    document.getElementById('walletUsdt').textContent = usdt.toFixed(2);
  } catch (err) {
    console.error('Balance fetch failed:', err);
  }
}

async function sendTransaction() {
  if (!walletProvider || !walletAddress) return;
  const to = document.getElementById('sendTo').value.trim();
  const amount = document.getElementById('sendAmount').value.trim();
  const resultEl = document.getElementById('sendResult');

  if (!to || !to.startsWith('0x') || to.length !== 42) {
    resultEl.className = 'post-result error';
    resultEl.classList.remove('hidden');
    resultEl.textContent = 'Invalid recipient address';
    return;
  }
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    resultEl.className = 'post-result error';
    resultEl.classList.remove('hidden');
    resultEl.textContent = 'Invalid amount';
    return;
  }

  try {
    resultEl.className = 'post-result';
    resultEl.classList.remove('hidden');
    resultEl.textContent = 'Confirming in wallet...';

    const valueHex = '0x' + (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString(16);
    const txHash = await walletProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: to,
        value: valueHex
      }]
    });

    resultEl.className = 'post-result success';
    resultEl.innerHTML = 'Sent! <a href="https://bscscan.com/tx/' + txHash + '" target="_blank" style="color:#0ecb81">View TX</a>';
    document.getElementById('sendTo').value = '';
    document.getElementById('sendAmount').value = '';
    loadWalletBalance();
  } catch (err) {
    resultEl.className = 'post-result error';
    resultEl.textContent = err.code === 4001 ? 'Transaction rejected' : 'Error: ' + (err.message || err);
  }
}

// --- Load Data ---
async function loadSymbol(symbol) {
  currentSymbol = symbol;
  const base = symbol.replace(/USDT$/, '');
  document.getElementById('symbolInput').value = base;

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('dataContainer').classList.add('hidden');
  document.getElementById('actionBar').classList.add('hidden');
  document.getElementById('tokenHeader').classList.add('hidden');
  document.getElementById('walletSection').classList.add('hidden');

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

function showEmpty(msg) {
  document.getElementById('loading').classList.add('hidden');
  const el = document.getElementById('emptyState');
  el.classList.remove('hidden');
  if (msg) el.querySelector('p').textContent = msg;
}

// --- Render ---
function renderData(data) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('tokenHeader').classList.remove('hidden');
  document.getElementById('dataContainer').classList.remove('hidden');
  document.getElementById('actionBar').classList.remove('hidden');
  document.getElementById('walletSection').classList.remove('hidden');

  renderTokenHeader(data);
  renderSmartMoney(data.smartMoney);
  renderFunding(data.funding);
  renderRegime(data.regime);
  renderAccumulation(data.accumulation);
  renderTraders(data.traders);
  renderBasis(data.basis);
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

    document.getElementById('tokenPrice').textContent = formatPrice(price);
    document.getElementById('tokenPrice').className = 'token-price ' + cls;
    document.getElementById('tokenChange').textContent = sign + change.toFixed(2) + '%';
    document.getElementById('tokenChange').className = 'token-change ' + cls;
    document.getElementById('tokenVolume').textContent = 'Vol: ' + formatVol(vol);
    document.getElementById('tokenRange').textContent = formatPrice(parseFloat(data.ticker.low)) + ' - ' + formatPrice(parseFloat(data.ticker.high));
  }
}

function renderSmartMoney(sm) {
  const sec = document.getElementById('secSmartMoney');
  if (!sm || (!sm.score && !sm.compositeScore)) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const score = sm.score ?? sm.compositeScore ?? 0;
  document.getElementById('smScore').textContent = score;
  document.getElementById('smBar').querySelector('.progress-fill').style.width = score + '%';

  const bias = (sm.bias || 'NEUTRAL').toUpperCase();
  const biasEl = document.getElementById('smBias');
  biasEl.textContent = bias;
  biasEl.className = 'bias-badge bias-' + bias.toLowerCase();

  const factorsEl = document.getElementById('smFactors');
  factorsEl.innerHTML = '';
  const factors = sm.factors || sm.breakdown || {};
  Object.entries(factors).forEach(([key, val]) => {
    factorsEl.innerHTML += '<div class="factor-item"><span class="factor-label">' + formatFactorName(key) + '</span><span class="factor-value">' + (typeof val === 'number' ? val.toFixed(2) : val) + '</span></div>';
  });
}

function renderFunding(fund) {
  const sec = document.getElementById('secFunding');
  if (!fund || (fund.rate == null && fund.fundingRate == null)) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const rate = fund.rate ?? fund.fundingRate ?? 0;
  const apr = fund.annualizedAPR ?? (rate * 3 * 365);
  document.getElementById('fundRate').textContent = (rate * 100).toFixed(4) + '%';
  document.getElementById('fundAPR').textContent = apr.toFixed(1) + '%';

  const extremeEl = document.getElementById('fundExtreme');
  if (fund.extreme) extremeEl.classList.remove('hidden');
  else extremeEl.classList.add('hidden');
}

function renderRegime(regime) {
  const sec = document.getElementById('secRegime');
  if (!regime || (!regime.regime && !regime.state)) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const state = (regime.regime || regime.state || '').toUpperCase();
  if (!state || state === 'UNKNOWN') { sec.classList.add('hidden'); return; }

  const stateEl = document.getElementById('regimeState');
  stateEl.textContent = state;
  stateEl.className = 'regime-badge regime-' + state.toLowerCase().replace('volatile_breakout', 'breakout');

  const conf = regime.confidence ?? 0;
  document.getElementById('regimeConf').textContent = (conf * 100).toFixed(0) + '%';
  document.getElementById('regimeBar').querySelector('.progress-fill').style.width = (conf * 100) + '%';
}

function renderAccumulation(acc) {
  const sec = document.getElementById('secAccumulation');
  if (!acc || (acc.compositeScore == null && acc.score == null)) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const score = acc.compositeScore ?? acc.score ?? 0;
  document.getElementById('accScore').textContent = score;
  document.getElementById('accBar').querySelector('.progress-fill').style.width = score + '%';

  const signal = (acc.signalStrength || acc.signal || 'NEUTRAL').toUpperCase();
  const signalEl = document.getElementById('accSignal');
  signalEl.textContent = signal;
  signalEl.className = 'bias-badge bias-' + (signal === 'STRONG' ? 'long' : signal === 'WEAK' ? 'short' : 'neutral');

  const factorsEl = document.getElementById('accFactors');
  factorsEl.innerHTML = '';
  ['volumeSurge', 'oiBuildUp', 'stealthMode', 'buyerAggression'].forEach(f => {
    const val = acc[f];
    if (val != null) {
      factorsEl.innerHTML += '<div class="factor-item"><span class="factor-label">' + formatFactorName(f) + '</span><span class="factor-value">' + (typeof val === 'number' ? val.toFixed(1) : val) + '</span></div>';
    }
  });
}

function renderTraders(traders) {
  const sec = document.getElementById('secTraders');
  if (!traders || traders.longRatio == null) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const longPct = (parseFloat(traders.longRatio) * 100).toFixed(1);
  const shortPct = (parseFloat(traders.shortRatio) * 100).toFixed(1);

  document.getElementById('longBar').style.width = longPct + '%';
  document.getElementById('longPct').textContent = longPct + '%';
  document.getElementById('shortBar').style.width = shortPct + '%';
  document.getElementById('shortPct').textContent = shortPct + '%';
}

function renderBasis(basis) {
  const sec = document.getElementById('secBasis');
  if (!basis || (!basis.state && !basis.annualizedBasis)) { sec.classList.add('hidden'); return; }

  const state = (basis.state || '').toUpperCase();
  if (!state || state === 'UNKNOWN') { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const stateEl = document.getElementById('basisState');
  stateEl.textContent = state;
  stateEl.className = 'regime-badge ' + (state === 'CONTANGO' ? 'regime-trending' : 'regime-breakout');

  const pct = basis.annualizedBasis ?? 0;
  document.getElementById('basisPct').textContent = pct.toFixed(2) + '%';
}

// --- Square Modal ---
function openSquareModal() {
  if (!currentData) return;
  generateContent();
  document.getElementById('squareModal').classList.remove('hidden');
  document.getElementById('postResult').classList.add('hidden');
}

function closeModal() {
  document.getElementById('squareModal').classList.add('hidden');
}

function updateCharCount() {
  document.getElementById('charCount').textContent = document.getElementById('postContent').value.length;
}

function generateContent() {
  if (!currentData) return;
  document.getElementById('postContent').value = buildTemplateContent(selectedTemplate, currentData);
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

// --- Tweet ---
function composeTweet() {
  if (!currentData) return;
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildTemplateContent(selectedTemplate, currentData));
  window.open(url, '_blank');
}

async function crossPost() {
  if (!currentData) return;
  const content = buildTemplateContent(selectedTemplate, currentData);
  const res = await chrome.runtime.sendMessage({ action: 'postToSquare', content });
  let tweet = content;
  if (res?.postUrl) tweet += '\n\n' + res.postUrl;
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet), '_blank');
}

// --- Template Engine ---
function buildTemplateContent(template, data) {
  const base = data.symbol.replace(/USDT$/, '');
  const t = data.ticker || {};
  const price = formatPrice(parseFloat(t.price));
  const change = parseFloat(t.change);
  const sign = change >= 0 ? '+' : '';
  const vol = formatVol(parseFloat(t.volume));
  const now = new Date().toISOString().split('T')[0];
  const lines = [];

  switch (template) {
    case 'market-brief':
      lines.push('Market Brief - ' + now, '');
      if (data.regime) lines.push('Regime: ' + (data.regime.regime || data.regime.state) + ' (confidence: ' + ((data.regime.confidence || 0) * 100).toFixed(0) + '%)');
      if (data.smartMoney) lines.push('Smart Money Score: ' + (data.smartMoney.score || data.smartMoney.compositeScore) + '/100 - ' + data.smartMoney.bias + ' bias');
      lines.push('', base + '  ' + price + '  ' + sign + change.toFixed(2) + '%  Vol: ' + vol);
      if (data.traders) lines.push('', 'Top traders: ' + (parseFloat(data.traders.longRatio) * 100).toFixed(0) + '% long vs ' + (parseFloat(data.traders.shortRatio) * 100).toFixed(0) + '% short');
      lines.push('', '#MarketBrief #' + base + ' #CryptoMarket #Binance', '', 'via SuperBSC');
      break;

    case 'smart-money-alert':
      lines.push('Smart Money Alert - ' + base + 'USDT', '');
      if (data.smartMoney) lines.push('Score: ' + (data.smartMoney.score || data.smartMoney.compositeScore) + '/100 - ' + (data.smartMoney.bias || '').toUpperCase());
      lines.push('', 'Price: ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      if (data.traders) lines.push('Top Traders: ' + (parseFloat(data.traders.longRatio) * 100).toFixed(0) + '% Long / ' + (parseFloat(data.traders.shortRatio) * 100).toFixed(0) + '% Short');
      lines.push('', '#SmartMoney #' + base + ' #TradingSignals', '', 'via SuperBSC');
      break;

    case 'funding-snapshot':
      lines.push('Funding Rate Snapshot', '');
      if (data.funding) lines.push(base + 'USDT  ' + ((data.funding.rate || 0) * 100).toFixed(4) + '%  (APR: ' + (data.funding.annualizedAPR || 0).toFixed(1) + '%)' + (data.funding.extreme ? '  EXTREME' : ''));
      lines.push('', 'Price: ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      if (data.traders) lines.push('Top Traders: ' + (parseFloat(data.traders.longRatio) * 100).toFixed(0) + '% Long / ' + (parseFloat(data.traders.shortRatio) * 100).toFixed(0) + '% Short');
      lines.push('', '#FundingRate #' + base + ' #CryptoTrading', '', 'via SuperBSC');
      break;

    case 'regime-change':
      lines.push('Regime Analysis', '');
      if (data.regime) lines.push('State: ' + (data.regime.regime || data.regime.state) + ' (confidence: ' + ((data.regime.confidence || 0) * 100).toFixed(0) + '%)');
      if (data.smartMoney) lines.push('', 'Smart Money: ' + (data.smartMoney.score || data.smartMoney.compositeScore) + '/100 (' + data.smartMoney.bias + ')');
      lines.push(base + ': ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      lines.push('', '#RegimeChange #MarketStructure #' + base, '', 'via SuperBSC');
      break;

    case 'accumulation-watchlist':
      lines.push('Accumulation Analysis - ' + base + 'USDT', '');
      if (data.accumulation) {
        lines.push('Score: ' + (data.accumulation.compositeScore || data.accumulation.score) + '/100  Signal: ' + (data.accumulation.signalStrength || data.accumulation.signal));
        if (data.accumulation.volumeSurge != null) lines.push('Volume Surge: ' + data.accumulation.volumeSurge.toFixed(1) + '  OI Build: ' + (data.accumulation.oiBuildUp || 0).toFixed(1));
      }
      lines.push('', 'Price: ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      lines.push('', '#Accumulation #InstitutionalFlow #' + base, '', 'via SuperBSC');
      break;

    default: // custom-analysis
      lines.push('Analysis - ' + base + 'USDT', '');
      lines.push('Price: ' + price + ' (' + sign + change.toFixed(2) + '% 24h)');
      lines.push('Range: ' + formatPrice(parseFloat(t.low)) + ' - ' + formatPrice(parseFloat(t.high)));
      lines.push('Volume: ' + vol, '');
      if (data.smartMoney) lines.push('Smart Money: ' + (data.smartMoney.score || data.smartMoney.compositeScore) + '/100 - ' + data.smartMoney.bias);
      if (data.regime && data.regime.regime !== 'UNKNOWN') lines.push('Regime: ' + (data.regime.regime || data.regime.state) + ' (' + ((data.regime.confidence || 0) * 100).toFixed(0) + '%)');
      if (data.funding && data.funding.rate != null) lines.push('Funding: ' + ((data.funding.rate) * 100).toFixed(4) + '% (APR: ' + (data.funding.annualizedAPR || 0).toFixed(1) + '%)');
      if (data.basis && data.basis.state && data.basis.state !== 'UNKNOWN') lines.push('Basis: ' + data.basis.state + ' (' + (data.basis.annualizedBasis || 0).toFixed(2) + '%)');
      lines.push('');
      if (data.traders) lines.push('Top Traders: ' + (parseFloat(data.traders.longRatio) * 100).toFixed(0) + '% Long / ' + (parseFloat(data.traders.shortRatio) * 100).toFixed(0) + '% Short');
      if (data.accumulation && data.accumulation.compositeScore != null) lines.push('Accumulation: ' + (data.accumulation.compositeScore || data.accumulation.score) + '/100 - ' + (data.accumulation.signalStrength || data.accumulation.signal));
      lines.push('', '#' + base + ' #CryptoAnalysis #Binance #SuperBSC', '', 'via SuperBSC');
      break;
  }
  return lines.filter(l => l !== undefined).join('\n');
}

// --- Helpers ---
function formatPrice(n) {
  if (isNaN(n)) return '--';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}

function formatVol(n) {
  if (isNaN(n)) return '--';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + (n / 1e3).toFixed(1) + 'K';
}

function formatFactorName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

init();
