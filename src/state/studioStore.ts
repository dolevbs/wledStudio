import { create } from "zustand";

import type { ColorSchemeOption } from "@/config/simulationOptions";
import { WLED_EFFECT_CATALOG } from "@/config/wledEffectCatalog";
import { sanitizeTopology, sanitizeWledEnvelope } from "@/io/sanitize";
import type { SimulationConfig, StudioTopology, WledJsonEnvelope, WledSegmentPayload } from "@/types/studio";

export interface StudioState {
  topology: StudioTopology;
  simulation: SimulationConfig;
  command: WledJsonEnvelope;
  ui: {
    drawerOpen: boolean;
  };
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
  setControl: (key: "on" | "bri" | "fx" | "sx" | "ix" | "pal" | "c1" | "c2", value: number | boolean) => void;
  setColorScheme: (scheme: Pick<ColorSchemeOption, "pal" | "col">) => void;
  setSegmentColor: (slot: 0 | 1 | 2, color: [number, number, number]) => void;
  setRawJson: (raw: string) => void;
  applyRawJson: () => string | null;
  setRunning: (running: boolean) => void;
  resetClock: () => void;
  setFrame: (frame: Uint8Array, simulatedMillis: number, error: string) => void;
  replaceTopology: (topology: StudioTopology) => void;
  replaceCommand: (command: WledJsonEnvelope, warnings?: string[]) => void;
  toggleDrawer: () => void;
}

const DEFAULT_TOPOLOGY: StudioTopology = {
  mode: "matrix",
  ledCount: 150,
  width: 30,
  height: 5,
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
    pal: 0,
    c1: 0,
    c2: 0,
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

type EffectDefaults = Partial<Pick<WledSegmentPayload, "sx" | "ix" | "pal" | "c1" | "c2">>;

function parseEffectDefaults(effectId: number): EffectDefaults {
  const entry = WLED_EFFECT_CATALOG.find((effect) => effect.id === effectId);
  if (!entry) return {};
  const defaultsBlob = entry.metadata.split(";").pop() ?? "";
  if (!defaultsBlob.includes("=")) return {};

  const out: EffectDefaults = {};
  const tokens = defaultsBlob.split(",");
  for (const token of tokens) {
    const [rawKey, rawValue] = token.split("=");
    const key = rawKey?.trim();
    const parsed = Number(rawValue);
    if (!key || !Number.isFinite(parsed)) continue;
    const value = Math.max(0, Math.min(255, Math.round(parsed)));
    if (key === "sx") out.sx = value;
    if (key === "ix") out.ix = value;
    if (key === "pal") out.pal = value;
    if (key === "c1") out.c1 = value;
    if (key === "c2") out.c2 = value;
  }
  return out;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  topology: DEFAULT_TOPOLOGY,
  simulation: DEFAULT_SIMULATION,
  command: DEFAULT_COMMAND,
  ui: {
    drawerOpen: false
  },
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
      } else if (key === "fx" && typeof value === "number") {
        const seg = next.seg as WledSegmentPayload;
        const effectId = Math.max(0, Math.min(255, Math.round(value)));
        seg.fx = effectId;
        const defaults = parseEffectDefaults(effectId);
        seg.sx = defaults.sx ?? 128;
        seg.ix = defaults.ix ?? 128;
        seg.pal = defaults.pal ?? seg.pal ?? 0;
        if (typeof defaults.c1 === "number") seg.c1 = defaults.c1;
        else delete seg.c1;
        if (typeof defaults.c2 === "number") seg.c2 = defaults.c2;
        else delete seg.c2;
      } else if ((key === "sx" || key === "ix" || key === "pal" || key === "c1" || key === "c2") && typeof value === "number") {
        const seg = next.seg as WledSegmentPayload;
        seg[key] = Math.max(0, Math.min(255, Math.round(value)));
      }

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setSegmentColor: (slot, color) =>
    set((state) => {
      const seg = (Array.isArray(state.command.seg) ? state.command.seg[0] : state.command.seg) ?? {};
      const existing = Array.isArray(seg.col)
        ? seg.col.map((entry) =>
            Array.isArray(entry) && entry.length >= 3
              ? [
                  Math.max(0, Math.min(255, Math.round(entry[0]))),
                  Math.max(0, Math.min(255, Math.round(entry[1]))),
                  Math.max(0, Math.min(255, Math.round(entry[2])))
                ]
              : [0, 0, 0]
          )
        : [[255, 170, 0], [0, 0, 0], [0, 0, 0]];
      while (existing.length < 3) {
        existing.push([0, 0, 0]);
      }
      existing[slot] = [
        Math.max(0, Math.min(255, Math.round(color[0]))),
        Math.max(0, Math.min(255, Math.round(color[1]))),
        Math.max(0, Math.min(255, Math.round(color[2])))
      ];

      const next: WledJsonEnvelope = {
        ...state.command,
        seg: {
          ...seg,
          col: existing as [[number, number, number], [number, number, number], [number, number, number]]
        }
      };

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setColorScheme: (scheme) =>
    set((state) => {
      const next: WledJsonEnvelope = {
        ...state.command,
        seg: {
          ...(Array.isArray(state.command.seg) ? state.command.seg[0] : state.command.seg),
          pal: Math.max(0, Math.min(255, Math.round(scheme.pal))),
          col: scheme.col.map(([r, g, b]) => [
            Math.max(0, Math.min(255, Math.round(r))),
            Math.max(0, Math.min(255, Math.round(g))),
            Math.max(0, Math.min(255, Math.round(b)))
          ])
        }
      };

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
    }),

  toggleDrawer: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        drawerOpen: !state.ui.drawerOpen
      }
    }))
}));
