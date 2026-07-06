export type FlowSide = "buy" | "sell" | "long" | "short" | "unknown";

export type FlowEvent = {
  id: string;
  kind: "fill" | "liquidation";
  wallet: string;
  coin: string;
  side: FlowSide;
  price: number;
  size: number;
  notional: number;
  builder?: string;
  closedPnl?: number;
  liquidation?: {
    method?: string;
    liquidatedUser?: string;
    marketPrice?: number;
  };
  timestamp: string;
  source: "live" | "demo";
};

export type WalletPosition = {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx?: number;
  unrealizedPnl?: number;
  leverage?: number;
  liquidationPx?: number;
};

export type WalletState = {
  wallet: string;
  accountValue: number;
  withdrawable: number;
  marginUsed?: number;
  positions: WalletPosition[];
  riskLevel: "low" | "medium" | "high";
  error?: string;
  source: "live" | "demo";
};

export type StreamPayload =
  | { type: "status"; mode: "live" | "demo"; message: string }
  | { type: "event"; event: FlowEvent };

export type WalletStats = {
  wallet: string;
  volume: number;
  fills: number;
  pnl: number;
  coins: Set<string>;
  lastSeen: string;
};
