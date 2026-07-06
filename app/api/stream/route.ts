import { makeDemoEvent } from "@/lib/demo-data";
import { hasGoldRushKey, normalizeWsEvent } from "@/lib/goldrush";
import type { FlowEvent, StreamPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function sse(payload: StreamPayload) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function subscribe(socket: WebSocket, type: string) {
  socket.send(JSON.stringify({ method: "subscribe", subscription: { type } }));
}

export async function GET(request: Request) {
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let stopped = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let socket: WebSocket | undefined;
      let demoIndex = 50;

      const stop = () => {
        stopped = true;
        if (timer) {
          clearInterval(timer);
          timer = undefined;
        }
        if (socket && socket.readyState < 2) socket.close();
      };

      cleanup = stop;
      request.signal.addEventListener("abort", stop, { once: true });

      const enqueue = (payload: StreamPayload) => {
        if (stopped || controller.desiredSize === null) {
          stop();
          return;
        }
        try {
          controller.enqueue(sse(payload));
        } catch {
          stop();
        }
      };

      const emit = (event: FlowEvent) => {
        enqueue({ type: "event", event });
      };

      const startDemo = (reason: string) => {
        if (timer) return;
        enqueue({ type: "status", mode: "demo", message: reason });
        timer = setInterval(() => {
          if (stopped || controller.desiredSize === null) {
            stop();
            return;
          }
          emit(makeDemoEvent(demoIndex++));
        }, 1600);
      };

      if (!hasGoldRushKey()) {
        startDemo("Demo mode: add GOLDRUSH_API_KEY in .env.local for live Hyperliquid flow.");
      } else {
        enqueue({ type: "status", mode: "live", message: "Connecting to GoldRush Hyperliquid WebSocket." });
        try {
          socket = new WebSocket(`wss://hypercore.goldrushdata.com/ws?key=${process.env.GOLDRUSH_API_KEY}`);
          socket.addEventListener("open", () => {
            enqueue({ type: "status", mode: "live", message: "Live GoldRush stream connected." });
            subscribe(socket as WebSocket, "allFills");
            subscribe(socket as WebSocket, "liquidationFills");
          });
          socket.addEventListener("message", (message) => {
            try {
              const parsed = JSON.parse(String(message.data)) as unknown;
              const event = normalizeWsEvent(parsed);
              if (event) emit(event);
            } catch {
              // Ignore heartbeat or non-JSON frames.
            }
          });
          socket.addEventListener("error", () => {
            if (!timer) startDemo("Live stream error: falling back to demo mode for the showcase.");
          });
          socket.addEventListener("close", () => {
            if (!stopped && !timer) startDemo("Live stream closed: falling back to demo mode.");
          });
        } catch {
          startDemo("Could not start live stream: falling back to demo mode.");
        }
      }
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
