import { hasGoldRushKey } from "@/lib/goldrush";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    app: "HyperFlow Radar",
    goldrushKeyConfigured: hasGoldRushKey(),
    liveEndpoints: {
      rest: "POST https://hypercore.goldrushdata.com/info",
      websocket: "wss://hypercore.goldrushdata.com/ws?key=<server-side-key>",
    },
  });
}
