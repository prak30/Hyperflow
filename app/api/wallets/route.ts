import { demoWalletState } from "@/lib/demo-data";
import { fetchBatchClearinghouseState, hasGoldRushKey, validWallet } from "@/lib/goldrush";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { wallets?: unknown };
  const wallets = Array.isArray(body.wallets)
    ? Array.from(new Set(body.wallets.filter((item): item is string => typeof item === "string").map((item) => item.trim())))
        .filter(validWallet)
        .slice(0, 50)
    : [];

  if (wallets.length === 0) {
    return Response.json({ states: [], mode: "demo", error: "No valid wallet addresses supplied." }, { status: 400 });
  }

  if (!hasGoldRushKey()) {
    return Response.json({
      states: wallets.map((wallet, index) => demoWalletState(wallet, index)),
      mode: "demo",
      message: "Demo wallet states. Add GOLDRUSH_API_KEY for live batchClearinghouseState.",
    });
  }

  try {
    const states = await fetchBatchClearinghouseState(wallets);
    return Response.json({ states, mode: "live" });
  } catch (error) {
    return Response.json({
      states: wallets.map((wallet, index) => demoWalletState(wallet, index)),
      mode: "demo",
      message: error instanceof Error ? error.message : "GoldRush lookup failed; returned demo states.",
    });
  }
}
