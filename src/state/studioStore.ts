import { create } from "zustand";

import { sanitizeTopology, sanitizeWledEnvelope } from "@/io/sanitize";
import type { SimulationConfig, StudioTopology, WledJsonEnvelope, WledSegmentPayload } from "@/types/studio";

export interface StudioState {
  topology: StudioTopology;
  simulation: SimulationConfig;
  command: WledJsonEnvelope;
  rawJson: string;
  warnings: string[];
  lastError: string;
  frame: Uint8Array;
  simulatedMillis: number;
  setMode: (mode: "strip" | "matrix") => void;
  setDimensions: (width: number, height: number) => void;
  setLedCount: (count: number) => void;
  setSerpentine: (enabled: boolean) => void;
  setGaps: (gaps: string) => void;
  setControl: (key: "on" | "bri" | "fx" | "sx" | "ix", value: number | boolean) => void;
  setRawJson: (raw: string) => void;
  applyRawJson: () => string | null;
  setRunning: (running: boolean) => void;
  resetClock: () => void;
  setFrame: (frame: Uint8Array, simulatedMillis: number, error: string) => void;
  replaceTopology: (topology: StudioTopology) => void;
  replaceCommand: (command: WledJsonEnvelope, warnings?: string[]) => void;
}

const DEFAULT_TOPOLOGY: StudioTopology = {
  mode: "matrix",
  ledCount: 900,
  width: 30,
  height: 30,
  serpentine: true,
  gaps: []
};

const DEFAULT_COMMAND: WledJsonEnvelope = {
  on: true,
  bri: 180,
  seg: {
    fx: 8,
    sx: 128,
    ix: 128,
    col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
  }
};

const DEFAULT_SIMULATION: SimulationConfig = {
  running: true,
  simTickRate: 30,
  renderTickRate: 60,
  startMillis: 0
};

function stringifyCommand(command: WledJsonEnvelope): string {
  return JSON.stringify(command, null, 2);
}

function normalizeDimensions(mode: "strip" | "matrix", width: number, height: number, ledCount: number): Pick<StudioTopology, "width" | "height" | "ledCount"> {
  if (mode === "strip") {
    const safe = Math.max(1, Math.round(ledCount));
    return { width: safe, height: 1, ledCount: safe };
  }

  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  return {
    width: safeWidth,
    height: safeHeight,
    ledCount: safeWidth * safeHeight
  };
}

export const useStudioStore = create<StudioState>((set, get) => ({
  topology: DEFAULT_TOPOLOGY,
  simulation: DEFAULT_SIMULATION,
  command: DEFAULT_COMMAND,
  rawJson: stringifyCommand(DEFAULT_COMMAND),
  warnings: [],
  lastError: "",
  frame: new Uint8Array(DEFAULT_TOPOLOGY.ledCount * 3),
  simulatedMillis: 0,

  setMode: (mode) =>
    set((state) => {
      const next = normalizeDimensions(mode, state.topology.width, state.topology.height, state.topology.ledCount);
      return {
        topology: {
          ...state.topology,
          mode,
          ...next
        }
      };
    }),

  setDimensions: (width, height) =>
    set((state) => {
      const next = normalizeDimensions(state.topology.mode, width, height, state.topology.ledCount);
      return {
        topology: {
          ...state.topology,
          ...next
        }
      };
    }),

  setLedCount: (count) =>
    set((state) => {
      const safe = Math.max(1, Math.round(count));
      if (state.topology.mode === "matrix") {
        return {};
      }
      return {
        topology: {
          ...state.topology,
          ledCount: safe,
          width: safe,
          height: 1
        }
      };
    }),

  setSerpentine: (enabled) =>
    set((state) => ({
      topology: {
        ...state.topology,
        serpentine: enabled
      }
    })),

  setGaps: (gaps) =>
    set((state) => {
      try {
        const parsed = JSON.parse(gaps);
        const sanitized = sanitizeTopology({ ...state.topology, gaps: parsed });
        return {
          topology: {
            ...state.topology,
            gaps: sanitized.data.gaps
          },
          warnings: sanitized.warnings
        };
      } catch {
        return {
          warnings: ["Invalid gaps JSON. Expected format: [{\"start\":10,\"length\":2}]"].concat(state.warnings)
        };
      }
    }),

  setControl: (key, value) =>
    set((state) => {
      const next: WledJsonEnvelope = {
        ...state.command,
        seg: {
          ...(Array.isArray(state.command.seg) ? state.command.seg[0] : state.command.seg)
        }
      };

      if (key === "on" && typeof value === "boolean") {
        next.on = value;
      } else if (key === "bri" && typeof value === "number") {
        next.bri = Math.max(0, Math.min(255, Math.round(value)));
      } else if ((key === "fx" || key === "sx" || key === "ix") && typeof value === "number") {
        const seg = next.seg as WledSegmentPayload;
        seg[key] = Math.max(0, Math.min(255, Math.round(value)));
      }

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setRawJson: (raw) => set({ rawJson: raw }),

  applyRawJson: () => {
    const current = get();
    try {
      const parsed = JSON.parse(current.rawJson);
      const sanitized = sanitizeWledEnvelope(parsed);
      set({
        command: sanitized.data,
        warnings: sanitized.warnings
      });
      return JSON.stringify(sanitized.data);
    } catch {
      set({ warnings: ["Raw JSON parse error"].concat(current.warnings) });
      return null;
    }
  },

  setRunning: (running) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        running
      }
    })),

  resetClock: () => set({ simulatedMillis: 0 }),

  setFrame: (frame, simulatedMillis, error) =>
    set({
      frame,
      simulatedMillis,
      lastError: error
    }),

  replaceTopology: (topology) => set({ topology }),

  replaceCommand: (command, warnings = []) =>
    set({
      command,
      rawJson: stringifyCommand(command),
      warnings
    })
}));
