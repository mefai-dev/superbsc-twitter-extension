const SUPERBSC = 'https://mefai.io/superbsc';

const MEME_PREFIX = { PEPE: '1000PEPE', FLOKI: '1000FLOKI', SHIB: '1000SHIB', BONK: '1000BONK' };

function futuresSymbol(sym) {
  const base = sym.replace(/USDT$/, '');
  return (MEME_PREFIX[base] || base) + 'USDT';
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Spot ticker via proxy
export async function getSpotTicker(symbol) {
  const data = await fetchJson(`${SUPERBSC}/api/spot/ticker?symbol=${symbol}`);
  return {
    price: data.lastPrice,
    change: data.priceChangePercent,
    volume: data.quoteVolume,
    high: data.highPrice,
    low: data.lowPrice
  };
}

// Top trader long/short ratio via proxy
export async function getTopTraders(symbol) {
  const fSym = futuresSymbol(symbol);
  const data = await fetchJson(`${SUPERBSC}/api/futures/topLongShortPosition?symbol=${fSym}&period=1h&limit=1`);
  if (!data || !data.length) return null;
  return {
    longRatio: data[0].longAccount,
    shortRatio: data[0].shortAccount,
    ratio: data[0].longShortRatio
  };
}

// Funding rate via premiumIndex
export async function getFunding(symbol) {
  const fSym = futuresSymbol(symbol);
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/premiumIndex?symbol=${fSym}`);
    // Can be single object or array
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return null;
    const rate = parseFloat(item.lastFundingRate || 0);
    return {
      rate: rate,
      annualizedAPR: Math.abs(rate) * 3 * 365 * 100,
      direction: rate >= 0 ? 'POSITIVE' : 'NEGATIVE',
      extreme: Math.abs(rate) > 0.0005,
      markPrice: item.markPrice,
      indexPrice: item.indexPrice
    };
  } catch { return null; }
}

// Basis spread via proxy
export async function getBasis(symbol) {
  const fSym = futuresSymbol(symbol).replace(/USDT$/, '');
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/basis?pair=${fSym}USDT&contractType=PERPETUAL&period=1h&limit=1`);
    if (!data || !data.length) return null;
    const item = data[0];
    const basisRate = parseFloat(item.basisRate || 0);
    const annualized = basisRate * 365 * 24;
    return {
      state: basisRate >= 0 ? 'CONTANGO' : 'BACKWARDATION',
      annualizedBasis: annualized,
      basisRate: basisRate,
      futuresPrice: item.futuresPrice,
      indexPrice: item.indexPrice
    };
  } catch { return null; }
}

// Open Interest via proxy
export async function getOpenInterest(symbol) {
  const fSym = futuresSymbol(symbol);
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/openInterest?symbol=${fSym}`);
    return {
      openInterest: data.openInterest,
      symbol: data.symbol
    };
  } catch { return null; }
}

// Taker buy/sell ratio via proxy
export async function getTakerRatio(symbol) {
  const fSym = futuresSymbol(symbol);
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/takerBuySellRatio?symbol=${fSym}&period=1h&limit=1`);
    if (!data || !data.length) return null;
    const ratio = parseFloat(data[0].buySellRatio || 1);
    return {
      ratio: ratio,
      buyVol: data[0].buyVol,
      sellVol: data[0].sellVol,
      pressure: ratio > 1.05 ? 'BUYERS' : ratio < 0.95 ? 'SELLERS' : 'NEUTRAL'
    };
  } catch { return null; }
}

// Long/short account ratio (retail sentiment)
export async function getLongShortAccount(symbol) {
  const fSym = futuresSymbol(symbol);
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/topLongShortAccount?symbol=${fSym}&period=1h&limit=1`);
    if (!data || !data.length) return null;
    return {
      longAccount: data[0].longAccount,
      shortAccount: data[0].shortAccount,
      ratio: data[0].longShortRatio
    };
  } catch { return null; }
}

// OI history for trend detection
export async function getOIHistory(symbol) {
  const fSym = futuresSymbol(symbol);
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/openInterestHist?symbol=${fSym}&period=1h&limit=6`);
    if (!data || data.length < 2) return null;
    const latest = parseFloat(data[data.length - 1].sumOpenInterest);
    const oldest = parseFloat(data[0].sumOpenInterest);
    const change = ((latest - oldest) / oldest) * 100;
    return {
      current: latest,
      change: change,
      trend: change > 3 ? 'RISING' : change < -3 ? 'FALLING' : 'STABLE'
    };
  } catch { return null; }
}

// 24h Futures ticker
export async function getFutures24h(symbol) {
  const fSym = futuresSymbol(symbol);
  try {
    const data = await fetchJson(`${SUPERBSC}/api/futures/ticker24hr?symbol=${fSym}`);
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return null;
    return {
      price: item.lastPrice,
      change: item.priceChangePercent,
      volume: item.quoteVolume,
      high: item.highPrice,
      low: item.lowPrice,
      trades: item.count
    };
  } catch { return null; }
}

// Aggregate all data for a symbol
export async function getAllTokenData(symbol) {
  const [ticker, traders, funding, basis, openInterest, takerRatio, accountRatio, oiHistory, futures24h] = await Promise.allSettled([
    getSpotTicker(symbol),
    getTopTraders(symbol),
    getFunding(symbol),
    getBasis(symbol),
    getOpenInterest(symbol),
    getTakerRatio(symbol),
    getLongShortAccount(symbol),
    getOIHistory(symbol),
    getFutures24h(symbol)
  ]);

  const v = (r) => r.status === 'fulfilled' ? r.value : null;

  return {
    symbol,
    ticker: v(ticker),
    traders: v(traders),
    funding: v(funding),
    basis: v(basis),
    openInterest: v(openInterest),
    takerRatio: v(takerRatio),
    accountRatio: v(accountRatio),
    oiHistory: v(oiHistory),
    futures24h: v(futures24h),
    ts: Date.now()
  };
}
