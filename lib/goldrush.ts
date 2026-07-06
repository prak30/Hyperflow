import type { FlowEvent, FlowSide, WalletPosition, WalletState } from "./types";

const INFO_URL = "https://hypercore.goldrushdata.com/info";

type UnknownRecord = Record<string, unknown>;

export function hasGoldRushKey() {
  return Boolean(process.env.GOLDRUSH_API_KEY?.trim());
}

export function validWallet(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function maybeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function shortHash(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeSide(value: unknown): FlowSide {
  if (typeof value !== "string") return "unknown";
  const lower = value.toLowerCase();
  if (lower === "b" || lower === "buy" || lower === "long") return "buy";
  if (lower === "a" || lower === "sell" || lower === "short") return "sell";
  return "unknown";
}

function firstRecord(value: unknown): UnknownRecord | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const nested = value.find((item) => typeof item === "object" && item !== null);
    return nested as UnknownRecord | undefined;
  }
  if (typeof value === "object") return value as UnknownRecord;
  return undefined;
}

export function normalizeWsEvent(raw: unknown, forcedKind?: "fill" | "liquidation"): FlowEvent | undefined {
  const message = firstRecord(raw);
  if (!message) return undefined;

  const channel = String(message.channel ?? message.type ?? "");
  const data = firstRecord(message.data ?? message);
  if (!data) return undefined;

  const tupleFill = Array.isArray(message.data) ? firstRecord(message.data[1]) : undefined;
  const fill = firstRecord(data.fill ?? data.fills ?? data) ?? tupleFill;
  if (!fill) return undefined;

  const wallet =
    String(data.user ?? data.wallet ?? data.address ?? fill.user ?? fill.wallet ?? fill.address ?? message.user ?? "");
  const coin = String(fill.coin ?? data.coin ?? "UNKNOWN");
  const price = toNumber(fill.px ?? fill.price ?? data.px ?? data.price);
  const size = toNumber(fill.sz ?? fill.size ?? data.sz ?? data.size);
  const liquidation = firstRecord(fill.liquidation ?? data.liquidation);
  const kind = forcedKind ?? (channel.includes("liquidation") || liquidation ? "liquidation" : "fill");

  if (!validWallet(wallet) || !coin || price <= 0 || size <= 0) return undefined;

  const timestampValue = fill.time ?? fill.timestamp ?? data.time ?? data.timestamp;
  const timestamp =
    typeof timestampValue === "number" ? new Date(timestampValue).toISOString() : new Date().toISOString();

  return {
    id: `${kind}-${wallet}-${coin}-${timestamp}-${Math.random().toString(16).slice(2)}`,
    kind,
    wallet,
    coin,
    side: normalizeSide(fill.side ?? data.side),
    price,
    size,
    notional: Number((price * size).toFixed(2)),
    builder: typeof fill.builder === "string" ? shortHash(fill.builder) : undefined,
    closedPnl: fill.closedPnl === undefined ? undefined : toNumber(fill.closedPnl),
    liquidation: liquidation
      ? {
          method: typeof liquidation.method === "string" ? liquidation.method : undefined,
          liquidatedUser:
            typeof liquidation.liquidated_user === "string"
              ? liquidation.liquidated_user
              : typeof liquidation.liquidatedUser === "string"
                ? liquidation.liquidatedUser
                : undefined,
          marketPrice: toNumber(liquidation.market_price ?? liquidation.marketPrice ?? price),
        }
      : undefined,
    timestamp,
    source: "live",
  };
}

export async function fetchBatchClearinghouseState(wallets: string[]): Promise<WalletState[]> {
  const key = process.env.GOLDRUSH_API_KEY?.trim();
  if (!key) throw new Error("Missing GOLDRUSH_API_KEY");

  const response = await fetch(INFO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "batchClearinghouseState",
      users: wallets.slice(0, 50),
      dex: "",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GoldRush returned ${response.status}`);
  }

  const slots = (await response.json()) as unknown[];
  return slots.map((slot, index) => normalizeWalletSlot(wallets[index], slot));
}

function normalizeWalletSlot(wallet: string, slot: unknown): WalletState {
  const record = firstRecord(slot);
  if (!record || "error" in record) {
    return {
      wallet,
      accountValue: 0,
      withdrawable: 0,
      positions: [],
      riskLevel: "high",
      error: String(record?.message ?? record?.error ?? "Wallet lookup failed"),
      source: "live",
    };
  }

  const marginSummary = firstRecord(record.marginSummary);
  const accountValue = toNumber(marginSummary?.accountValue ?? record.accountValue);
  const withdrawable = toNumber(record.withdrawable);
  const positions = Array.isArray(record.assetPositions)
    ? record.assetPositions.map(normalizePosition).filter((position): position is WalletPosition => Boolean(position))
    : [];
  const used = Math.max(0, accountValue - withdrawable);
  const riskLevel = accountValue > 0 && used / accountValue > 0.78 ? "high" : used / Math.max(accountValue, 1) > 0.45 ? "medium" : "low";

  return {
    wallet,
    accountValue,
    withdrawable,
    marginUsed: Number(used.toFixed(2)),
    positions,
    riskLevel,
    source: "live",
  };
}

function normalizePosition(value: unknown): WalletPosition | undefined {
  const wrapper = firstRecord(value);
  const position = firstRecord(wrapper?.position ?? wrapper);
  if (!position) return undefined;

  const size = toNumber(position.szi ?? position.size);
  if (size === 0) return undefined;

  return {
    coin: String(position.coin ?? "UNKNOWN"),
    side: size >= 0 ? "long" : "short",
    size: Math.abs(size),
    entryPx: maybeNumber(position.entryPx),
    unrealizedPnl: maybeNumber(position.unrealizedPnl),
    leverage: maybeNumber(firstRecord(position.leverage)?.value),
    liquidationPx: maybeNumber(position.liquidationPx),
  };
}
