"use client";

import { useEffect, useMemo, useState } from "react";
import { initialDemoEvents } from "@/lib/demo-data";
import { compact, currency, shortAddress, timeOnly } from "@/lib/format";
import type { RobinhoodChainSnapshot } from "@/lib/robinhood";
import type { FlowEvent, StreamPayload, WalletState, WalletStats } from "@/lib/types";

const MAX_EVENTS = 80;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_ROBINHOOD_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export default function Home() {
  const [activeView, setActiveView] = useState<"robinhood" | "hyperliquid">("robinhood");
  const [events, setEvents] = useState<FlowEvent[]>(initialDemoEvents);
  const [status, setStatus] = useState("Connecting to GoldRush live data surfaces.");
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState("");
  const [walletStates, setWalletStates] = useState<WalletState[]>([]);
  const [walletMessage, setWalletMessage] = useState("Click a Hyperliquid wallet from the tape or paste an address.");
  const [robinhoodWallet, setRobinhoodWallet] = useState(DEFAULT_ROBINHOOD_WALLET);
  const [robinhoodInput, setRobinhoodInput] = useState(DEFAULT_ROBINHOOD_WALLET);
  const [robinhoodSnapshot, setRobinhoodSnapshot] = useState<RobinhoodChainSnapshot | null>(null);
  const [robinhoodMessage, setRobinhoodMessage] = useState("Loading Robinhood Chain launch intelligence...");

  useEffect(() => {
    const saved = window.localStorage.getItem("frontier-desk-watchlist");
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      setWatchlist(parsed.filter((wallet) => WALLET_RE.test(wallet)).slice(0, 50));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("frontier-desk-watchlist", JSON.stringify(watchlist));
    if (watchlist.length === 0) {
      setWalletStates([]);
      return;
    }

    const controller = new AbortController();
    setWalletMessage("Refreshing Hyperliquid batchClearinghouseState for watched wallets...");
    fetch("/api/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallets: watchlist }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { states?: WalletState[]; mode?: "live" | "demo"; message?: string }) => {
        setWalletStates(data.states ?? []);
        setWalletMessage(data.message ?? (data.mode === "live" ? "Live GoldRush Hyperliquid wallet state loaded." : "Demo wallet state loaded."));
      })
      .catch((error) => {
        if (error.name !== "AbortError") setWalletMessage("Wallet refresh failed. Demo mode can still tell the story.");
      });

    return () => controller.abort();
  }, [watchlist]);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onmessage = (message) => {
      const payload = JSON.parse(message.data) as StreamPayload;
      if (payload.type === "status") {
        setMode(payload.mode);
        setStatus(payload.message);
        return;
      }

      setMode(payload.event.source);
      setEvents((current) => [payload.event, ...current].slice(0, MAX_EVENTS));
    };
    source.onerror = () => {
      setStatus("Hyperliquid stream reconnecting. Robinhood Chain data remains available.");
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRobinhoodMessage("Loading Robinhood Chain balances and transactions through GoldRush...");
    fetch(`/api/robinhood?wallet=${encodeURIComponent(robinhoodWallet)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: RobinhoodChainSnapshot | { error?: string }) => {
        if (!("chainName" in data)) {
          setRobinhoodMessage(data.error ?? "Robinhood lookup failed.");
          return;
        }
        setRobinhoodSnapshot(data);
        setRobinhoodMessage(data.message ?? "Robinhood Chain snapshot loaded.");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setRobinhoodMessage("Robinhood Chain lookup failed.");
      });

    return () => controller.abort();
  }, [robinhoodWallet]);

  const flowEvents = events.filter((event) => event.kind === "fill");
  const liquidations = events.filter((event) => event.kind === "liquidation");
  const topWallets = useMemo(() => aggregateWallets(events), [events]);
  const coinClusters = useMemo(() => aggregateLiquidations(liquidations), [liquidations]);
  const totalVolume = events.reduce((sum, event) => sum + event.notional, 0);
  const largestLiquidation = liquidations[0];
  const robinhoodPortfolioValue = robinhoodSnapshot?.balances.reduce((sum, balance) => sum + balance.quote, 0) ?? 0;
  const robinhoodPrimaryTransactions = robinhoodSnapshot?.transactions ?? [];
  const robinhoodActivityCount = robinhoodPrimaryTransactions.length;

  function addWallet(wallet: string) {
    const normalized = wallet.trim();
    if (!WALLET_RE.test(normalized)) {
      setWalletMessage("That does not look like a valid EVM wallet address.");
      return;
    }
    setWatchlist((current) => [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 50));
    setWalletInput("");
  }

  function removeWallet(wallet: string) {
    setWatchlist((current) => current.filter((item) => item !== wallet));
  }

  function inspectRobinhoodWallet(wallet: string) {
    const normalized = wallet.trim();
    if (!WALLET_RE.test(normalized)) {
      setRobinhoodMessage("Enter a valid EVM wallet address for Robinhood Chain.");
      return;
    }
    setRobinhoodWallet(normalized);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-2xl sm:p-8">
          <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-yellow-300/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge tone="green">New on GoldRush</Badge>
                <Badge tone="dark">Robinhood Chain primary</Badge>
                <Badge tone={mode === "live" ? "green" : "amber"}>{mode === "live" ? "Live Hyperliquid stream" : "Demo fallback ready"}</Badge>
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200">Frontier Desk</p>
              <h1 className="mt-3 max-w-5xl text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                Robinhood Chain launch intelligence, powered by GoldRush.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">
                GoldRush says Robinhood Chain is live with 33 APIs, from wallet balances to real-time trading activity.
                This dashboard makes that launch story visible first, then keeps Hyperliquid as the live-flow proof point.
              </p>
            </div>
            <div className="grid gap-3">
              <HeroMetric label="Robinhood chain" value="4663" helper="Frontier Chain" />
              <HeroMetric label="GoldRush coverage" value="33 APIs" helper="22 Foundational + 11 Streaming" />
              <HeroMetric label="Live wallet activity" value={`${robinhoodActivityCount} txs`} helper={robinhoodSnapshot?.source === "live" ? "GoldRush live lookup" : "Launch-demo fallback"} />
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-2">
            <div className="grid grid-cols-2 gap-2">
              <TabButton active={activeView === "robinhood"} onClick={() => setActiveView("robinhood")} title="Robinhood Chain" subtitle="New launch watch" />
              <TabButton active={activeView === "hyperliquid"} onClick={() => setActiveView("hyperliquid")} title="Hyperliquid" subtitle="Live market radar" />
            </div>
          </Card>
          <Card className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Decision</p>
              <p className="text-sm leading-6 text-zinc-700">
                Combining both is smart: Robinhood Chain shows GoldRush&apos;s new-chain coverage, Hyperliquid shows specialized real-time market data.
              </p>
            </div>
            <Badge tone="green">Keep both</Badge>
          </Card>
        </div>

        {activeView === "robinhood" ? (
          <RobinhoodView
            snapshot={robinhoodSnapshot}
            message={robinhoodMessage}
            input={robinhoodInput}
            onInput={setRobinhoodInput}
            onInspect={() => inspectRobinhoodWallet(robinhoodInput)}
            portfolioValue={robinhoodPortfolioValue}
            transactions={robinhoodPrimaryTransactions}
          />
        ) : (
          <HyperliquidView
            status={status}
            totalVolume={totalVolume}
            topWallets={topWallets}
            flowEvents={flowEvents}
            liquidations={liquidations}
            coinClusters={coinClusters}
            largestLiquidation={largestLiquidation}
            walletInput={walletInput}
            walletMessage={walletMessage}
            walletStates={walletStates}
            watchlist={watchlist}
            onWalletInput={setWalletInput}
            onAddWallet={addWallet}
            onRemoveWallet={removeWallet}
          />
        )}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <StoryCard title="Robinhood first" body="The first screen showcases GoldRush's new Robinhood Chain integration: balances, transactions, chain metadata, and API coverage." />
            <StoryCard title="GoldRush platform story" body="One product demonstrates both standard multichain REST APIs and specialized Hyperliquid real-time APIs." />
            <StoryCard title="Client-ready narrative" body="It is easy to explain: new-chain launch intelligence plus live trading surveillance, all routed through GoldRush." />
          </div>
        </Card>
      </section>
    </main>
  );
}

function RobinhoodView({
  snapshot,
  message,
  input,
  onInput,
  onInspect,
  portfolioValue,
  transactions,
}: {
  snapshot: RobinhoodChainSnapshot | null;
  message: string;
  input: string;
  onInput: (value: string) => void;
  onInspect: () => void;
  portfolioValue: number;
  transactions: RobinhoodChainSnapshot["transactions"];
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">Now live</Badge>
              <Badge tone="light">robinhood-mainnet</Badge>
              <Badge tone="light">ETH gas</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">Robinhood Chain Watch</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              A launch monitor for a permissionless, AI-native Layer 2 built for financial services and real-world assets.
            </p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <MetricBlock label="Total APIs" value="33" helper="GoldRush coverage" />
            <MetricBlock label="Foundational" value="22" helper="Balances, txs, logs, prices" />
            <MetricBlock label="Streaming" value="11" helper="Wallet, DEX, OHLCV streams" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <p className="text-sm font-bold text-zinc-500">Inspect Robinhood Chain wallet</p>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={input}
                onChange={(event) => onInput(event.target.value)}
                placeholder="0x wallet address"
              />
            </div>
            <button className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-zinc-950/10 transition hover:bg-zinc-800" onClick={onInspect}>
              Inspect with GoldRush
            </button>
          </div>
          <p className="mt-3 text-sm text-zinc-600">{message}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-zinc-500">Portfolio snapshot</p>
              <h3 className="mt-1 text-3xl font-black">{currency(portfolioValue)}</h3>
            </div>
            <Badge tone={snapshot?.source === "live" ? "green" : "amber"}>{snapshot?.source ?? "loading"}</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {(snapshot?.balances ?? []).slice(0, 6).map((balance) => (
              <div key={`${balance.symbol}-${balance.name}`} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div>
                  <div className="font-black">{balance.symbol}</div>
                  <div className="text-sm text-zinc-500">{balance.name} · {balance.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{currency(balance.quote)}</div>
                  <div className="text-sm text-zinc-500">{balance.balanceDisplay}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5">
        <Card className="bg-zinc-950 p-5 text-white">
          <Badge tone="green">From the GoldRush post</Badge>
          <blockquote className="mt-4 text-2xl font-black leading-tight">
            Support for Robinhood Chain is now live on GoldRush.
          </blockquote>
          <p className="mt-4 leading-7 text-zinc-300">
            The app turns that announcement into a tangible product demo: wallet balances, transactions, API coverage, and a clear path to real-time activity.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-zinc-500">Recent Robinhood Chain activity</p>
              <h3 className="mt-1 text-2xl font-black">Wallet transaction feed</h3>
            </div>
            <Badge tone="light">transactions_v3</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx.hash} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{tx.method ?? "Transaction"}</div>
                    <div className="mt-1 text-sm text-zinc-500">{shortAddress(tx.hash)} · {timeOnly(tx.signedAt)}</div>
                  </div>
                  <Badge tone={tx.successful ? "green" : "amber"}>{tx.successful ? "Success" : "Check"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-600">
                  <div>From {shortAddress(tx.from)}</div>
                  <div>To {shortAddress(tx.to)}</div>
                  <div>Value {currency(tx.valueQuote)}</div>
                  <div>Fees {currency(tx.feesPaid, 4)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-lg font-black">Why this impresses GoldRush</h3>
          <div className="mt-4 grid gap-3">
            <ProofPoint label="New chain" value="Robinhood Chain is the headline, not an afterthought." />
            <ProofPoint label="API breadth" value="The UI explicitly shows 33 APIs: balances, transactions, logs, prices, streams." />
            <ProofPoint label="Builder taste" value="It converts an announcement into a useful launch intelligence product." />
          </div>
        </Card>
      </div>
    </section>
  );
}

function HyperliquidView({
  status,
  totalVolume,
  topWallets,
  flowEvents,
  liquidations,
  coinClusters,
  largestLiquidation,
  walletInput,
  walletMessage,
  walletStates,
  watchlist,
  onWalletInput,
  onAddWallet,
  onRemoveWallet,
}: {
  status: string;
  totalVolume: number;
  topWallets: Array<WalletStats & { coinsList: string[] }>;
  flowEvents: FlowEvent[];
  liquidations: FlowEvent[];
  coinClusters: Array<{ coin: string; count: number; notional: number }>;
  largestLiquidation?: FlowEvent;
  walletInput: string;
  walletMessage: string;
  walletStates: WalletState[];
  watchlist: string[];
  onWalletInput: (value: string) => void;
  onAddWallet: (wallet: string) => void;
  onRemoveWallet: (wallet: string) => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="grid gap-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-zinc-500">Hyperliquid proof point</p>
              <h2 className="mt-1 text-3xl font-black">Live market radar</h2>
            </div>
            <Badge tone="dark">{currency(totalVolume)} rolling notional</Badge>
          </div>
          <p className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-600">{status}</p>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Live Flow Tape" subtitle="Global fills without manually knowing every wallet first." />
          <FlowTape events={flowEvents} onWatch={onAddWallet} />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Top Wallets" subtitle="Rolling smart-money candidates built from the live tape." />
          <TopWallets wallets={topWallets} onWatch={onAddWallet} />
        </Card>
      </div>

      <div className="grid gap-5">
        <Card className="p-5">
          <SectionHeading title="Liquidation Radar" subtitle="GoldRush-native liquidation flow for alerts and risk monitoring." />
          <LiquidationRadar events={liquidations} clusters={coinClusters} largest={largestLiquidation} onWatch={onAddWallet} />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Wallet Watchlist" subtitle="Batch account state for up to 50 wallets in one GoldRush request." />
          <form
            className="mb-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onAddWallet(walletInput);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={walletInput}
              onChange={(event) => onWalletInput(event.target.value)}
              placeholder="0x wallet address"
            />
            <button className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white" type="submit">
              Add
            </button>
          </form>
          <p className="mb-4 text-sm text-zinc-600">{walletMessage}</p>
          <Watchlist wallets={watchlist} states={walletStates} onRemove={onRemoveWallet} />
        </Card>
      </div>
    </section>
  );
}

function Badge({ children, tone = "light" }: { children: React.ReactNode; tone?: "green" | "amber" | "dark" | "light" }) {
  const classes = {
    green: "border-emerald-400/30 bg-emerald-400/15 text-emerald-700",
    amber: "border-amber-400/30 bg-amber-300/20 text-amber-800",
    dark: "border-zinc-700 bg-zinc-900 text-white",
    light: "border-zinc-200 bg-white text-zinc-700",
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes[tone]}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/5 ${className}`}>{children}</section>;
}

function HeroMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-1 text-sm text-zinc-300">{helper}</p>
    </div>
  );
}

function TabButton({ active, title, subtitle, onClick }: { active: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-2xl p-4 text-left transition ${active ? "bg-zinc-950 text-white shadow-lg" : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}
      onClick={onClick}
    >
      <div className="font-black">{title}</div>
      <div className={`mt-1 text-xs ${active ? "text-zinc-300" : "text-zinc-500"}`}>{subtitle}</div>
    </button>
  );
}

function MetricBlock({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-1 text-sm text-zinc-500">{helper}</p>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="text-sm text-zinc-500">{subtitle}</p>
    </div>
  );
}

function StoryCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
    </div>
  );
}

function ProofPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <p className="mt-1 text-sm leading-6 text-zinc-700">{value}</p>
    </div>
  );
}

function FlowTape({ events, onWatch }: { events: FlowEvent[]; onWatch: (wallet: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <div className="grid grid-cols-[0.8fr_1fr_0.7fr_0.7fr_0.9fr_0.7fr] gap-2 bg-zinc-950 px-3 py-2 text-xs font-bold uppercase text-white">
        <span>Time</span>
        <span>Wallet</span>
        <span>Coin</span>
        <span>Side</span>
        <span>Notional</span>
        <span>Action</span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {events.slice(0, 36).map((event) => (
          <div key={event.id} className="grid grid-cols-[0.8fr_1fr_0.7fr_0.7fr_0.9fr_0.7fr] items-center gap-2 border-t border-zinc-200 px-3 py-2 text-sm">
            <span className="number-tabular text-zinc-500">{timeOnly(event.timestamp)}</span>
            <button className="text-left font-bold underline-offset-2 hover:underline" onClick={() => onWatch(event.wallet)}>
              {shortAddress(event.wallet)}
            </button>
            <span className="font-black">{event.coin}</span>
            <span className={event.side === "buy" ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{event.side}</span>
            <span className="number-tabular">{currency(event.notional)}</span>
            <button className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-bold hover:border-emerald-500" onClick={() => onWatch(event.wallet)}>
              Watch
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopWallets({ wallets, onWatch }: { wallets: Array<WalletStats & { coinsList: string[] }>; onWatch: (wallet: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {wallets.slice(0, 6).map((wallet, index) => (
        <button
          key={wallet.wallet}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left hover:border-emerald-500"
          onClick={() => onWatch(wallet.wallet)}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-zinc-500">Rank {index + 1}</span>
            <span className="text-xs font-bold text-zinc-500">{wallet.fills} fills</span>
          </div>
          <div className="mt-2 font-black">{shortAddress(wallet.wallet)}</div>
          <div className="mt-2 text-2xl font-black number-tabular">{currency(wallet.volume)}</div>
          <div className="mt-2 text-sm text-zinc-600">
            {wallet.coinsList.join(", ")} · PnL {currency(wallet.pnl)}
          </div>
        </button>
      ))}
    </div>
  );
}

function LiquidationRadar({
  events,
  clusters,
  largest,
  onWatch,
}: {
  events: FlowEvent[];
  clusters: Array<{ coin: string; count: number; notional: number }>;
  largest?: FlowEvent;
  onWatch: (wallet: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {largest ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs font-black uppercase text-rose-600">Largest recent liquidation</div>
          <div className="mt-2 text-2xl font-black">{largest.coin} {currency(largest.notional)}</div>
          <button className="mt-2 text-sm font-bold underline" onClick={() => onWatch(largest.wallet)}>
            Watch {shortAddress(largest.wallet)}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {clusters.slice(0, 4).map((cluster) => (
          <div key={cluster.coin} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="font-black">{cluster.coin}</div>
            <div className="text-sm text-zinc-600">{cluster.count} events · {compact(cluster.notional)}</div>
          </div>
        ))}
      </div>
      <div className="max-h-72 overflow-auto rounded-2xl border border-zinc-200">
        {events.slice(0, 14).map((event) => (
          <div key={event.id} className="border-t border-zinc-200 px-3 py-2 first:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-black">{event.coin}</span>
              <span className="font-bold text-rose-600">{currency(event.notional)}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              {event.liquidation?.method ?? "Liquidation"} · {shortAddress(event.wallet)} · {timeOnly(event.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Watchlist({ wallets, states, onRemove }: { wallets: string[]; states: WalletState[]; onRemove: (wallet: string) => void }) {
  if (wallets.length === 0) {
    return <div className="rounded-2xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500">No watched wallets yet.</div>;
  }

  return (
    <div className="grid gap-3">
      {wallets.map((wallet) => {
        const state = states.find((item) => item.wallet.toLowerCase() === wallet.toLowerCase());
        return (
          <div key={wallet} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-black">{shortAddress(wallet)}</div>
                <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold uppercase ${riskClass(state?.riskLevel)}`}>
                  {state?.riskLevel ?? "loading"} risk
                </div>
              </div>
              <button className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-bold" onClick={() => onRemove(wallet)}>
                Remove
              </button>
            </div>
            {state ? (
              state.error ? (
                <p className="mt-3 text-sm text-rose-600">{state.error}</p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <MetricMini label="Account" value={currency(state.accountValue)} />
                    <MetricMini label="Withdrawable" value={currency(state.withdrawable)} />
                  </div>
                  <div className="mt-3 grid gap-2">
                    {state.positions.slice(0, 3).map((position) => (
                      <div key={`${wallet}-${position.coin}-${position.side}`} className="rounded-xl bg-white p-2 text-sm">
                        <div className="flex justify-between">
                          <strong>{position.coin} {position.side}</strong>
                          <span>{position.leverage ? `${position.leverage}x` : "spot"}</span>
                        </div>
                        <div className="text-zinc-500">
                          Size {position.size} · uPnL {currency(position.unrealizedPnl ?? 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              <p className="mt-3 text-sm text-zinc-500">Loading...</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2">
      <div className="text-xs font-bold uppercase text-zinc-400">{label}</div>
      <div className="font-black number-tabular">{value}</div>
    </div>
  );
}

function aggregateWallets(events: FlowEvent[]) {
  const stats = new Map<string, WalletStats>();
  for (const event of events) {
    const existing =
      stats.get(event.wallet) ??
      ({
        wallet: event.wallet,
        volume: 0,
        fills: 0,
        pnl: 0,
        coins: new Set<string>(),
        lastSeen: event.timestamp,
      } satisfies WalletStats);
    existing.volume += event.notional;
    existing.fills += 1;
    existing.pnl += event.closedPnl ?? 0;
    existing.coins.add(event.coin);
    existing.lastSeen = event.timestamp;
    stats.set(event.wallet, existing);
  }

  return Array.from(stats.values())
    .sort((a, b) => b.volume - a.volume)
    .map((wallet) => ({ ...wallet, coinsList: Array.from(wallet.coins).slice(0, 4) }));
}

function aggregateLiquidations(events: FlowEvent[]) {
  const stats = new Map<string, { coin: string; count: number; notional: number }>();
  for (const event of events) {
    const existing = stats.get(event.coin) ?? { coin: event.coin, count: 0, notional: 0 };
    existing.count += 1;
    existing.notional += event.notional;
    stats.set(event.coin, existing);
  }
  return Array.from(stats.values()).sort((a, b) => b.notional - a.notional);
}

function riskClass(risk?: WalletState["riskLevel"]) {
  if (risk === "high") return "bg-rose-600 text-white";
  if (risk === "medium") return "bg-amber-500 text-white";
  if (risk === "low") return "bg-emerald-600 text-white";
  return "bg-zinc-200 text-zinc-500";
}
