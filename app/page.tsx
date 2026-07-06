"use client";

import { useEffect, useMemo, useState } from "react";
import { initialDemoEvents } from "@/lib/demo-data";
import { compact, currency, shortAddress, timeOnly } from "@/lib/format";
import type { FlowEvent, StreamPayload, WalletState, WalletStats } from "@/lib/types";

const MAX_EVENTS = 80;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export default function Home() {
  const [events, setEvents] = useState<FlowEvent[]>(initialDemoEvents);
  const [status, setStatus] = useState("Booting HyperFlow Radar in demo mode.");
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState("");
  const [walletStates, setWalletStates] = useState<WalletState[]>([]);
  const [walletMessage, setWalletMessage] = useState("Click a wallet from the tape or paste an address.");

  useEffect(() => {
    const saved = window.localStorage.getItem("hyperflow-watchlist");
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      setWatchlist(parsed.filter((wallet) => WALLET_RE.test(wallet)).slice(0, 50));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hyperflow-watchlist", JSON.stringify(watchlist));
    if (watchlist.length === 0) {
      setWalletStates([]);
      return;
    }

    const controller = new AbortController();
    setWalletMessage("Refreshing batchClearinghouseState for watched wallets...");
    fetch("/api/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallets: watchlist }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { states?: WalletState[]; mode?: "live" | "demo"; message?: string; error?: string }) => {
        setWalletStates(data.states ?? []);
        setWalletMessage(data.message ?? (data.mode === "live" ? "Live GoldRush batch account state loaded." : "Demo wallet state loaded."));
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
      setStatus("Stream reconnecting. Demo data remains visible.");
    };
    return () => source.close();
  }, []);

  const flowEvents = events.filter((event) => event.kind === "fill");
  const liquidations = events.filter((event) => event.kind === "liquidation");
  const topWallets = useMemo(() => aggregateWallets(events), [events]);
  const coinClusters = useMemo(() => aggregateLiquidations(liquidations), [liquidations]);
  const totalVolume = events.reduce((sum, event) => sum + event.notional, 0);
  const largestLiquidation = liquidations[0];

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

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="grid gap-4 rounded-lg border border-line bg-white/70 p-5 shadow-soft lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">HyperFlow Radar</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${mode === "live" ? "bg-mint text-white" : "bg-gold text-white"}`}>
                {mode} mode
              </span>
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight sm:text-5xl">
              Hyperliquid smart-money and liquidation radar powered by GoldRush.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink/70">
              Most Hyperliquid apps show the same wallet and market screens because public APIs expose the same commodity data.
              This POC shows the GoldRush story: global flow, liquidations, and batch wallet risk in one operator-grade dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Metric label="Rolling notional" value={currency(totalVolume)} />
            <Metric label="Tracked wallets" value={String(topWallets.length)} />
            <Metric label="Liquidations" value={String(liquidations.length)} />
          </div>
        </header>

        <div className="rounded-lg border border-line bg-panel/80 p-3 text-sm text-ink/75">
          <strong>Status:</strong> {status}
        </div>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-5">
            <Panel title="Live Flow Tape" subtitle="Global fills without manually knowing every wallet first.">
              <FlowTape events={flowEvents} onWatch={addWallet} />
            </Panel>
            <Panel title="Top Wallets" subtitle="Rolling smart-money candidates built from the live tape.">
              <TopWallets wallets={topWallets} onWatch={addWallet} />
            </Panel>
          </div>

          <div className="grid gap-5">
            <Panel title="Liquidation Radar" subtitle="GoldRush-native liquidation flow for alerts and risk monitoring.">
              <LiquidationRadar events={liquidations} clusters={coinClusters} largest={largestLiquidation} onWatch={addWallet} />
            </Panel>
            <Panel title="Wallet Watchlist" subtitle="Batch account state for up to 50 wallets in one GoldRush request.">
              <form
                className="mb-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addWallet(walletInput);
                }}
              >
                <input
                  className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-gold"
                  value={walletInput}
                  onChange={(event) => setWalletInput(event.target.value)}
                  placeholder="0x wallet address"
                />
                <button className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white" type="submit">
                  Add
                </button>
              </form>
              <p className="mb-4 text-sm text-ink/65">{walletMessage}</p>
              <Watchlist wallets={watchlist} states={walletStates} onRemove={removeWallet} />
            </Panel>
          </div>
        </section>

        <Panel title="Powered by GoldRush" subtitle="The interview narrative in one place.">
          <div className="grid gap-3 md:grid-cols-3">
            <StoryCard title="Global flow" body="allFills turns the live tape into a rolling census of active Hyperliquid traders." />
            <StoryCard title="Liquidation context" body="liquidationFills surfaces events that are painful to reconstruct from public primitives." />
            <StoryCard title="Batch wallet risk" body="batchClearinghouseState loads many wallet states in one request instead of single-wallet fan-out." />
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-ink/50">{label}</div>
      <div className="mt-2 text-2xl font-black number-tabular">{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white/80 p-4 shadow-soft">
      <div className="mb-4">
        <h2 className="text-lg font-black">{title}</h2>
        <p className="text-sm text-ink/60">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function FlowTape({ events, onWatch }: { events: FlowEvent[]; onWatch: (wallet: string) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="grid grid-cols-[0.8fr_1fr_0.7fr_0.7fr_0.9fr_0.7fr] gap-2 bg-ink px-3 py-2 text-xs font-bold uppercase text-white">
        <span>Time</span>
        <span>Wallet</span>
        <span>Coin</span>
        <span>Side</span>
        <span>Notional</span>
        <span>Action</span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {events.slice(0, 36).map((event) => (
          <div key={event.id} className="grid grid-cols-[0.8fr_1fr_0.7fr_0.7fr_0.9fr_0.7fr] items-center gap-2 border-t border-line px-3 py-2 text-sm">
            <span className="number-tabular text-ink/55">{timeOnly(event.timestamp)}</span>
            <button className="text-left font-bold text-ink underline-offset-2 hover:underline" onClick={() => onWatch(event.wallet)}>
              {shortAddress(event.wallet)}
            </button>
            <span className="font-black">{event.coin}</span>
            <span className={event.side === "buy" ? "font-bold text-mint" : "font-bold text-flame"}>{event.side}</span>
            <span className="number-tabular">{currency(event.notional)}</span>
            <button className="rounded-md border border-line px-2 py-1 text-xs font-bold hover:border-gold" onClick={() => onWatch(event.wallet)}>
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
          className="rounded-lg border border-line bg-panel p-4 text-left hover:border-gold"
          onClick={() => onWatch(wallet.wallet)}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-ink/50">Rank {index + 1}</span>
            <span className="text-xs font-bold text-ink/50">{wallet.fills} fills</span>
          </div>
          <div className="mt-2 font-black">{shortAddress(wallet.wallet)}</div>
          <div className="mt-2 text-2xl font-black number-tabular">{currency(wallet.volume)}</div>
          <div className="mt-2 text-sm text-ink/65">
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
        <div className="rounded-lg border border-flame bg-flame/10 p-4">
          <div className="text-xs font-black uppercase text-flame">Largest recent liquidation</div>
          <div className="mt-2 text-2xl font-black">{largest.coin} {currency(largest.notional)}</div>
          <button className="mt-2 text-sm font-bold underline" onClick={() => onWatch(largest.wallet)}>
            Watch {shortAddress(largest.wallet)}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {clusters.slice(0, 4).map((cluster) => (
          <div key={cluster.coin} className="rounded-lg border border-line bg-panel p-3">
            <div className="font-black">{cluster.coin}</div>
            <div className="text-sm text-ink/65">{cluster.count} events · {compact(cluster.notional)}</div>
          </div>
        ))}
      </div>
      <div className="max-h-72 overflow-auto rounded-lg border border-line">
        {events.slice(0, 14).map((event) => (
          <div key={event.id} className="border-t border-line px-3 py-2 first:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-black">{event.coin}</span>
              <span className="font-bold text-flame">{currency(event.notional)}</span>
            </div>
            <div className="mt-1 text-sm text-ink/60">
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
    return <div className="rounded-lg border border-dashed border-line p-5 text-sm text-ink/60">No watched wallets yet.</div>;
  }

  return (
    <div className="grid gap-3">
      {wallets.map((wallet) => {
        const state = states.find((item) => item.wallet.toLowerCase() === wallet.toLowerCase());
        return (
          <div key={wallet} className="rounded-lg border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-black">{shortAddress(wallet)}</div>
                <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold uppercase ${riskClass(state?.riskLevel)}`}>
                  {state?.riskLevel ?? "loading"} risk
                </div>
              </div>
              <button className="rounded-md border border-line px-2 py-1 text-xs font-bold" onClick={() => onRemove(wallet)}>
                Remove
              </button>
            </div>
            {state ? (
              state.error ? (
                <p className="mt-3 text-sm text-flame">{state.error}</p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <MetricMini label="Account" value={currency(state.accountValue)} />
                    <MetricMini label="Withdrawable" value={currency(state.withdrawable)} />
                  </div>
                  <div className="mt-3 grid gap-2">
                    {state.positions.slice(0, 3).map((position) => (
                      <div key={`${wallet}-${position.coin}-${position.side}`} className="rounded-md bg-white p-2 text-sm">
                        <div className="flex justify-between">
                          <strong>{position.coin} {position.side}</strong>
                          <span>{position.leverage ? `${position.leverage}x` : "spot"}</span>
                        </div>
                        <div className="text-ink/60">
                          Size {position.size} · uPnL {currency(position.unrealizedPnl ?? 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              <p className="mt-3 text-sm text-ink/60">Loading...</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-2">
      <div className="text-xs font-bold uppercase text-ink/45">{label}</div>
      <div className="font-black number-tabular">{value}</div>
    </div>
  );
}

function StoryCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/65">{body}</p>
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
  if (risk === "high") return "bg-flame text-white";
  if (risk === "medium") return "bg-gold text-white";
  if (risk === "low") return "bg-mint text-white";
  return "bg-ink/10 text-ink/50";
}
