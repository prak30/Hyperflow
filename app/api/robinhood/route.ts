import { fetchRobinhoodSnapshot } from "@/lib/robinhood";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet")?.trim() ?? "";

  try {
    const snapshot = await fetchRobinhoodSnapshot(wallet);
    return Response.json(snapshot);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Robinhood Chain lookup failed.",
      },
      { status: 400 },
    );
  }
}
