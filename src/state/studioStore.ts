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
    selectedSegmentIndex: number;
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
  setSegmentName: (name: string) => void;
  setSegmentNumericField: (key: "start" | "stop" | "ofs" | "startY" | "stopY" | "bri" | "grp" | "spc", value: number) => void;
  setSegmentBooleanField: (key: "on" | "rev" | "mi", value: boolean) => void;
  setSelectedSegment: (index: number) => void;
  addSegment: () => void;
  removeSelectedSegment: () => void;
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

function cloneSegment(segment: WledSegmentPayload): WledSegmentPayload {
  return {
    ...segment,
    col: Array.isArray(segment.col) ? segment.col.map((entry) => (Array.isArray(entry) ? entry.slice(0, 3) : [0, 0, 0])) : undefined
  };
}

function commandSegments(command: WledJsonEnvelope): WledSegmentPayload[] {
  if (Array.isArray(command.seg) && command.seg.length > 0) {
    return command.seg.map(cloneSegment);
  }
  if (command.seg && !Array.isArray(command.seg)) {
    return [cloneSegment(command.seg)];
  }
  return [cloneSegment(DEFAULT_COMMAND.seg as WledSegmentPayload)];
}

function normalizeCommandSegments(segments: WledSegmentPayload[]): WledJsonEnvelope["seg"] {
  if (segments.length <= 1) {
    return segments[0] ?? cloneSegment(DEFAULT_COMMAND.seg as WledSegmentPayload);
  }
  return segments;
}

function clampSegmentIndex(index: number, segmentCount: number): number {
  return Math.max(0, Math.min(segmentCount - 1, Math.round(index)));
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.round(value));
}

function selectedSegment(state: Pick<StudioState, "command" | "ui">): { segments: WledSegmentPayload[]; segment: WledSegmentPayload } {
  const segments = commandSegments(state.command);
  const segmentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
  const segment = segments[segmentIndex] ?? segments[0];
  return { segments, segment };
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
    drawerOpen: false,
    selectedSegmentIndex: 0
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
      const segments = commandSegments(state.command);
      const segmentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
      const target = segments[segmentIndex] ?? segments[0];
      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      if (key === "on" && typeof value === "boolean") {
        next.on = value;
      } else if (key === "bri" && typeof value === "number") {
        next.bri = Math.max(0, Math.min(255, Math.round(value)));
      } else if (key === "fx" && typeof value === "number") {
        const effectId = Math.max(0, Math.min(255, Math.round(value)));
        target.fx = effectId;
        const defaults = parseEffectDefaults(effectId);
        target.sx = defaults.sx ?? 128;
        target.ix = defaults.ix ?? 128;
        target.pal = defaults.pal ?? target.pal ?? 0;
        if (typeof defaults.c1 === "number") target.c1 = defaults.c1;
        else delete target.c1;
        if (typeof defaults.c2 === "number") target.c2 = defaults.c2;
        else delete target.c2;
      } else if ((key === "sx" || key === "ix" || key === "pal" || key === "c1" || key === "c2") && typeof value === "number") {
        target[key] = Math.max(0, Math.min(255, Math.round(value)));
      }
      next.seg = normalizeCommandSegments(segments);

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setSegmentColor: (slot, color) =>
    set((state) => {
      const segments = commandSegments(state.command);
      const segmentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
      const seg = segments[segmentIndex] ?? segments[0] ?? {};
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
        seg: normalizeCommandSegments(segments)
      };
      seg.col = existing as [[number, number, number], [number, number, number], [number, number, number]];
      next.seg = normalizeCommandSegments(segments);

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setSegmentName: (name) =>
    set((state) => {
      const { segments, segment } = selectedSegment(state);
      segment.n = name.slice(0, 64);

      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setSegmentNumericField: (key, value) =>
    set((state) => {
      const { segments, segment } = selectedSegment(state);

      if (key === "bri" || key === "grp" || key === "spc") {
        segment[key] = clampByte(value);
      } else {
        segment[key] = clampNonNegativeInt(value);
      }

      if (segment.start !== undefined && segment.stop !== undefined && segment.stop <= segment.start) {
        segment.stop = segment.start + 1;
      }
      if (segment.startY !== undefined && segment.stopY !== undefined && segment.stopY <= segment.startY) {
        segment.stopY = segment.startY + 1;
      }

      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setSegmentBooleanField: (key, value) =>
    set((state) => {
      const { segments, segment } = selectedSegment(state);
      segment[key] = value;

      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setColorScheme: (scheme) =>
    set((state) => {
      const segments = commandSegments(state.command);
      const segmentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
      const target = segments[segmentIndex] ?? segments[0];
      target.pal = Math.max(0, Math.min(255, Math.round(scheme.pal)));
      target.col = scheme.col.map(([r, g, b]) => [
        Math.max(0, Math.min(255, Math.round(r))),
        Math.max(0, Math.min(255, Math.round(g))),
        Math.max(0, Math.min(255, Math.round(b)))
      ]);

      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setSelectedSegment: (index) =>
    set((state) => {
      const count = commandSegments(state.command).length;
      return {
        ui: {
          ...state.ui,
          selectedSegmentIndex: clampSegmentIndex(index, count)
        }
      };
    }),

  addSegment: () =>
    set((state) => {
      const segments = commandSegments(state.command);
      const currentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
      const template = cloneSegment(segments[currentIndex] ?? segments[0]);
      const newIndex = segments.length;
      const nextSegment: WledSegmentPayload = { ...template, i: newIndex };
      segments.push(nextSegment);

      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      return {
        command: next,
        rawJson: stringifyCommand(next),
        ui: {
          ...state.ui,
          selectedSegmentIndex: newIndex
        }
      };
    }),

  removeSelectedSegment: () =>
    set((state) => {
      const segments = commandSegments(state.command);
      if (segments.length <= 1) {
        return {};
      }

      const currentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
      segments.splice(currentIndex, 1);
      const nextIndex = clampSegmentIndex(currentIndex, segments.length);
      const next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };

      return {
        command: next,
        rawJson: stringifyCommand(next),
        ui: {
          ...state.ui,
          selectedSegmentIndex: nextIndex
        }
      };
    }),

  setRawJson: (raw) => set({ rawJson: raw }),

  applyRawJson: () => {
    const current = get();
    try {
      const parsed = JSON.parse(current.rawJson);
      const sanitized = sanitizeWledEnvelope(parsed);
      const segmentCount = commandSegments(sanitized.data).length;
      set({
        command: sanitized.data,
        warnings: sanitized.warnings,
        ui: {
          ...current.ui,
          selectedSegmentIndex: clampSegmentIndex(current.ui.selectedSegmentIndex, segmentCount)
        }
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
    set((state) => {
      const segmentCount = commandSegments(command).length;
      return {
        command,
        rawJson: stringifyCommand(command),
        warnings,
        ui: {
          ...state.ui,
          selectedSegmentIndex: clampSegmentIndex(state.ui.selectedSegmentIndex, segmentCount)
        }
      };
    }),

  toggleDrawer: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        drawerOpen: !state.ui.drawerOpen
      }
    }))
}));
