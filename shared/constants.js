export const SUPERBSC_API = 'https://mefai.io/superbsc';

export const BINANCE_SPOT_API = 'https://api.binance.com';
export const BINANCE_FUTURES_API = 'https://fapi.binance.com';
export const BINANCE_SQUARE_API = 'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add';

export const CACHE_FRESH_MS = 60_000;
export const CACHE_STALE_MS = 300_000;
export const CACHE_MAX_ENTRIES = 100;

export const THROTTLE_MAX_REQ_PER_MIN = 10;

export const KNOWN_PAIRS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'SHIB', 'LTC', 'ATOM', 'FIL', 'APT', 'ARB', 'OP', 'IMX',
  'NEAR', 'ICP', 'FTM', 'ALGO', 'VET', 'MANA', 'SAND', 'AXS', 'AAVE', 'GRT',
  'EOS', 'THETA', 'XLM', 'TRX', 'ETC', 'FET', 'RNDR', 'INJ', 'SUI', 'SEI',
  'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI', 'BONK', 'ORDI', 'STX', 'RUNE', 'PENDLE',
  'WLD', 'JTO'
];

export const MEME_PREFIX_MAP = {
  PEPE: '1000PEPE',
  FLOKI: '1000FLOKI',
  SHIB: '1000SHIB',
  BONK: '1000BONK'
};

export const SQUARE_ERROR_CODES = {
  '000000': 'Success',
  '10004': 'Network error. Please try again',
  '10005': 'Identity verification required',
  '10007': 'Feature unavailable',
  '20002': 'Content contains restricted words',
  '20013': 'Content exceeds character limit',
  '20020': 'Cannot publish empty content',
  '20022': 'Content flagged for review',
  '20041': 'URL flagged as security risk',
  '30004': 'Account not found',
  '30008': 'Account restricted from posting',
  '220003': 'Invalid API Key',
  '220004': 'API Key expired',
  '220009': 'Daily post limit reached',
  '220010': 'Content type not supported',
  '220011': 'Content body cannot be empty',
  '2000001': 'Account permanently restricted',
  '2000002': 'Device permanently restricted'
};

export const TEMPLATES = [
  { id: 'market-brief', name: 'Market Brief', icon: 'M' },
  { id: 'smart-money-alert', name: 'Smart Money Alert', icon: 'S' },
  { id: 'funding-snapshot', name: 'Funding Snapshot', icon: 'F' },
  { id: 'sector-rotation', name: 'Sector Rotation', icon: 'R' },
  { id: 'regime-change', name: 'Regime Change', icon: 'G' },
  { id: 'accumulation-watchlist', name: 'Accumulation Watchlist', icon: 'A' },
  { id: 'custom-analysis', name: 'Custom Analysis', icon: 'C' }
];
