import { cacheGet, cacheSet } from './cache.js';
import { getAllTokenData, getSpotTicker } from './api-client.js';
import { postToSquare, getSquareApiKey, saveSquareApiKey, addPostHistory, getPostHistory } from './square-client.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true; // async response
});

async function handleMessage(msg) {
  switch (msg.action) {
    case 'getTokenData':
      return handleGetTokenData(msg.symbol);
    case 'getQuickPrice':
      return handleQuickPrice(msg.symbol);
    case 'postToSquare':
      return handlePostToSquare(msg.content);
    case 'getSquareKey':
      return { key: await getSquareApiKey() };
    case 'saveSquareKey':
      await saveSquareApiKey(msg.key);
      return { success: true };
    case 'getPostHistory':
      return { history: await getPostHistory() };
    case 'getWatchlist':
      return handleGetWatchlist();
    case 'saveWatchlist':
      await chrome.storage.local.set({ watchlist: msg.symbols });
      return { success: true };
    case 'getSettings':
      return handleGetSettings();
    case 'saveSettings':
      await chrome.storage.local.set({ settings: msg.settings });
      return { success: true };
    case 'openSidePanel':
      if (msg.tabId) {
        await chrome.sidePanel.open({ tabId: msg.tabId });
      }
      return { success: true };
    default:
      return { error: 'Unknown action: ' + msg.action };
  }
}

async function handleGetTokenData(symbol) {
  const key = 'token:' + symbol;
  const cached = cacheGet(key);
  if (cached?.fresh) return { data: cached.data };

  try {
    const data = await getAllTokenData(symbol);
    cacheSet(key, data);
    return { data };
  } catch (err) {
    if (cached) return { data: cached.data, stale: true };
    return { error: err.message };
  }
}

async function handleQuickPrice(symbol) {
  const key = 'price:' + symbol;
  const cached = cacheGet(key);
  if (cached?.fresh) return { data: cached.data };

  try {
    const data = await getSpotTicker(symbol);
    cacheSet(key, data);
    return { data };
  } catch (err) {
    if (cached) return { data: cached.data };
    return { error: err.message };
  }
}

async function handlePostToSquare(content) {
  const apiKey = await getSquareApiKey();
  if (!apiKey) return { success: false, error: 'Square API Key not configured. Set it in extension settings.' };

  const result = await postToSquare(apiKey, content);
  if (result.success) {
    await addPostHistory({
      content: content.slice(0, 100),
      postUrl: result.postUrl,
      platform: 'square'
    });
  }
  return result;
}

async function handleGetWatchlist() {
  const result = await chrome.storage.local.get('watchlist');
  const symbols = result.watchlist || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const prices = await Promise.allSettled(
    symbols.map(s => getSpotTicker(s).then(d => ({ symbol: s, ...d })))
  );
  return {
    watchlist: prices.map((p, i) => p.status === 'fulfilled' ? p.value : { symbol: symbols[i], error: true })
  };
}

async function handleGetSettings() {
  const result = await chrome.storage.local.get('settings');
  return {
    settings: result.settings || {
      autoEnrich: true,
      hoverTooltip: true,
      defaultTemplate: 'custom-analysis',
      language: 'en',
      postSignature: 'via SuperBSC'
    }
  };
}

// Set side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
