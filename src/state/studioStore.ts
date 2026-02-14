import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { ColorSchemeOption } from "@/config/simulationOptions";
import { WLED_EFFECT_CATALOG } from "@/config/wledEffectCatalog";
import { sanitizeTopology, sanitizeWledEnvelope } from "@/io/sanitize";
import { recomputeVisualizationSync } from "@/rendering/visualization";
import { clampScenePoint, clampViewport, identityViewport } from "@/rendering/visualizerViewport";
import { normalizePlaylistPayload, shufflePlaylistOrder, type NormalizedPlaylist } from "@/state/playlist";
import type {
  BackgroundAsset,
  PaintedStrip,
  PlaylistRuntimeState,
  SimulationConfig,
  StripSegmentAllocation,
  StripSegmentMap,
  StudioPresetLibrary,
  StudioTopology,
  VisualizationProject,
  WledJsonEnvelope,
  WledPlaylistPayload,
  WledPresetEntry,
  WledSegmentPayload
} from "@/types/studio";

export interface StudioState {
  topology: StudioTopology;
  simulation: SimulationConfig;
  command: WledJsonEnvelope;
  presets: StudioPresetLibrary;
  visualization: VisualizationProject;
  ui: {
    drawerOpen: boolean;
    selectedSegmentIndex: number;
    ledViewHeightPx: number;
    ledViewSizePreset: "s" | "m" | "l" | "custom";
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
  setControlAt: (index: number, key: "on" | "bri" | "fx" | "sx" | "ix" | "pal" | "c1" | "c2", value: number | boolean) => void;
  setColorScheme: (scheme: Pick<ColorSchemeOption, "pal" | "col">) => void;
  setSegmentColor: (slot: 0 | 1 | 2, color: [number, number, number]) => void;
  setSegmentName: (name: string) => void;
  setSegmentNumericField: (key: "start" | "stop" | "ofs" | "startY" | "stopY" | "bri" | "grp" | "spc", value: number) => void;
  setSegmentBooleanField: (key: "on" | "rev" | "mi", value: boolean) => void;
  setSelectedSegment: (index: number) => void;
  addSegment: () => void;
  removeSelectedSegment: () => void;
  removeSegmentAt: (index: number) => void;
  setRawJson: (raw: string) => void;
  applyRawJson: () => string | null;
  setRunning: (running: boolean) => void;
  resetClock: () => void;
  resetState: () => void;
  setFrame: (frame: Uint8Array, simulatedMillis: number, error: string) => void;
  replaceTopology: (topology: StudioTopology) => void;
  replaceCommand: (command: WledJsonEnvelope, warnings?: string[]) => void;
  toggleDrawer: () => void;

  savePreset: (id?: number, name?: string) => number | null;
  deletePreset: (id: number) => void;
  applyPreset: (id: number) => void;
  setPresetQuickLabel: (id: number, quickLabel: string) => void;
  setPlaylistForPreset: (id: number, payload: WledPlaylistPayload) => void;
  clearPlaylistForPreset: (id: number) => void;
  startPlaylist: (payload: WledPlaylistPayload, sourcePresetId?: number | null) => void;
  stopPlaylist: () => void;
  advancePlaylist: () => void;
  tickPlaylist: (simulatedMillis: number) => void;
  replacePresetLibrary: (entries: Record<string, WledPresetEntry>, warnings?: string[]) => void;

  setVisualizationEnabled: (enabled: boolean) => void;
  setVisualizationLedOpacity: (opacity: number) => void;
  setVisualizationBackground: (background: BackgroundAsset | null) => void;
  setVisualizationViewport: (zoom: number, panX: number, panY: number) => void;
  resetVisualizationViewport: () => void;
  setVisualizationImageScale: (scaleX: number, scaleY: number, lockAspectRatio?: boolean) => void;
  setVisualizationAspectLock: (locked: boolean) => void;
  startVisualizationStrip: () => void;
  addVisualizationPoint: (x: number, y: number) => void;
  finishVisualizationStrip: () => void;
  cancelVisualizationStrip: () => void;
  removeVisualizationStrip: (stripId: string) => void;
  setStripSegmentAllocations: (stripId: string, allocations: StripSegmentAllocation[]) => void;
  updateVisualizationStripLedCount: (stripId: string, ledCount: number) => void;
  setLedViewHeight: (heightPx: number) => void;
  setLedViewSizePreset: (preset: "s" | "m" | "l") => void;
  importVisualizationProject: (project: Partial<VisualizationProject>) => void;
  exportVisualizationProject: () => string;
}

const DEFAULT_TOPOLOGY: StudioTopology = {
  mode: "strip",
  ledCount: 150,
  width: 150,
  height: 1,
  serpentine: false,
  gaps: []
};

const DEFAULT_COMMAND: WledJsonEnvelope = {
  on: true,
  bri: 180,
  seg: {
    start: 0,
    stop: DEFAULT_TOPOLOGY.ledCount,
    on: true,
    bri: 125,
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

const DEFAULT_VISUALIZATION: VisualizationProject = {
  schemaVersion: 2,
  enabled: false,
  ledOpacity: 0.8,
  userLedOpacityOverride: false,
  background: null,
  viewport: identityViewport(),
  imageFit: {
    scaleX: 1,
    scaleY: 1,
    lockAspectRatio: true
  },
  strips: [],
  links: [],
  derivedIndexMap: [],
  derivedPositions: [],
  draftPoints: [],
  drawing: false
};

export const STUDIO_STATE_STORAGE_KEY = "wled-studio:state:v1";
const STUDIO_STATE_STORAGE_VERSION = 1;

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => {
      store.set(name, value);
    },
    removeItem: (name: string) => {
      store.delete(name);
    }
  } satisfies StateStorage;
})();

const studioStateStorage = createJSONStorage(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
});

function stringifyCommand(command: WledJsonEnvelope): string {
  return JSON.stringify(command, null, 2);
}

function cloneSegment(segment: WledSegmentPayload): WledSegmentPayload {
  return {
    ...segment,
    col: Array.isArray(segment.col) ? segment.col.map((entry) => (Array.isArray(entry) ? entry.slice(0, 3) : [0, 0, 0])) : undefined
  };
}

function cloneCommand(command: WledJsonEnvelope): WledJsonEnvelope {
  return {
    ...command,
    seg: Array.isArray(command.seg)
      ? command.seg.map(cloneSegment)
      : command.seg
        ? cloneSegment(command.seg)
        : undefined
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

function ensureSingleSegmentCoversStrip(command: WledJsonEnvelope, ledCount: number): WledJsonEnvelope {
  const segments = commandSegments(command);
  if (segments.length !== 1) {
    return command;
  }
  const segment = segments[0]!;
  segment.start = 0;
  segment.stop = Math.max(1, Math.round(ledCount));
  segment.on = segment.on ?? true;
  segment.bri = segment.bri ?? 125;
  return {
    ...command,
    seg: normalizeCommandSegments(segments)
  };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.round(value));
}

const LED_VIEW_HEIGHT_MIN = 220;
const LED_VIEW_HEIGHT_MAX = 720;
const LED_VIEW_PRESET_HEIGHTS = {
  s: 260,
  m: 380,
  l: 520
} as const;

function clampLedViewHeight(value: number): number {
  return Math.max(LED_VIEW_HEIGHT_MIN, Math.min(LED_VIEW_HEIGHT_MAX, Math.round(value)));
}

function selectedSegment(state: Pick<StudioState, "command" | "ui">): { segments: WledSegmentPayload[]; segment: WledSegmentPayload } {
  const segments = commandSegments(state.command);
  const segmentIndex = clampSegmentIndex(state.ui.selectedSegmentIndex, segments.length);
  const segment = segments[segmentIndex] ?? segments[0]!;
  return { segments, segment };
}

function applyControlToSegment(
  baseCommand: WledJsonEnvelope,
  targetIndex: number,
  key: "on" | "bri" | "fx" | "sx" | "ix" | "pal" | "c1" | "c2",
  value: number | boolean
): WledJsonEnvelope {
  const segments = commandSegments(baseCommand);
  const segmentIndex = clampSegmentIndex(targetIndex, segments.length);
  const target = segments[segmentIndex] ?? segments[0]!;

  const next: WledJsonEnvelope = {
    ...baseCommand,
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
  return next;
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

function nextPresetId(entries: Record<string, WledPresetEntry>): number | null {
  for (let id = 1; id <= 250; id += 1) {
    if (!(String(id) in entries)) return id;
  }
  return null;
}

function commandFromPreset(entry: WledPresetEntry): WledJsonEnvelope {
  const { n: _name, ql: _ql, playlist: _playlist, ...state } = entry;
  const sanitized = sanitizeWledEnvelope(state);
  return sanitized.data;
}

function clonePresetEntry(entry: WledPresetEntry): WledPresetEntry {
  return {
    ...cloneCommand(entry),
    n: entry.n,
    ql: entry.ql,
    playlist: entry.playlist
      ? {
          ...entry.playlist,
          ps: entry.playlist.ps.slice(),
          dur: Array.isArray(entry.playlist.dur) ? entry.playlist.dur.slice() : entry.playlist.dur,
          transition: Array.isArray(entry.playlist.transition) ? entry.playlist.transition.slice() : entry.playlist.transition
        }
      : undefined
  };
}

function normalizePlaylistForRuntime(payload: WledPlaylistPayload): { playlist: NormalizedPlaylist | null; warnings: string[] } {
  const normalized = normalizePlaylistPayload(payload);
  return {
    playlist: normalized.playlist,
    warnings: normalized.warnings
  };
}

function buildPlaylistRuntime(playlist: NormalizedPlaylist, sourcePresetId: number | null, simulatedMillis: number): PlaylistRuntimeState {
  const sourceOrder = playlist.ps.slice();
  return {
    sourcePresetId,
    sourceOrder,
    activeOrder: sourceOrder.slice(),
    dur: playlist.dur.slice(),
    transition: playlist.transition.slice(),
    repeat: playlist.repeat,
    end: playlist.end,
    r: playlist.r,
    index: -1,
    lastAdvanceMillis: simulatedMillis,
    remainingRepetitions: playlist.repeat > 0 ? playlist.repeat + 1 : 0,
    pendingImmediate: true,
    advanceRequested: false
  };
}

function createStripId(): string {
  return `strip_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function applyVisualizationSync(state: StudioState, visualization: VisualizationProject): Pick<StudioState, "topology" | "command" | "rawJson" | "visualization"> {
  const sync = recomputeVisualizationSync(visualization, state.command);

  const nextTopology = {
    ...state.topology,
    mode: "strip" as const,
    ledCount: sync.topologyLedCount,
    width: sync.topologyLedCount,
    height: 1,
    gaps: []
  };

  const nextCommand: WledJsonEnvelope = {
    ...state.command,
    seg: normalizeCommandSegments(sync.segments)
  };

  return {
    topology: nextTopology,
    command: nextCommand,
    rawJson: stringifyCommand(nextCommand),
    visualization: {
      ...visualization,
      derivedIndexMap: sync.derivedIndexMap,
      derivedPositions: sync.derivedPositions
    }
  };
}

type StudioStateCore = Pick<
  StudioState,
  | "topology"
  | "simulation"
  | "command"
  | "presets"
  | "visualization"
  | "ui"
  | "rawJson"
  | "warnings"
  | "lastError"
  | "frame"
  | "simulatedMillis"
>;

type PersistedStudioState = Pick<
  StudioStateCore,
  "topology" | "simulation" | "command" | "presets" | "visualization" | "ui" | "rawJson"
>;

function createInitialCoreState(): StudioStateCore {
  const topology: StudioTopology = { ...DEFAULT_TOPOLOGY, gaps: DEFAULT_TOPOLOGY.gaps.slice() };
  const command = cloneCommand(DEFAULT_COMMAND);
  return {
    topology,
    simulation: { ...DEFAULT_SIMULATION },
    command,
    presets: {
      entries: {
        "1": {
          n: "Studio Export",
          on: command.on,
          bri: command.bri,
          seg: cloneCommand(command).seg
        }
      },
      currentPresetId: null,
      activePlaylist: null
    },
    visualization: {
      ...DEFAULT_VISUALIZATION,
      viewport: identityViewport(),
      imageFit: {
        ...DEFAULT_VISUALIZATION.imageFit
      },
      strips: [],
      links: [],
      derivedIndexMap: [],
      derivedPositions: [],
      draftPoints: []
    },
    ui: {
      drawerOpen: false,
      selectedSegmentIndex: 0,
      ledViewHeightPx: LED_VIEW_PRESET_HEIGHTS.m,
      ledViewSizePreset: "m"
    },
    rawJson: stringifyCommand(command),
    warnings: [],
    lastError: "",
    frame: new Uint8Array(topology.ledCount * 3),
    simulatedMillis: 0
  };
}

function partializeStudioState(state: StudioState): PersistedStudioState {
  // Keep timeline/render diagnostics transient so a reopened session starts clean.
  return {
    topology: state.topology,
    simulation: state.simulation,
    command: state.command,
    presets: state.presets,
    visualization: state.visualization,
    ui: state.ui,
    rawJson: state.rawJson
  };
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      ...createInitialCoreState(),

  setMode: (mode) =>
    set((state) => {
      const next = normalizeDimensions(mode, state.topology.width, state.topology.height, state.topology.ledCount);
      const topology = {
        ...state.topology,
        mode,
        ...next
      };
      const command = ensureSingleSegmentCoversStrip(state.command, topology.ledCount);
      return {
        topology,
        command,
        rawJson: stringifyCommand(command)
      };
    }),

  setDimensions: (width, height) =>
    set((state) => {
      const next = normalizeDimensions(state.topology.mode, width, height, state.topology.ledCount);
      const topology = {
        ...state.topology,
        ...next
      };
      const command = ensureSingleSegmentCoversStrip(state.command, topology.ledCount);
      return {
        topology,
        command,
        rawJson: stringifyCommand(command)
      };
    }),

  setLedCount: (count) =>
    set((state) => {
      const safe = Math.max(1, Math.round(count));
      if (state.topology.mode === "matrix") {
        return {};
      }
      const topology = {
        ...state.topology,
        ledCount: safe,
        width: safe,
        height: 1
      };
      const command = ensureSingleSegmentCoversStrip(state.command, topology.ledCount);
      return {
        topology,
        command,
        rawJson: stringifyCommand(command)
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
      const next = applyControlToSegment(state.command, state.ui.selectedSegmentIndex, key, value);

      return {
        command: next,
        rawJson: stringifyCommand(next)
      };
    }),

  setControlAt: (index, key, value) =>
    set((state) => {
      const next = applyControlToSegment(state.command, index, key, value);
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
      } else if (key === "stop") {
        segment.stop = clampNonNegativeInt(value) + 1;
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
      const target = segments[segmentIndex] ?? segments[0]!;
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
      const template = cloneSegment(segments[currentIndex] ?? segments[0]!);
      const newIndex = segments.length;
      const nextSegment: WledSegmentPayload = {
        ...template,
        i: newIndex,
        on: template.on ?? true,
        bri: template.bri ?? 125
      };
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
      let next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };
      next = ensureSingleSegmentCoversStrip(next, state.topology.ledCount);

      return {
        command: next,
        rawJson: stringifyCommand(next),
        ui: {
          ...state.ui,
          selectedSegmentIndex: nextIndex
        }
      };
    }),

  removeSegmentAt: (index) =>
    set((state) => {
      const segments = commandSegments(state.command);
      if (segments.length <= 1) {
        return {};
      }

      const removeIndex = clampSegmentIndex(index, segments.length);
      segments.splice(removeIndex, 1);
      const nextIndex = clampSegmentIndex(removeIndex, segments.length);
      let next: WledJsonEnvelope = {
        ...state.command,
        seg: normalizeCommandSegments(segments)
      };
      next = ensureSingleSegmentCoversStrip(next, state.topology.ledCount);

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

  resetState: () => {
    set(createInitialCoreState());
    useStudioStore.persist.clearStorage();
  },

  setFrame: (frame, simulatedMillis, error) =>
    set({
      frame,
      simulatedMillis,
      lastError: error
    }),

  replaceTopology: (topology) =>
    set((state) => {
      const command = ensureSingleSegmentCoversStrip(state.command, topology.ledCount);
      return {
        topology,
        command,
        rawJson: stringifyCommand(command)
      };
    }),

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
    })),

  savePreset: (id, name) => {
    const state = get();
    const nextId = id ?? nextPresetId(state.presets.entries);
    if (!nextId || nextId < 1 || nextId > 250) return null;

    const entry: WledPresetEntry = {
      ...cloneCommand(state.command),
      n: (name ?? state.presets.entries[String(nextId)]?.n ?? `Preset ${nextId}`).slice(0, 32),
      ql: state.presets.entries[String(nextId)]?.ql
    };

    set({
      presets: {
        ...state.presets,
        entries: {
          ...state.presets.entries,
          [String(nextId)]: entry
        },
        currentPresetId: nextId
      }
    });

    return nextId;
  },

  deletePreset: (id) =>
    set((state) => {
      const next = { ...state.presets.entries };
      delete next[String(id)];
      return {
        presets: {
          ...state.presets,
          entries: next,
          currentPresetId: state.presets.currentPresetId === id ? null : state.presets.currentPresetId
        }
      };
    }),

  applyPreset: (id) =>
    set((state) => {
      const entry = state.presets.entries[String(id)];
      if (!entry) return {};

      const command = commandFromPreset(entry);
      const updates: Partial<StudioState> = {
        command,
        rawJson: stringifyCommand(command),
        presets: {
          ...state.presets,
          currentPresetId: id
        }
      };

      if (entry.playlist) {
        const normalized = normalizePlaylistForRuntime(entry.playlist);
        if (normalized.playlist) {
          updates.presets = {
            ...state.presets,
            currentPresetId: id,
            activePlaylist: buildPlaylistRuntime(normalized.playlist, id, state.simulatedMillis)
          };
          updates.warnings = normalized.warnings;
        }
      } else {
        updates.presets = {
          ...state.presets,
          currentPresetId: id,
          activePlaylist: null
        };
      }

      return updates;
    }),

  setPresetQuickLabel: (id, quickLabel) =>
    set((state) => {
      const entry = state.presets.entries[String(id)];
      if (!entry) return {};
      return {
        presets: {
          ...state.presets,
          entries: {
            ...state.presets.entries,
            [String(id)]: {
              ...entry,
              ql: quickLabel.slice(0, 8)
            }
          }
        }
      };
    }),

  setPlaylistForPreset: (id, payload) =>
    set((state) => {
      const entry = state.presets.entries[String(id)];
      if (!entry) return {};
      const normalized = normalizePlaylistForRuntime(payload);
      if (!normalized.playlist) {
        return {
          warnings: normalized.warnings.concat(state.warnings)
        };
      }
      return {
        presets: {
          ...state.presets,
          entries: {
            ...state.presets.entries,
            [String(id)]: {
              ...entry,
              playlist: normalized.playlist
            }
          }
        },
        warnings: normalized.warnings
      };
    }),

  clearPlaylistForPreset: (id) =>
    set((state) => {
      const entry = state.presets.entries[String(id)];
      if (!entry) return {};
      const next = { ...entry };
      delete next.playlist;
      return {
        presets: {
          ...state.presets,
          entries: {
            ...state.presets.entries,
            [String(id)]: next
          }
        }
      };
    }),

  startPlaylist: (payload, sourcePresetId = null) =>
    set((state) => {
      const normalized = normalizePlaylistForRuntime(payload);
      if (!normalized.playlist) {
        return {
          warnings: normalized.warnings.concat(state.warnings)
        };
      }

      return {
        presets: {
          ...state.presets,
          activePlaylist: buildPlaylistRuntime(normalized.playlist, sourcePresetId, state.simulatedMillis)
        },
        warnings: normalized.warnings
      };
    }),

  stopPlaylist: () =>
    set((state) => ({
      presets: {
        ...state.presets,
        activePlaylist: null
      }
    })),

  advancePlaylist: () =>
    set((state) => {
      if (!state.presets.activePlaylist) return {};
      return {
        presets: {
          ...state.presets,
          activePlaylist: {
            ...state.presets.activePlaylist,
            advanceRequested: true
          }
        }
      };
    }),

  tickPlaylist: (simulatedMillis) =>
    set((state) => {
      const runtime = state.presets.activePlaylist;
      if (!runtime) return {};

      const shouldAdvance = (() => {
        if (runtime.pendingImmediate) return true;
        if (runtime.advanceRequested) return true;
        const durationTenths = runtime.dur[runtime.index] ?? 0;
        if (durationTenths <= 0) return false;
        return simulatedMillis - runtime.lastAdvanceMillis >= durationTenths * 100;
      })();

      if (!shouldAdvance) return {};

      let workingOrder = runtime.activeOrder;
      let nextIndex = (runtime.index + 1) % Math.max(1, workingOrder.length);
      let remainingRepetitions = runtime.remainingRepetitions;

      if (nextIndex === 0) {
        if (remainingRepetitions === 1) {
          const updates: Partial<StudioState> = {
            presets: {
              ...state.presets,
              activePlaylist: null
            }
          };

          let endPreset = runtime.end;
          if (endPreset === 255) endPreset = runtime.sourcePresetId ?? 0;
          if (endPreset > 0 && endPreset <= 250) {
            const entry = state.presets.entries[String(endPreset)];
            if (entry) {
              updates.command = commandFromPreset(entry);
              updates.rawJson = stringifyCommand(updates.command);
              updates.presets = {
                ...state.presets,
                currentPresetId: endPreset,
                activePlaylist: null
              };
            }
          }

          return updates;
        }

        if (remainingRepetitions > 1) remainingRepetitions -= 1;
        if (runtime.r) {
          workingOrder = shufflePlaylistOrder(runtime.sourceOrder);
          nextIndex = 0;
        }
      }

      const presetId = workingOrder[nextIndex] ?? 0;
      const entry = state.presets.entries[String(presetId)];
      const command = entry ? commandFromPreset(entry) : state.command;

      return {
        command,
        rawJson: stringifyCommand(command),
        presets: {
          ...state.presets,
          currentPresetId: entry ? presetId : state.presets.currentPresetId,
          activePlaylist: {
            ...runtime,
            activeOrder: workingOrder,
            index: nextIndex,
            remainingRepetitions,
            pendingImmediate: false,
            advanceRequested: false,
            lastAdvanceMillis: simulatedMillis
          }
        }
      };
    }),

  replacePresetLibrary: (entries, warnings = []) =>
    set((state) => {
      const normalized: Record<string, WledPresetEntry> = {};
      for (const [id, entry] of Object.entries(entries)) {
        const idNum = Number(id);
        if (!Number.isInteger(idNum) || idNum < 0 || idNum > 250) continue;
        normalized[String(idNum)] = clonePresetEntry(entry);
      }
      return {
        presets: {
          ...state.presets,
          entries: normalized,
          currentPresetId: state.presets.currentPresetId && normalized[String(state.presets.currentPresetId)] ? state.presets.currentPresetId : null,
          activePlaylist: null
        },
        warnings
      };
    }),

  setVisualizationEnabled: (enabled) =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        enabled
      }
    })),

  setVisualizationLedOpacity: (opacity) =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        ledOpacity: Math.max(0, Math.min(1, Number(opacity) || 0.8)),
        userLedOpacityOverride: true
      }
    })),

  setVisualizationBackground: (background) =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        ledOpacity: background && !state.visualization.userLedOpacityOverride ? 1 : state.visualization.ledOpacity,
        background,
        viewport: identityViewport(),
        imageFit: {
          scaleX: 1,
          scaleY: 1,
          lockAspectRatio: true
        }
      }
    })),

  setVisualizationViewport: (zoom, panX, panY) =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        viewport: clampViewport({ zoom, panX, panY })
      }
    })),

  resetVisualizationViewport: () =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        viewport: identityViewport()
      }
    })),

  setVisualizationImageScale: (scaleX, scaleY, lockAspectRatio) =>
    set((state) => {
      const prev = state.visualization.imageFit;
      const nextLock = typeof lockAspectRatio === "boolean" ? lockAspectRatio : prev.lockAspectRatio;
      const safeX = Math.max(0.1, Math.min(8, Number(scaleX) || 1));
      const safeYInput = Math.max(0.1, Math.min(8, Number(scaleY) || 1));
      const safeY = nextLock ? safeX : safeYInput;
      return {
        visualization: {
          ...state.visualization,
          imageFit: {
            scaleX: safeX,
            scaleY: safeY,
            lockAspectRatio: nextLock
          }
        }
      };
    }),

  setVisualizationAspectLock: (locked) =>
    set((state) => {
      const nextLock = Boolean(locked);
      const fit = state.visualization.imageFit;
      return {
        visualization: {
          ...state.visualization,
          imageFit: {
            ...fit,
            lockAspectRatio: nextLock,
            scaleY: nextLock ? fit.scaleX : fit.scaleY
          }
        }
      };
    }),

  startVisualizationStrip: () =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        drawing: true,
        draftPoints: []
      }
    })),

  addVisualizationPoint: (x, y) =>
    set((state) => {
      if (!state.visualization.drawing) return {};
      const [safeX, safeY] = clampScenePoint(Number(x) || 0, Number(y) || 0);
      return {
        visualization: {
          ...state.visualization,
          draftPoints: [...state.visualization.draftPoints, [safeX, safeY]]
        }
      };
    }),

  finishVisualizationStrip: () =>
    set((state) => {
      if (!state.visualization.drawing || state.visualization.draftPoints.length < 2) return {};
      const strip: PaintedStrip = {
        id: createStripId(),
        points: state.visualization.draftPoints.slice(),
        ledCount: 0,
        createdAt: Date.now()
      };
      const links: StripSegmentMap[] = [
        ...state.visualization.links,
        {
          stripId: strip.id,
          allocations: [
            {
              segmentIndex: clampSegmentIndex(state.ui.selectedSegmentIndex, commandSegments(state.command).length),
              share: 1
            }
          ]
        }
      ];
      const visualization: VisualizationProject = {
        ...state.visualization,
        strips: [...state.visualization.strips, strip],
        links,
        drawing: false,
        draftPoints: []
      };

      return applyVisualizationSync(state, visualization);
    }),

  cancelVisualizationStrip: () =>
    set((state) => ({
      visualization: {
        ...state.visualization,
        drawing: false,
        draftPoints: []
      }
    })),

  removeVisualizationStrip: (stripId) =>
    set((state) => {
      const visualization: VisualizationProject = {
        ...state.visualization,
        strips: state.visualization.strips.filter((strip) => strip.id !== stripId),
        links: state.visualization.links.filter((link) => link.stripId !== stripId)
      };
      return applyVisualizationSync(state, visualization);
    }),

  setStripSegmentAllocations: (stripId, allocations) =>
    set((state) => {
      const nextLinks = state.visualization.links.slice();
      const index = nextLinks.findIndex((link) => link.stripId === stripId);
      const safeAllocations = allocations
        .filter((entry) => Number.isFinite(entry.segmentIndex) && Number.isFinite(entry.share) && entry.share > 0)
        .map((entry) => ({ segmentIndex: Math.max(0, Math.round(entry.segmentIndex)), share: Number(entry.share) }));
      const nextValue = {
        stripId,
        allocations: safeAllocations
      };
      if (index >= 0) nextLinks[index] = nextValue;
      else nextLinks.push(nextValue);
      const visualization: VisualizationProject = {
        ...state.visualization,
        links: nextLinks
      };
      return applyVisualizationSync(state, visualization);
    }),

  updateVisualizationStripLedCount: (stripId, ledCount) =>
    set((state) => {
      const visualization: VisualizationProject = {
        ...state.visualization,
        strips: state.visualization.strips.map((strip) => (strip.id === stripId ? { ...strip, ledCount: Math.max(1, Math.round(ledCount)) } : strip))
      };
      return applyVisualizationSync(state, visualization);
    }),

  setLedViewHeight: (heightPx) =>
    set((state) => ({
      ui: {
        ...state.ui,
        ledViewHeightPx: clampLedViewHeight(heightPx),
        ledViewSizePreset: "custom"
      }
    })),

  setLedViewSizePreset: (preset) =>
    set((state) => ({
      ui: {
        ...state.ui,
        ledViewSizePreset: preset,
        ledViewHeightPx: LED_VIEW_PRESET_HEIGHTS[preset]
      }
    })),

  importVisualizationProject: (project) =>
    set((state) => {
      if (project.schemaVersion !== 2) {
        return {
          warnings: ["Visualizer import failed: only schemaVersion=2 projects are supported."]
        };
      }

      const importedStrips = Array.isArray(project.strips)
        ? project.strips
            .filter((strip): strip is PaintedStrip => Boolean(strip && Array.isArray(strip.points) && strip.points.length >= 2 && typeof strip.id === "string"))
            .map((strip) => ({
              ...strip,
              points: strip.points
                .map(([x, y]) => [Number(x), Number(y)] as [number, number])
                .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1),
              ledCount: Math.max(0, Math.round(strip.ledCount || 0)),
              createdAt: Number.isFinite(strip.createdAt) ? strip.createdAt : Date.now()
            }))
            .filter((strip) => strip.points.length >= 2)
        : [];

      const importedLinks = Array.isArray(project.links)
        ? project.links
            .filter((link): link is StripSegmentMap => Boolean(link && typeof link.stripId === "string" && Array.isArray(link.allocations)))
            .map((link) => ({
              stripId: link.stripId,
              allocations: link.allocations
                .filter((entry) => Number.isFinite(entry.segmentIndex) && Number.isFinite(entry.share) && entry.share > 0)
                .map((entry) => ({ segmentIndex: Math.max(0, Math.round(entry.segmentIndex)), share: Number(entry.share) }))
            }))
            .filter((link) => link.allocations.length > 0)
        : [];

      const importedStripIds = new Set(importedStrips.map((strip) => strip.id));
      const links = importedLinks.filter((link) => importedStripIds.has(link.stripId));
      const viewport = clampViewport({
        zoom: Number(project.viewport?.zoom ?? 1),
        panX: Number(project.viewport?.panX ?? 0),
        panY: Number(project.viewport?.panY ?? 0)
      });
      const imageFit = {
        scaleX: Math.max(0.1, Math.min(8, Number(project.imageFit?.scaleX ?? 1))),
        scaleY: Math.max(0.1, Math.min(8, Number(project.imageFit?.scaleY ?? 1))),
        lockAspectRatio: project.imageFit?.lockAspectRatio !== false
      };

      const visualization: VisualizationProject = {
        ...state.visualization,
        schemaVersion: 2,
        enabled: Boolean(project.enabled),
        ledOpacity: Math.max(0, Math.min(1, Number(project.ledOpacity ?? state.visualization.ledOpacity))),
        userLedOpacityOverride:
          typeof project.userLedOpacityOverride === "boolean" ? project.userLedOpacityOverride : typeof project.ledOpacity === "number",
        background: project.background ?? null,
        viewport,
        imageFit: imageFit.lockAspectRatio ? { ...imageFit, scaleY: imageFit.scaleX } : imageFit,
        strips: importedStrips,
        links,
        draftPoints: [],
        drawing: false
      };

      return applyVisualizationSync(state, visualization);
    }),

      exportVisualizationProject: () => {
        const state = get();
        const payload = {
          schemaVersion: 2 as const,
          enabled: state.visualization.enabled,
          ledOpacity: state.visualization.ledOpacity,
          userLedOpacityOverride: state.visualization.userLedOpacityOverride,
          background: state.visualization.background,
          viewport: state.visualization.viewport,
          imageFit: state.visualization.imageFit,
          strips: state.visualization.strips,
          links: state.visualization.links,
          derivedIndexMap: state.visualization.derivedIndexMap
        };
        return JSON.stringify(payload, null, 2);
      }
    }),
    {
      name: STUDIO_STATE_STORAGE_KEY,
      version: STUDIO_STATE_STORAGE_VERSION,
      storage: studioStateStorage,
      partialize: partializeStudioState,
      migrate: (persistedState, version) => {
        if (version !== STUDIO_STATE_STORAGE_VERSION) {
          return {
            ...createInitialCoreState(),
            ...(persistedState as PersistedStudioState)
          } as StudioState;
        }
        return {
          ...createInitialCoreState(),
          ...(persistedState as PersistedStudioState)
        } as StudioState;
      }
    }
  )
);
