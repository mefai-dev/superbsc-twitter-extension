async function init() {
  loadWatchlist();
  loadRecentPosts();
  setupSearch();
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const val = input.value.trim().toUpperCase();
    if (!val) return;
    const symbol = val.replace(/USDT$/, '') + 'USDT';
    await chrome.storage.local.set({ selectedSymbol: symbol });
    // Open side panel on the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  });
}

async function loadWatchlist() {
  const container = document.getElementById('watchlist');
  try {
    const res = await chrome.runtime.sendMessage({ action: 'getWatchlist' });
    if (!res?.watchlist?.length) {
      container.innerHTML = '<div class="empty-sm">No symbols in watchlist</div>';
      return;
    }

    container.innerHTML = res.watchlist.map(item => {
      if (item.error) {
        return `<div class="watchlist-item" data-symbol="${item.symbol}">
          <span class="wl-symbol">${item.symbol.replace('USDT', '')}</span>
          <span class="wl-price">--</span>
          <span class="wl-change">--</span>
        </div>`;
      }
      const price = parseFloat(item.price);
      const change = parseFloat(item.change);
      const cls = change >= 0 ? 'positive' : 'negative';
      const sign = change >= 0 ? '+' : '';
      const priceStr = price >= 1000 ? '$' + price.toLocaleString('en-US', {maximumFractionDigits:0}) :
                       price >= 1 ? '$' + price.toFixed(2) : '$' + price.toFixed(4);
      return `<div class="watchlist-item" data-symbol="${item.symbol}">
        <span class="wl-symbol">${item.symbol.replace('USDT', '')}</span>
        <span class="wl-price">${priceStr}</span>
        <span class="wl-change ${cls}">${sign}${change.toFixed(2)}%</span>
      </div>`;
    }).join('');

    container.querySelectorAll('.watchlist-item').forEach(el => {
      el.addEventListener('click', async () => {
        const symbol = el.dataset.symbol;
        await chrome.storage.local.set({ selectedSymbol: symbol });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      });
    });
  } catch {
    container.innerHTML = '<div class="empty-sm">Failed to load</div>';
  }
}

async function loadRecentPosts() {
  const container = document.getElementById('recentPosts');
  try {
    const res = await chrome.runtime.sendMessage({ action: 'getPostHistory' });
    if (!res?.history?.length) {
      container.innerHTML = '<div class="empty-sm">No posts yet</div>';
      return;
    }

    container.innerHTML = res.history.slice(0, 5).map(post => {
      const ago = timeAgo(post.ts);
      const platform = post.platform === 'square' ? 'Square' : 'Twitter';
      return `<div class="post-item">
        <div class="post-item-text">${escapeHtml(post.content)}</div>
        <div class="post-item-meta">${platform} - ${ago}</div>
      </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<div class="empty-sm">Failed to load</div>';
  }
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  return Math.floor(diff / 86400000) + ' days ago';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

init();
