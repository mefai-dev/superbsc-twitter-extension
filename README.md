# SuperBSC Twitter Extension

Browser extension that brings Binance market intelligence directly into Twitter/X.

![SuperBSC](icons/icon-128.png)

## Features

- Detects cashtags ($BTC, $ETH, $SOL) in tweets automatically
- Injects real-time price badges with 24h change next to each cashtag
- Click any badge to open a side panel with full market analysis
- **Funding Rate** — rate, annualized APR, extreme flags, mark price
- **Top Trader Positioning** — long/short ratio bar (whale sentiment)
- **Taker Buy/Sell Pressure** — buy/sell ratio and pressure direction
- **Open Interest** — current OI, 6h trend (RISING / FALLING / STABLE)
- **Basis Spread** — Contango/Backwardation with annualized %
- **Account Long/Short** — retail investor sentiment bar
- Post to **Binance Square** with 5 content templates
- **Compose Tweet** with data-driven market analysis
- **Cross-Post** to Square + Twitter simultaneously
- **BSC Wallet** — connect MetaMask, view BNB/USDT balance, send BNB
- **Watchlist** — track favorite coins with live prices
- 52 coins supported including meme coins (PEPE, FLOKI, BONK, SHIB)
- 9 parallel Binance API endpoints with LRU cache

## Install

### From Release (Recommended)

1. Go to [Releases](https://github.com/mefai-dev/superbsc-twitter-extension/releases/latest)
2. Download `superbsc-twitter-extension-v*.zip` from Assets
3. Extract the zip to a folder
4. Open `chrome://extensions` in Chrome
5. Enable **Developer mode** (toggle in top-right corner)
6. Click **Load unpacked**
7. Select the extracted folder
8. Go to [twitter.com](https://twitter.com) — cashtags will show live prices

### From Source

```bash
git clone https://github.com/mefai-dev/superbsc-twitter-extension.git
```
Then follow steps 4-8 above, selecting the cloned directory.

## Setup

### Binance Square Posting (Optional)
1. Click the SuperBSC icon in Chrome toolbar
2. Click **Settings**
3. Enter your **X-Square-OpenAPI-Key**
4. Now you can post analysis directly to Binance Square

### Watchlist
- Default coins: BTC, ETH, SOL
- Customize in Settings page

## How It Works

1. Browse Twitter/X normally
2. Cashtags like **$BTC**, **$ETH**, **$SOL** get enriched with live price badges
3. **Hover** any badge to see a tooltip with price, 24h change, and volume
4. **Click** any badge to open the analysis side panel
5. Use action buttons to **Post to Square**, **Compose Tweet**, or **Cross-Post**
6. Connect MetaMask wallet to view BSC balance and send BNB

## Data Sources

| # | Source | Endpoint | Data |
|---|--------|----------|------|
| 1 | Spot Ticker | `GET /api/v3/ticker/24hr` | Price, volume, 24h change, daily range |
| 2 | Premium Index | `GET /fapi/v1/premiumIndex` | Funding rate, mark price, APR |
| 3 | Top Trader Position | `GET /futures/data/topLongShortPositionRatio` | Whale long/short ratio |
| 4 | Top Trader Account | `GET /futures/data/topLongShortAccountRatio` | Retail sentiment |
| 5 | Taker Buy/Sell | `GET /futures/data/takerlongshortRatio` | Buy/sell pressure |
| 6 | Open Interest | `GET /fapi/v1/openInterest` | Current OI |
| 7 | OI History | `GET /futures/data/openInterestHist` | 6h OI trend |
| 8 | Basis Spread | `GET /futures/data/basis` | Contango/backwardation |
| 9 | Futures 24hr | `GET /fapi/v1/ticker/24hr` | Futures price, volume |

## Content Templates

| Template | Description |
|----------|-------------|
| Market Brief | Daily summary with funding + taker + OI trend |
| Funding Snapshot | Extreme funding rate analysis |
| Regime Change | Market structure with basis + OI + traders |
| Smart Money Alert | Price + traders + taker pressure |
| Custom Analysis | All 9 data sources combined (default) |

## Architecture

```
content/          Twitter DOM injection + cashtag detection + wallet bridge
background/       Service worker, API client, cache, Square client
sidepanel/        Analysis panel (6 sections + wallet + action bar)
popup/            Quick search + watchlist + recent posts
options/          Settings page (API key, preferences)
shared/           Constants, utilities, theme
icons/            Custom 3D-designed SVG/PNG icons
_locales/         English + Turkish translations
```

## Tech Stack

- Manifest V3 (Chrome + Firefox compatible)
- Vanilla JavaScript (no frameworks)
- SuperBSC dark theme (Binance-inspired)
- Custom 3D SVG icons
- LRU cache (60s fresh, 300s stale-while-revalidate)

## Links

- [SuperBSC Terminal](https://mefai.io/superbsc)
- [Binance Skills Hub](https://github.com/mefai-dev/binance-skills-hub)

## License

MIT
