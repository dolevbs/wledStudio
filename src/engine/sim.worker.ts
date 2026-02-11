/// <reference lib="webworker" />

import { createWledEngine } from "@/engine/wasmClient";
import type { WledEngine } from "@/engine/softwareEngine";

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

let engine: WledEngine | null = null;
let ledCount = 300;
let running = false;
let simTickRate = 30;
let simulatedMillis = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function tickIntervalMs(): number {
  return Math.max(1, Math.floor(1000 / Math.max(1, simTickRate)));
}

function scheduleLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (!running || !engine) {
    return;
  }

  timer = setInterval(() => {
    simulatedMillis += tickIntervalMs();
    const frame = engine!.renderFrame(simulatedMillis);
    const error = engine!.getLastError();
    postMessage({
      type: "frame",
      simulatedMillis,
      frame,
      error
    });
  }, tickIntervalMs());
}

async function initEngine(requestedLedCount: number): Promise<void> {
  ledCount = Math.max(1, Math.round(requestedLedCount));
  engine = await createWledEngine();
  engine.init(ledCount);
  simulatedMillis = 0;
  postMessage({
    type: "ready",
    ledCount,
    bufferSize: engine.getBufferSize()
  });
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init": {
      simTickRate = Math.max(1, Math.round(message.simTickRate));
      await initEngine(message.ledCount);
      scheduleLoop();
      return;
    }
    case "running": {
      running = message.running;
      scheduleLoop();
      return;
    }
    case "topology": {
      if (!engine) {
        await initEngine(message.ledCount);
      } else {
        ledCount = Math.max(1, Math.round(message.ledCount));
        engine.init(ledCount);
      }
      scheduleLoop();
      return;
    }
    case "json": {
      if (!engine) {
        await initEngine(ledCount);
      }
      engine!.jsonCommand(message.payload);
      return;
    }
    case "reset": {
      simulatedMillis = 0;
      if (engine) {
        engine.init(ledCount);
      }
      return;
    }
    default:
      return;
  }
};
