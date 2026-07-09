import { validWallet } from "./goldrush";

const CHAIN_NAME = "robinhood-mainnet";
const BASE_URL = `https://api.covalenthq.com/v1/${CHAIN_NAME}`;

type UnknownRecord = Record<string, unknown>;

export type RobinhoodBalance = {
  symbol: string;
  name: string;
  type: string;
  balanceDisplay: string;
  quote: number;
  quoteRate: number;
};

export type RobinhoodTransaction = {
  hash: string;
  signedAt: string;
  from: string;
  to: string;
  successful: boolean;
  valueQuote: number;
  feesPaid: number;
  method?: string;
};

export type RobinhoodChainSnapshot = {
  wallet: string;
  chainName: "robinhood-mainnet";
  chainId: 4663;
  support: {
    totalApis: number;
    foundationalApis: number;
    streamingApis: number;
  };
  balances: RobinhoodBalance[];
  transactions: RobinhoodTransaction[];
  source: "live" | "demo";
  message?: string;
};

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function dataItems(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return Array.isArray(data?.items) ? data.items : [];
}

function displayBalance(item: UnknownRecord) {
  const balance = asNumber(item.balance);
  const decimals = asNumber(item.contract_decimals);
  if (balance === 0) return "0";
  const scaled = decimals > 0 ? balance / 10 ** decimals : balance;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(scaled);
}

function normalizeBalance(item: unknown): RobinhoodBalance | undefined {
  const record = asRecord(item);
  if (!record) return undefined;
  const symbol = String(record.contract_ticker_symbol ?? record.native_token ?? "TOKEN");
  const name = String(record.contract_name ?? symbol);
  return {
    symbol,
    name,
    type: String(record.type ?? "cryptocurrency"),
    balanceDisplay: displayBalance(record),
    quote: asNumber(record.quote),
    quoteRate: asNumber(record.quote_rate),
  };
}

function normalizeTransaction(item: unknown): RobinhoodTransaction | undefined {
  const record = asRecord(item);
  if (!record) return undefined;
  const hash = String(record.tx_hash ?? record.hash ?? "");
  if (!hash) return undefined;

  return {
    hash,
    signedAt: String(record.block_signed_at ?? record.signed_at ?? new Date().toISOString()),
    from: String(record.from_address ?? ""),
    to: String(record.to_address ?? ""),
    successful: Boolean(record.successful ?? true),
    valueQuote: asNumber(record.value_quote),
    feesPaid: asNumber(record.fees_paid_quote ?? record.gas_quote ?? record.fee_quote),
    method: typeof record.method === "string" ? record.method : undefined,
  };
}

async function fetchGoldRush(path: string, key: string) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${BASE_URL}${path}${separator}key=${encodeURIComponent(key)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GoldRush Robinhood API returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function fetchRobinhoodSnapshot(wallet: string): Promise<RobinhoodChainSnapshot> {
  if (!validWallet(wallet)) throw new Error("Invalid wallet address");

  const key = process.env.GOLDRUSH_API_KEY?.trim();
  if (!key) return demoRobinhoodSnapshot(wallet, "Demo mode: add GOLDRUSH_API_KEY for live Robinhood Chain data.");

  try {
    const [balancesPayload, transactionsPayload] = await Promise.all([
      fetchGoldRush(`/address/${wallet}/balances_v2/`, key),
      fetchGoldRush(`/address/${wallet}/transactions_v3/?page-size=8`, key),
    ]);

    const balances = dataItems(balancesPayload).map(normalizeBalance).filter((item): item is RobinhoodBalance => Boolean(item));
    const transactions = dataItems(transactionsPayload)
      .map(normalizeTransaction)
      .filter((item): item is RobinhoodTransaction => Boolean(item));

    return {
      wallet,
      chainName: CHAIN_NAME,
      chainId: 4663,
      support: { totalApis: 33, foundationalApis: 22, streamingApis: 11 },
      balances,
      transactions,
      source: "live",
      message:
        balances.length || transactions.length
          ? "Live Robinhood Chain data loaded through GoldRush."
          : "GoldRush responded live, but this wallet has no visible Robinhood Chain activity yet.",
    };
  } catch (error) {
    return demoRobinhoodSnapshot(
      wallet,
      error instanceof Error ? `${error.message}; showing launch-demo data.` : "Showing launch-demo data.",
    );
  }
}

export function demoRobinhoodSnapshot(wallet: string, message = "Launch-demo Robinhood Chain data."): RobinhoodChainSnapshot {
  return {
    wallet,
    chainName: CHAIN_NAME,
    chainId: 4663,
    support: { totalApis: 33, foundationalApis: 22, streamingApis: 11 },
    source: "demo",
    message,
    balances: [
      {
        symbol: "ETH",
        name: "Ether",
        type: "native",
        balanceDisplay: "2.4639",
        quote: 8632.44,
        quoteRate: 3503.57,
      },
      {
        symbol: "RWA",
        name: "Tokenized Asset Basket",
        type: "erc20",
        balanceDisplay: "18,420",
        quote: 18420,
        quoteRate: 1,
      },
      {
        symbol: "HOODX",
        name: "Robinhood Chain Demo Token",
        type: "erc20",
        balanceDisplay: "912.45",
        quote: 2748.82,
        quoteRate: 3.012,
      },
    ],
    transactions: [
      {
        hash: "0x8f4a2c98b0b54fbbd47f0f0c9152f8b3d2ce8f5f6c2ab49367f141be0d4c9a88",
        signedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
        from: wallet,
        to: "0x85d1b536b148798b5a7a27538945dc6ab31f2d11",
        successful: true,
        valueQuote: 2420.14,
        feesPaid: 0.018,
        method: "Transfer",
      },
      {
        hash: "0x29cb3d28f1f3d1a9b753cdd91a2f611eac859f12b4d4ba64f3d6fc872882cf0d",
        signedAt: new Date(Date.now() - 33 * 60 * 1000).toISOString(),
        from: "0x6f9a2b7c49f7f173c5d8b1b845858ac318d8a113",
        to: wallet,
        successful: true,
        valueQuote: 10320.66,
        feesPaid: 0.021,
        method: "Mint",
      },
      {
        hash: "0x4d77dd1ef3c0a8288b77e8e6251bbcad8f5e73093af2bd6d79a3474d10de3f12",
        signedAt: new Date(Date.now() - 81 * 60 * 1000).toISOString(),
        from: wallet,
        to: "0x4b8f51a0098f4d9fa551eed9294d17f94d05aa51",
        successful: true,
        valueQuote: 612.8,
        feesPaid: 0.012,
        method: "Approve",
      },
    ],
  };
}
