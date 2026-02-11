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
  fx?: number;
  sx?: number;
  ix?: number;
  pal?: number;
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
