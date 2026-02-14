export type TopologyMode = "strip" | "matrix";

export interface GapRange {
  start: number;
  length: number;
}

export interface StudioTopology {
  mode: TopologyMode;
  ledCount: number;
  width: number;
  height: number;
  serpentine: boolean;
  gaps: GapRange[];
  physicalIndexMap?: number[];
}

export interface SimulationConfig {
  running: boolean;
  simTickRate: number;
  renderTickRate: number;
  startMillis: number;
}

export interface WledSegmentPayload {
  i?: number;
  n?: string;
  start?: number;
  stop?: number;
  ofs?: number;
  startY?: number;
  stopY?: number;
  bri?: number;
  on?: boolean;
  rev?: boolean;
  mi?: boolean;
  grp?: number;
  spc?: number;
  fx?: number;
  sx?: number;
  ix?: number;
  pal?: number;
  c1?: number;
  c2?: number;
  col?: number[][];
}

export interface WledPlaylistPayload {
  ps: number[];
  dur: number[] | number;
  transition: number[] | number;
  repeat: number;
  end?: number;
  r?: boolean;
}

export interface WledJsonEnvelope {
  on?: boolean;
  bri?: number;
  seg?: WledSegmentPayload | WledSegmentPayload[];
  playlist?: WledPlaylistPayload;
  np?: boolean;
}

export interface WledPresetEntry extends WledJsonEnvelope {
  n?: string;
  ql?: string;
}

export interface PlaylistRuntimeState {
  sourcePresetId: number | null;
  sourceOrder: number[];
  activeOrder: number[];
  dur: number[];
  transition: number[];
  repeat: number;
  end: number;
  r: boolean;
  index: number;
  lastAdvanceMillis: number;
  remainingRepetitions: number;
  pendingImmediate: boolean;
  advanceRequested: boolean;
}

export interface StudioPresetLibrary {
  entries: Record<string, WledPresetEntry>;
  currentPresetId: number | null;
  activePlaylist: PlaylistRuntimeState | null;
}

export interface BackgroundAsset {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PaintedStrip {
  id: string;
  // Normalized scene coordinates in [0..1].
  points: Array<[number, number]>;
  ledCount: number;
  createdAt: number;
}

export interface StripSegmentAllocation {
  segmentIndex: number;
  share: number;
}

export interface StripSegmentMap {
  stripId: string;
  allocations: StripSegmentAllocation[];
}

export interface VisualizationImageFit {
  scaleX: number;
  scaleY: number;
  lockAspectRatio: boolean;
}

export interface VisualizationViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface VisualizationProject {
  schemaVersion: 2;
  enabled: boolean;
  ledOpacity: number;
  userLedOpacityOverride: boolean;
  background: BackgroundAsset | null;
  backgroundVisible: boolean;
  viewport: VisualizationViewport;
  imageFit: VisualizationImageFit;
  strips: PaintedStrip[];
  links: StripSegmentMap[];
  derivedIndexMap: number[];
  derivedPositions: Array<[number, number, number]>;
  draftPoints: Array<[number, number]>;
  drawing: boolean;
}

export interface ImportResult<T = unknown> {
  data: T;
  warnings: string[];
}
