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

// --- Init ---
async function init() {
  setupSearch();
  setupActions();
  setupModal();
  setupTemplates();
  listenForSymbolChanges();

  // Check if there's a pre-selected symbol
  const stored = await chrome.storage.local.get('selectedSymbol');
  if (stored.selectedSymbol) {
    loadSymbol(stored.selectedSymbol);
  }
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
    if (changes.selectedSymbol?.newValue) {
      loadSymbol(changes.selectedSymbol.newValue);
    }
  });
}

// --- Load Data ---
async function loadSymbol(symbol) {
  currentSymbol = symbol;
  const base = symbol.replace(/USDT$/, '');
  document.getElementById('symbolInput').value = base;

  // Show loading
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('dataContainer').classList.add('hidden');
  document.getElementById('actionBar').classList.add('hidden');
  document.getElementById('tokenHeader').classList.add('hidden');

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
  document.getElementById('emptyState').classList.remove('hidden');
  if (msg) {
    document.getElementById('emptyState').querySelector('p').textContent = msg;
  }
}

// --- Render ---
function renderData(data) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('tokenHeader').classList.remove('hidden');
  document.getElementById('dataContainer').classList.remove('hidden');
  document.getElementById('actionBar').classList.remove('hidden');

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
  if (!sm) { sec.classList.add('hidden'); return; }
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
    factorsEl.innerHTML += `<div class="factor-item"><span class="factor-label">${formatFactorName(key)}</span><span class="factor-value">${typeof val === 'number' ? val.toFixed(2) : val}</span></div>`;
  });
}

function renderFunding(fund) {
  const sec = document.getElementById('secFunding');
  if (!fund) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const rate = fund.rate ?? fund.fundingRate ?? 0;
  const apr = fund.annualizedAPR ?? (rate * 3 * 365);
  document.getElementById('fundRate').textContent = (rate * 100).toFixed(4) + '%';
  document.getElementById('fundAPR').textContent = apr.toFixed(1) + '%';

  const extremeEl = document.getElementById('fundExtreme');
  if (fund.extreme) {
    extremeEl.classList.remove('hidden');
  } else {
    extremeEl.classList.add('hidden');
  }
}

function renderRegime(regime) {
  const sec = document.getElementById('secRegime');
  if (!regime) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const state = (regime.regime || regime.state || 'UNKNOWN').toUpperCase();
  const stateEl = document.getElementById('regimeState');
  stateEl.textContent = state;
  stateEl.className = 'regime-badge regime-' + state.toLowerCase().replace('volatile_breakout', 'breakout');

  const conf = regime.confidence ?? 0;
  document.getElementById('regimeConf').textContent = (conf * 100).toFixed(0) + '%';
  document.getElementById('regimeBar').querySelector('.progress-fill').style.width = (conf * 100) + '%';
}

function renderAccumulation(acc) {
  const sec = document.getElementById('secAccumulation');
  if (!acc) { sec.classList.add('hidden'); return; }
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
  const fields = ['volumeSurge', 'oiBuildUp', 'stealthMode', 'buyerAggression'];
  fields.forEach(f => {
    const val = acc[f];
    if (val != null) {
      factorsEl.innerHTML += `<div class="factor-item"><span class="factor-label">${formatFactorName(f)}</span><span class="factor-value">${typeof val === 'number' ? val.toFixed(1) : val}</span></div>`;
    }
  });
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

function renderBasis(basis) {
  const sec = document.getElementById('secBasis');
  if (!basis) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const state = (basis.state || 'UNKNOWN').toUpperCase();
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
  const len = document.getElementById('postContent').value.length;
  document.getElementById('charCount').textContent = len;
}

function generateContent() {
  if (!currentData) return;
  const content = buildTemplateContent(selectedTemplate, currentData);
  document.getElementById('postContent').value = content;
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
    resultEl.innerHTML = 'Posted successfully!' + (res.postUrl ? ` <a href="${res.postUrl}" target="_blank" style="color:#0ecb81">View Post</a>` : '');
  } else {
    resultEl.className = 'post-result error';
    resultEl.textContent = res?.error || 'Failed to post';
  }
}

// --- Tweet Compose ---
function composeTweet() {
  if (!currentData) return;
  const content = buildTemplateContent(selectedTemplate, currentData);
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(content);
  window.open(url, '_blank');
}

async function crossPost() {
  if (!currentData) return;
  const content = buildTemplateContent(selectedTemplate, currentData);

  // First post to Square
  const res = await chrome.runtime.sendMessage({ action: 'postToSquare', content });

  // Then open tweet compose
  let tweetContent = content;
  if (res?.postUrl) {
    tweetContent += '\n\n' + res.postUrl;
  }
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetContent);
  window.open(url, '_blank');
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

  switch (template) {
    case 'market-brief':
      return [
        `Market Brief - ${now}`,
        '',
        data.regime ? `Regime: ${data.regime.regime || data.regime.state} (confidence: ${((data.regime.confidence || 0) * 100).toFixed(0)}%)` : '',
        data.smartMoney ? `Smart Money Score: ${data.smartMoney.score || data.smartMoney.compositeScore}/100 - ${data.smartMoney.bias} bias` : '',
        '',
        `${base}  ${price}  ${sign}${change.toFixed(2)}%  Vol: ${vol}`,
        '',
        data.traders ? `Top traders: ${(parseFloat(data.traders.longRatio) * 100).toFixed(0)}% long vs ${(parseFloat(data.traders.shortRatio) * 100).toFixed(0)}% short` : '',
        '',
        `#MarketBrief #${base} #CryptoMarket #Binance`,
        '',
        'via SuperBSC'
      ].filter(Boolean).join('\n');

    case 'smart-money-alert':
      return [
        `Smart Money Alert - ${base}USDT`,
        '',
        data.smartMoney ? `Score: ${data.smartMoney.score || data.smartMoney.compositeScore}/100 - ${(data.smartMoney.bias || '').toUpperCase()}` : '',
        '',
        `Price: ${price} (${sign}${change.toFixed(2)}% 24h)`,
        data.traders ? `Top Traders: ${(parseFloat(data.traders.longRatio) * 100).toFixed(0)}% Long / ${(parseFloat(data.traders.shortRatio) * 100).toFixed(0)}% Short` : '',
        '',
        `#SmartMoney #${base} #TradingSignals`,
        '',
        'via SuperBSC'
      ].filter(Boolean).join('\n');

    case 'funding-snapshot':
      return [
        'Funding Rate Snapshot',
        '',
        data.funding ? `${base}USDT  ${(data.funding.rate * 100).toFixed(4)}%  (APR: ${(data.funding.annualizedAPR || 0).toFixed(1)}%)${data.funding.extreme ? '  EXTREME' : ''}` : `${base}USDT  N/A`,
        '',
        `Price: ${price} (${sign}${change.toFixed(2)}% 24h)`,
        data.traders ? `Top Traders: ${(parseFloat(data.traders.longRatio) * 100).toFixed(0)}% Long / ${(parseFloat(data.traders.shortRatio) * 100).toFixed(0)}% Short` : '',
        '',
        `#FundingRate #${base} #CryptoTrading`,
        '',
        'via SuperBSC'
      ].filter(Boolean).join('\n');

    case 'regime-change':
      return [
        'Regime Analysis',
        '',
        data.regime ? `State: ${data.regime.regime || data.regime.state} (confidence: ${((data.regime.confidence || 0) * 100).toFixed(0)}%)` : '',
        '',
        data.smartMoney ? `Smart Money Score: ${data.smartMoney.score || data.smartMoney.compositeScore}/100 (${data.smartMoney.bias})` : '',
        `${base}: ${price} (${sign}${change.toFixed(2)}% 24h)`,
        '',
        `#RegimeChange #MarketStructure #${base}`,
        '',
        'via SuperBSC'
      ].filter(Boolean).join('\n');

    case 'accumulation-watchlist':
      return [
        `Accumulation Analysis - ${base}USDT`,
        '',
        data.accumulation ? `Score: ${data.accumulation.compositeScore || data.accumulation.score}/100  Signal: ${data.accumulation.signalStrength || data.accumulation.signal}` : '',
        data.accumulation?.volumeSurge != null ? `Volume Surge: ${data.accumulation.volumeSurge.toFixed(1)}  OI Build: ${(data.accumulation.oiBuildUp || 0).toFixed(1)}` : '',
        '',
        `Price: ${price} (${sign}${change.toFixed(2)}% 24h)`,
        '',
        `#Accumulation #InstitutionalFlow #${base}`,
        '',
        'via SuperBSC'
      ].filter(Boolean).join('\n');

    case 'custom-analysis':
    default:
      return [
        `Analysis - ${base}USDT`,
        '',
        `Price: ${price} (${sign}${change.toFixed(2)}% 24h)`,
        `Range: ${formatPrice(parseFloat(t.low))} - ${formatPrice(parseFloat(t.high))}`,
        `Volume: ${vol}`,
        '',
        data.smartMoney ? `Smart Money: ${data.smartMoney.score || data.smartMoney.compositeScore}/100 - ${data.smartMoney.bias}` : '',
        data.regime ? `Regime: ${data.regime.regime || data.regime.state} (${((data.regime.confidence || 0) * 100).toFixed(0)}%)` : '',
        data.funding ? `Funding: ${(data.funding.rate * 100).toFixed(4)}% (APR: ${(data.funding.annualizedAPR || 0).toFixed(1)}%)${data.funding.extreme ? ' EXTREME' : ''}` : '',
        data.basis ? `Basis: ${data.basis.state} (${(data.basis.annualizedBasis || 0).toFixed(2)}%)` : '',
        '',
        data.traders ? `Top Traders: ${(parseFloat(data.traders.longRatio) * 100).toFixed(0)}% Long / ${(parseFloat(data.traders.shortRatio) * 100).toFixed(0)}% Short` : '',
        data.accumulation ? `Accumulation: ${data.accumulation.compositeScore || data.accumulation.score}/100 - ${data.accumulation.signalStrength || data.accumulation.signal}` : '',
        '',
        `#${base} #CryptoAnalysis #Binance #SuperBSC`,
        '',
        'via SuperBSC'
      ].filter(Boolean).join('\n');
  }
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

// Start
init();
