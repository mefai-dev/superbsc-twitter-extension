# SuperBSC Twitter Extension

Browser extension that brings Binance Skills Terminal intelligence directly into Twitter/X.

![SuperBSC](icons/icon-128.png)

## Features

- Detects cashtags ($BTC, $ETH, $SOL) in tweets automatically
- Injects real-time price badges with 24h change
- Side panel with full analysis: Smart Money, Funding, Regime, Accumulation, Basis
- 7 content templates for data-driven posts
- Post to Binance Square directly from Twitter
- Compose tweets with live market data
- Cross-post to both Square and Twitter simultaneously

## Install

1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select this directory

## Setup

1. Click the SuperBSC extension icon in toolbar
2. Go to **Settings**
3. Enter your **X-Square-OpenAPI-Key** (for Binance Square posting)
4. Customize your watchlist and preferences

## How It Works

1. Browse Twitter/X normally
2. Cashtags like **$BTC**, **$ETH**, **$SOL** get enriched with live price badges
3. **Hover** any badge to see a quick tooltip with price, volume, and smart money score
4. **Click** any badge to open the analysis side panel with 7 data sources
5. Use action buttons to **Post to Square**, **Compose Tweet**, or **Cross-Post**

## Data Sources

| Source | Data |
|--------|------|
| Binance Spot API | Price, volume, 24h change |
| Binance Futures API | Top trader long/short ratios |
| Smart Money Radar | Composite score (0-100), bias, 6 factor breakdown |
| Funding Scanner | Rate, APR, extreme detection |
| Regime Detection | TRENDING / RANGING / VOLATILE_BREAKOUT |
| Accumulation Scanner | Stealth accumulation detection |
| Basis Spread | Contango/backwardation analysis |

## Content Templates

| Template | Description |
|----------|-------------|
| Market Brief | Daily summary with regime + smart money |
| Smart Money Alert | Score + factor breakdown |
| Funding Snapshot | Extreme funding rate analysis |
| Sector Rotation | Multi-asset accumulation report |
| Regime Change | Market state transition alert |
| Accumulation Watchlist | Stealth buying detection |
| Custom Analysis | All 7 data sources combined |

## Architecture

```
content/          Twitter DOM injection + cashtag detection
background/       Service worker, API client, cache, Square client
sidepanel/        Full analysis panel (7 sections + action bar)
popup/            Quick search + watchlist + recent posts
options/          Settings page (API key, preferences)
shared/           Constants, utilities, theme
icons/            Custom 3D-designed SVG/PNG icons
```

## Tech Stack

- Manifest V3 (Chrome + Firefox compatible)
- Vanilla JavaScript (no frameworks, fast and lightweight)
- SuperBSC dark theme (Binance-inspired)
- Custom 3D SVG icons

## Links

- [SuperBSC Terminal](https://mefai.io/superbsc)
- [Binance Skills Hub](https://github.com/mefai-dev/binance-skills-hub)

## License

MIT
