/// <reference lib="webworker" />

import { createWledEngine } from "@/engine/wasmClient";
import { renderCompositedFrame } from "@/engine/segmentComposer";
import type { SegmentMap } from "@/engine/segmentComposer";
import type { WledEngine } from "@/engine/softwareEngine";
import type { WledJsonEnvelope } from "@/types/studio";

interface InitMessage {
  type: "init";
  ledCount: number;
  simTickRate: number;
}

interface RunningMessage {
  type: "running";
  running: boolean;
}

interface JsonMessage {
  type: "json";
  payload: string;
}

interface TopologyMessage {
  type: "topology";
  ledCount: number;
}

interface ResetMessage {
  type: "reset";
}

type WorkerMessage = InitMessage | RunningMessage | JsonMessage | TopologyMessage | ResetMessage;

const DEBUG_SIM = true;

let engine: WledEngine | null = null;
let ledCount = 300;
let running = false;
let simTickRate = 30;
let simulatedMillis = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;
let initPromise: Promise<void> | null = null;
let command: WledJsonEnvelope = {};
let mapCache = new Map<string, SegmentMap>();

function debug(event: string, data?: Record<string, unknown>): void {
  if (!DEBUG_SIM) {
    return;
  }
  const payload = {
    type: "diag",
    source: "sim.worker",
    event,
    data: data ?? {}
  };
  postMessage(payload);
  // Worker console output is still useful when inspecting directly.
  console.log("[sim.worker]", event, data ?? {});
}

function tickIntervalMs(): number {
  return Math.max(1, Math.floor(1000 / Math.max(1, simTickRate)));
}

function scheduleLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (!running || !engine) {
    debug("scheduleLoop:idle", {
      running,
      hasEngine: Boolean(engine),
      ledCount,
      simTickRate
    });
    return;
  }

  debug("scheduleLoop:start", {
    intervalMs: tickIntervalMs(),
    simTickRate,
    ledCount
  });
  timer = setInterval(() => {
    try {
      simulatedMillis += tickIntervalMs();
      const frame = renderCompositedFrame(engine!, command, ledCount, simulatedMillis, mapCache);
      const error = engine!.getLastError();
      tickCount += 1;
      if (tickCount % 30 === 0) {
        debug("tick", {
          simulatedMillis,
          frameSize: frame.length,
          frameHead: [frame[0] ?? 0, frame[1] ?? 0, frame[2] ?? 0],
          engineError: error || ""
        });
      }
      postMessage({
        type: "frame",
        simulatedMillis,
        frame,
        error
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug("tick:render:error", { message, simulatedMillis });
      running = false;
      scheduleLoop();
      postMessage({
        type: "frame",
        simulatedMillis,
        frame: new Uint8Array(Math.max(ledCount * 3, 3)),
        error: `Render failure: ${message}. Simulation paused to prevent error loop.`
      });
    }
  }, tickIntervalMs());
}

async function initEngine(requestedLedCount: number): Promise<void> {
  ledCount = Math.max(1, Math.round(requestedLedCount));
  debug("initEngine:begin", { requestedLedCount, resolvedLedCount: ledCount });
  engine = await createWledEngine();
  engine.init(ledCount);
  simulatedMillis = 0;
  tickCount = 0;
  debug("initEngine:ready", {
    ledCount,
    bufferSize: engine.getBufferSize(),
    engineType: engine.constructor?.name ?? "unknown"
  });
  postMessage({
    type: "ready",
    ledCount,
    bufferSize: engine.getBufferSize()
  });
}

async function ensureEngine(requestedLedCount: number): Promise<void> {
  if (engine) {
    return;
  }
  if (!initPromise) {
    initPromise = initEngine(requestedLedCount).finally(() => {
      initPromise = null;
    });
  }
  await initPromise;
}

self.addEventListener("error", (event) => {
  debug("worker:error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

self.addEventListener("unhandledrejection", (event) => {
  debug("worker:unhandledrejection", {
    reason: String(event.reason)
  });
});

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  debug("onmessage", { type: message.type });

  switch (message.type) {
    case "init": {
      simTickRate = Math.max(1, Math.round(message.simTickRate));
      if (initPromise) {
        await initPromise;
      }
      if (!engine) {
        await initEngine(message.ledCount);
      } else {
        ledCount = Math.max(1, Math.round(message.ledCount));
        engine.init(ledCount);
        simulatedMillis = 0;
        tickCount = 0;
        debug("initEngine:reinit", { ledCount });
      }
      scheduleLoop();
      return;
    }
    case "running": {
      running = message.running;
      debug("running:update", { running });
      scheduleLoop();
      return;
    }
    case "topology": {
      await ensureEngine(message.ledCount);
      ledCount = Math.max(1, Math.round(message.ledCount));
      engine!.init(ledCount);
      mapCache = new Map();
      scheduleLoop();
      return;
    }
    case "json": {
      await ensureEngine(ledCount);
      debug("json:apply", { payloadPreview: message.payload.slice(0, 180) });
      try {
        const parsed = JSON.parse(message.payload) as WledJsonEnvelope;
        command = parsed;
        mapCache = new Map();
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        debug("json:parse:error", { message: messageText });
      }
      return;
    }
    case "reset": {
      simulatedMillis = 0;
      tickCount = 0;
      mapCache = new Map();
      if (engine) {
        engine.init(ledCount);
      }
      debug("clock:reset", { ledCount });
      return;
    }
    default:
      return;
  }
};
