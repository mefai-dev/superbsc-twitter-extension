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

  let tooltip = null;
  let priceCache = {};

  // --- Listen for messages from sidepanel (wallet) ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'walletConnect') {
      handleWalletConnect().then(sendResponse);
      return true;
    }
    if (msg.action === 'walletBalance') {
      handleWalletBalance(msg.address).then(sendResponse);
      return true;
    }
    if (msg.action === 'walletSend') {
      handleWalletSend(msg).then(sendResponse);
      return true;
    }
  });

  async function handleWalletConnect() {
    if (typeof window.ethereum === 'undefined') {
      return { error: 'No wallet detected. Please install MetaMask.' };
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        // Switch to BSC
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
        } catch (e) {
          if (e.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: '0x38', chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org/'], blockExplorerUrls: ['https://bscscan.com'] }]
            });
          }
        }
        return { address: accounts[0] };
      }
      return { error: 'No accounts found' };
    } catch (err) {
      return { error: err.message || 'Connection rejected' };
    }
  }

  async function handleWalletBalance(address) {
    try {
      const balHex = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      const bnb = parseInt(balHex, 16) / 1e18;
      // USDT BEP-20
      const usdtContract = '0x55d398326f99059fF775485246999027B3197955';
      const data = '0x70a08231000000000000000000000000' + address.slice(2);
      const usdtHex = await window.ethereum.request({ method: 'eth_call', params: [{ to: usdtContract, data }, 'latest'] });
      const usdt = parseInt(usdtHex, 16) / 1e18;
      return { bnb, usdt };
    } catch { return { bnb: 0, usdt: 0 }; }
  }

  async function handleWalletSend(msg) {
    try {
      const valueHex = '0x' + BigInt(Math.floor(parseFloat(msg.amount) * 1e18)).toString(16);
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: msg.from, to: msg.to, value: valueHex }]
      });
      return { txHash };
    } catch (err) {
      return { error: err.code === 4001 ? 'Transaction rejected by user' : (err.message || 'Transaction failed') };
    }
  }

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
    const change = parseFloat(data.change);
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeSign = change >= 0 ? '+' : '';
    const vol = parseFloat(data.volume);
    const volStr = vol >= 1e9 ? (vol/1e9).toFixed(1)+'B' : vol >= 1e6 ? (vol/1e6).toFixed(1)+'M' : (vol/1e3).toFixed(1)+'K';

    tooltip.innerHTML =
      '<div class="sbsc-tooltip-header">' +
        '<span class="sbsc-tooltip-symbol">' + symbol + '/USDT</span>' +
        '<span class="sbsc-tooltip-price ' + changeClass + '">$' + parseFloat(data.price).toLocaleString() + '</span>' +
      '</div>' +
      '<div class="sbsc-tooltip-row"><span>24h Change</span><span class="' + changeClass + '">' + changeSign + change.toFixed(2) + '%</span></div>' +
      '<div class="sbsc-tooltip-row"><span>Volume</span><span>$' + volStr + '</span></div>' +
      '<div class="sbsc-tooltip-divider"></div>' +
      '<div class="sbsc-tooltip-cta">Click for full analysis</div>';

    tooltip.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('visible');
  }

  // --- Badge (pure CSS, no image) ---
  function createBadge(symbol) {
    const badge = document.createElement('span');
    badge.className = 'sbsc-badge';
    badge.setAttribute('data-sbsc-symbol', symbol);
    // Use text "S" instead of broken image
    badge.innerHTML = '<span class="sbsc-badge-s">S</span><span class="sbsc-badge-loading"></span>';

    loadPrice(symbol, badge);

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.storage.local.set({ selectedSymbol: symbol + 'USDT' });
      chrome.runtime.sendMessage({ action: 'getTokenData', symbol: symbol + 'USDT' });
    });

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
        const change = parseFloat(res.data.change);
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeSign = change >= 0 ? '+' : '';
        const price = parseFloat(res.data.price);
        const priceStr = price >= 1000 ? price.toLocaleString('en-US', {maximumFractionDigits:0}) :
                         price >= 1 ? price.toFixed(2) : price.toFixed(4);
        badge.innerHTML = '<span class="sbsc-badge-s">S</span><span class="sbsc-badge-price">$' + priceStr + '</span><span class="sbsc-badge-change ' + changeClass + '">' + changeSign + change.toFixed(1) + '%</span>';
      } else {
        badge.innerHTML = '<span class="sbsc-badge-s">S</span><span class="sbsc-badge-price">View</span>';
      }
    } catch {
      badge.innerHTML = '<span class="sbsc-badge-s">S</span><span class="sbsc-badge-price">View</span>';
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
    document.querySelectorAll('[data-testid="tweet"]:not([' + PROCESSED_ATTR + '])').forEach(scanTweet);
  }

  // --- Observer ---
  let scanTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAll, 100);
  });

  function init() {
    scanAll();
    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
    setInterval(scanAll, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
