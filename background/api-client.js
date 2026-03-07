const SUPERBSC = 'https://mefai.io/superbsc';
const BINANCE_SPOT = 'https://api.binance.com';
const BINANCE_FUTURES = 'https://fapi.binance.com';

const MEME_PREFIX = { PEPE: '1000PEPE', FLOKI: '1000FLOKI', SHIB: '1000SHIB', BONK: '1000BONK' };

function futuresSymbol(sym) {
  const base = sym.replace(/USDT$/, '');
  return (MEME_PREFIX[base] || base) + 'USDT';
}

async function fetchJson(url, opts) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

export async function getSpotTicker(symbol) {
  const data = await fetchJson(`${BINANCE_SPOT}/api/v3/ticker/24hr?symbol=${symbol}`);
  return {
    price: data.lastPrice,
    change: data.priceChangePercent,
    volume: data.quoteVolume,
    high: data.highPrice,
    low: data.lowPrice
  };
}

export async function getTopTraders(symbol) {
  const fSym = futuresSymbol(symbol);
  const data = await fetchJson(`${BINANCE_FUTURES}/futures/data/topLongShortPositionRatio?symbol=${fSym}&period=1h&limit=1`);
  if (!data.length) return null;
  return {
    longRatio: data[0].longAccount,
    shortRatio: data[0].shortAccount,
    ratio: data[0].longShortRatio
  };
}

export async function getSmartMoney(symbol) {
  try {
    const data = await fetchJson(`${SUPERBSC}/api/scanner/smart-money?symbol=${symbol}`);
    return data;
  } catch {
    return null;
  }
}

export async function getFunding(symbol) {
  try {
    const fSym = futuresSymbol(symbol);
    const data = await fetchJson(`${SUPERBSC}/api/futures/funding-scan?symbol=${fSym}`);
    return data;
  } catch {
    return null;
  }
}

export async function getRegime(symbol) {
  try {
    const data = await fetchJson(`${SUPERBSC}/api/scanner/regime?symbol=${symbol}`);
    return data;
  } catch {
    return null;
  }
}

export async function getAccumulation(symbol) {
  try {
    const data = await fetchJson(`${SUPERBSC}/api/scanner/accumulation?symbol=${symbol}`);
    return data;
  } catch {
    return null;
  }
}

export async function getBasis(symbol) {
  try {
    const fSym = futuresSymbol(symbol);
    const data = await fetchJson(`${SUPERBSC}/api/futures/basis?symbol=${fSym}`);
    return data;
  } catch {
    return null;
  }
}

export async function getAllTokenData(symbol) {
  const [ticker, traders, smartMoney, funding, regime, accumulation, basis] = await Promise.allSettled([
    getSpotTicker(symbol),
    getTopTraders(symbol),
    getSmartMoney(symbol),
    getFunding(symbol),
    getRegime(symbol),
    getAccumulation(symbol),
    getBasis(symbol)
  ]);
  return {
    symbol,
    ticker: ticker.status === 'fulfilled' ? ticker.value : null,
    traders: traders.status === 'fulfilled' ? traders.value : null,
    smartMoney: smartMoney.status === 'fulfilled' ? smartMoney.value : null,
    funding: funding.status === 'fulfilled' ? funding.value : null,
    regime: regime.status === 'fulfilled' ? regime.value : null,
    accumulation: accumulation.status === 'fulfilled' ? accumulation.value : null,
    basis: basis.status === 'fulfilled' ? basis.value : null,
    ts: Date.now()
  };
}
