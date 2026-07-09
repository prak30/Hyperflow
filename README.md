# Frontier Desk

Frontier Desk is a GoldRush-powered Robinhood Chain launch intelligence dashboard with a secondary Hyperliquid live-market radar.

## What It Shows

- Robinhood Chain support marked as new on GoldRush.
- Robinhood Chain wallet balances and recent transactions using `robinhood-mainnet`.
- GoldRush API coverage story: 33 Robinhood Chain APIs, including 22 Foundational APIs and 11 Streaming APIs.
- Hyperliquid live global fills, liquidation radar, and batch wallet state as the real-time proof point.
- Demo fallback data so the product story works even when a wallet has sparse activity.

## Why GoldRush

GoldRush makes newly supported chains product-friendly fast. This app turns the Robinhood Chain launch into a clear dashboard, then proves GoldRush can also handle specialized real-time market data with Hyperliquid.

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

## APIs Used

- `GET https://api.covalenthq.com/v1/robinhood-mainnet/address/{wallet}/balances_v2/`
- `GET https://api.covalenthq.com/v1/robinhood-mainnet/address/{wallet}/transactions_v3/`
- `wss://hypercore.goldrushdata.com/ws?key=<GOLDRUSH_API_KEY>`
- `POST https://hypercore.goldrushdata.com/info` with `type: "batchClearinghouseState"`

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
