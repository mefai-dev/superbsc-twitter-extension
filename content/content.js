(function() {
  'use strict';

  const KNOWN_PAIRS = new Set([
    'BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC',
    'LINK','UNI','SHIB','LTC','ATOM','FIL','APT','ARB','OP','IMX',
    'NEAR','ICP','FTM','ALGO','VET','MANA','SAND','AXS','AAVE','GRT',
    'EOS','THETA','XLM','TRX','ETC','FET','RNDR','INJ','SUI','SEI',
    'TIA','JUP','WIF','PEPE','FLOKI','BONK','ORDI','STX','RUNE','PENDLE',
    'WLD','JTO'
  ]);

  const CASHTAG_REGEX = /\$([A-Za-z]{2,10})\b/g;
  const PROCESSED_ATTR = 'data-sbsc-processed';
  const ICON_URL = chrome.runtime.getURL('icons/icon-16.png');

  let tooltip = null;
  let tooltipTimer = null;
  let priceCache = {};

  // --- Tooltip ---
  function createTooltip() {
    const el = document.createElement('div');
    el.className = 'sbsc-tooltip';
    document.body.appendChild(el);
    return el;
  }

  function showTooltip(badge, symbol, data) {
    if (!tooltip) tooltip = createTooltip();
    const rect = badge.getBoundingClientRect();
    const changeClass = parseFloat(data.change) >= 0 ? 'positive' : 'negative';
    const changeSign = parseFloat(data.change) >= 0 ? '+' : '';
    const vol = parseFloat(data.volume);
    const volStr = vol >= 1e9 ? (vol/1e9).toFixed(1) + 'B' : vol >= 1e6 ? (vol/1e6).toFixed(1) + 'M' : (vol/1e3).toFixed(1) + 'K';

    let smartLine = '';
    if (data.smartMoney) {
      smartLine = `<div class="sbsc-tooltip-row"><span>Smart Money</span><span>${data.smartMoney.score}/100 (${data.smartMoney.bias})</span></div>`;
    }

    tooltip.innerHTML = `
      <div class="sbsc-tooltip-header">
        <span class="sbsc-tooltip-symbol">${symbol}/USDT</span>
        <span class="sbsc-tooltip-price ${changeClass}">$${parseFloat(data.price).toLocaleString()}</span>
      </div>
      <div class="sbsc-tooltip-row">
        <span>24h Change</span>
        <span class="${changeClass}">${changeSign}${parseFloat(data.change).toFixed(2)}%</span>
      </div>
      <div class="sbsc-tooltip-row">
        <span>Volume</span>
        <span>$${volStr}</span>
      </div>
      ${smartLine}
      <div class="sbsc-tooltip-divider"></div>
      <div class="sbsc-tooltip-cta">Click for full analysis</div>
    `;

    tooltip.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('visible');
  }

  // --- Badge ---
  function createBadge(symbol) {
    const badge = document.createElement('span');
    badge.className = 'sbsc-badge';
    badge.setAttribute('data-sbsc-symbol', symbol);
    badge.innerHTML = `<img src="${ICON_URL}" class="sbsc-badge-logo" alt="S"><span class="sbsc-badge-loading"></span>`;

    // Load price
    loadPrice(symbol, badge);

    // Click → open side panel
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openSidePanel', tabId: null });
      // Store selected symbol for side panel to pick up
      chrome.storage.local.set({ selectedSymbol: symbol + 'USDT' });
      // Also send direct message for immediate update
      chrome.runtime.sendMessage({ action: 'getTokenData', symbol: symbol + 'USDT' });
    });

    // Hover → tooltip
    let hoverTimer;
    badge.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(() => {
        const cached = priceCache[symbol];
        if (cached) showTooltip(badge, symbol, cached);
      }, 300);
    });
    badge.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      hideTooltip();
    });

    return badge;
  }

  async function loadPrice(symbol, badge) {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getQuickPrice', symbol: symbol + 'USDT' });
      if (res?.data) {
        priceCache[symbol] = res.data;
        const changeClass = parseFloat(res.data.change) >= 0 ? 'positive' : 'negative';
        const changeSign = parseFloat(res.data.change) >= 0 ? '+' : '';
        const price = parseFloat(res.data.price);
        const priceStr = price >= 1000 ? price.toLocaleString('en-US', {maximumFractionDigits:0}) :
                         price >= 1 ? price.toFixed(2) : price.toFixed(4);
        badge.innerHTML = `<img src="${ICON_URL}" class="sbsc-badge-logo" alt="S"><span class="sbsc-badge-price">$${priceStr}</span><span class="sbsc-badge-change ${changeClass}">${changeSign}${parseFloat(res.data.change).toFixed(1)}%</span>`;
      } else {
        badge.innerHTML = `<img src="${ICON_URL}" class="sbsc-badge-logo" alt="S"><span class="sbsc-badge-price">View</span>`;
      }
    } catch {
      badge.innerHTML = `<img src="${ICON_URL}" class="sbsc-badge-logo" alt="S"><span class="sbsc-badge-price">View</span>`;
    }
  }

  // --- Scanner ---
  function scanTweet(tweetEl) {
    if (tweetEl.getAttribute(PROCESSED_ATTR)) return;
    tweetEl.setAttribute(PROCESSED_ATTR, '1');

    const textEls = tweetEl.querySelectorAll('[data-testid="tweetText"], [lang]');
    textEls.forEach(textEl => {
      if (textEl.getAttribute(PROCESSED_ATTR)) return;
      textEl.setAttribute(PROCESSED_ATTR, '1');

      const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT, null);
      const matches = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        let match;
        CASHTAG_REGEX.lastIndex = 0;
        while ((match = CASHTAG_REGEX.exec(node.textContent)) !== null) {
          const sym = match[1].toUpperCase();
          if (KNOWN_PAIRS.has(sym)) {
            matches.push({ node, sym, index: match.index, length: match[0].length });
          }
        }
      }

      // Process in reverse order to preserve indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const { node, sym, index, length } = matches[i];
        const text = node.textContent;
        const before = text.slice(0, index + length);
        const after = text.slice(index + length);

        const beforeNode = document.createTextNode(before);
        const afterNode = document.createTextNode(after);
        const badge = createBadge(sym);

        const parent = node.parentNode;
        parent.insertBefore(beforeNode, node);
        parent.insertBefore(badge, node);
        parent.insertBefore(afterNode, node);
        parent.removeChild(node);
      }
    });
  }

  function scanAll() {
    const tweets = document.querySelectorAll(`[data-testid="tweet"]:not([${PROCESSED_ATTR}])`);
    tweets.forEach(scanTweet);
  }

  // --- Observer ---
  let scanTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAll, 100);
  });

  function init() {
    // Initial scan
    scanAll();

    // Watch for new tweets (infinite scroll)
    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });

    // Periodic rescan for dynamic content
    setInterval(scanAll, 5000);
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
