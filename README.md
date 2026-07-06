# HyperFlow Radar

HyperFlow Radar is a GoldRush-powered Hyperliquid intelligence dashboard for live smart-money flow, liquidation monitoring, and batch wallet risk analysis.

## What It Shows

- Live global fills from GoldRush Hyperliquid WebSocket data.
- Liquidation radar for large and clustered liquidation events.
- Top active wallets ranked by rolling notional, fill count, coins, and PnL.
- Wallet watchlist powered by GoldRush `batchClearinghouseState`.
- Demo fallback data so the product story works without an API key.

## Why GoldRush

GoldRush makes the hard Hyperliquid data layer product-friendly: global flow, liquidation streams, and batch wallet state can be composed into one dashboard without building fragile wallet-by-wallet infrastructure.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev -- -p 3000
```

Add your API key in `.env.local`:

```env
GOLDRUSH_API_KEY=your_key_here
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Deploy on Vercel as a Next.js app.

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add `GOLDRUSH_API_KEY` in Vercel Project Settings -> Environment Variables.
4. Deploy.

The API key is only used server-side by Next.js API routes and is not exposed to the browser.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
```
