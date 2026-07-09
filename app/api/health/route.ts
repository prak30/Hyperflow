import { hasGoldRushKey } from "@/lib/goldrush";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    app: "Frontier Desk",
    goldrushKeyConfigured: hasGoldRushKey(),
    liveEndpoints: {
      robinhood: "GET https://api.covalenthq.com/v1/robinhood-mainnet/...",
      rest: "POST https://hypercore.goldrushdata.com/info",
      websocket: "wss://hypercore.goldrushdata.com/ws?key=<server-side-key>",
    },
  });
}
