import type { FlowEvent, WalletState } from "./types";

const wallets = [
  "0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00",
  "0x5078c2fbea2b2ad61bc840bc023ecb5df8b5ecaf",
  "0xba1ad77b1c46a7c2c43cf5e10c14e8f0d7d6d5e3",
  "0xb0a55f13d22f66e6d495ac98113841b2326e9540",
  "0x198ef79f1f515f02dfe9e3115ed9fc07183f02fc",
  "0x31ca8395cf837de08b24da3f660e77761dfb974b",
];

const coins = ["BTC", "ETH", "SOL", "HYPE", "FARTCOIN", "PURR"];

export function makeDemoEvent(index: number): FlowEvent {
  const wallet = wallets[index % wallets.length];
  const coin = coins[(index * 3) % coins.length];
  const isLiquidation = index % 11 === 0;
  const priceBase = coin === "BTC" ? 108000 : coin === "ETH" ? 2550 : coin === "SOL" ? 152 : coin === "HYPE" ? 39 : 1.2;
  const price = Number((priceBase * (1 + ((index % 9) - 4) / 1000)).toFixed(4));
  const size = Number(((index % 7) * 1.31 + 0.72).toFixed(4));
  const side = index % 2 === 0 ? "buy" : "sell";
  const timestamp = new Date(Date.now() - (index % 20) * 9000).toISOString();

  return {
    id: `demo-${index}-${timestamp}`,
    kind: isLiquidation ? "liquidation" : "fill",
    wallet,
    coin,
    side,
    price,
    size,
    notional: Number((price * size).toFixed(2)),
    builder: index % 3 === 0 ? "HyperBeat" : index % 4 === 0 ? "Dexari" : undefined,
    closedPnl: Number((((index % 13) - 5) * 214.35).toFixed(2)),
    liquidation: isLiquidation
      ? {
          method: index % 2 === 0 ? "Market" : "Backstop",
          liquidatedUser: wallet,
          marketPrice: price,
        }
      : undefined,
    timestamp,
    source: "demo",
  };
}

export const initialDemoEvents = Array.from({ length: 28 }, (_, i) => makeDemoEvent(i + 1)).reverse();

export function demoWalletState(wallet: string, index = 0): WalletState {
  const seed = Math.max(1, wallet.charCodeAt(3) || 1) + index * 17;
  const accountValue = 24500 + seed * 183;
  const withdrawable = accountValue * (0.32 + (seed % 9) / 40);
  const risk = seed % 5 === 0 ? "high" : seed % 3 === 0 ? "medium" : "low";

  return {
    wallet,
    accountValue: Number(accountValue.toFixed(2)),
    withdrawable: Number(withdrawable.toFixed(2)),
    marginUsed: Number((accountValue - withdrawable).toFixed(2)),
    riskLevel: risk,
    source: "demo",
    positions: [
      {
        coin: coins[seed % coins.length],
        side: seed % 2 === 0 ? "long" : "short",
        size: Number(((seed % 12) + 1.4).toFixed(2)),
        entryPx: Number((100 + seed * 1.7).toFixed(2)),
        unrealizedPnl: Number((((seed % 17) - 8) * 186.44).toFixed(2)),
        leverage: (seed % 8) + 2,
        liquidationPx: Number((80 + seed * 1.31).toFixed(2)),
      },
      {
        coin: coins[(seed + 2) % coins.length],
        side: seed % 2 === 0 ? "short" : "long",
        size: Number(((seed % 7) + 0.8).toFixed(2)),
        entryPx: Number((42 + seed * 0.91).toFixed(2)),
        unrealizedPnl: Number((((seed % 11) - 4) * 98.12).toFixed(2)),
        leverage: (seed % 5) + 1,
      },
    ],
  };
}
