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

export interface WledJsonEnvelope {
  on?: boolean;
  bri?: number;
  seg?: WledSegmentPayload | WledSegmentPayload[];
}

export interface ImportResult<T = unknown> {
  data: T;
  warnings: string[];
}
