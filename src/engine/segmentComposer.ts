import type { WledEngine } from "@/engine/softwareEngine";
import type { WledJsonEnvelope, WledSegmentPayload } from "@/types/studio";

export interface ResolvedSegment {
  index: number;
  start: number;
  stop: number;
  length: number;
  virtualLength: number;
  on: boolean;
  bri: number;
  ofs: number;
  grp: number;
  spc: number;
  rev: boolean;
  mi: boolean;
  payload: Required<Pick<WledSegmentPayload, "fx" | "sx" | "ix" | "pal" | "c1" | "c2" | "col">>;
}

export interface SegmentMap {
  localToVirtual: number[];
  virtualLength: number;
}

function clampByte(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampNonNegative(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.round(value));
}

function asSegments(command: WledJsonEnvelope): WledSegmentPayload[] {
  if (Array.isArray(command.seg) && command.seg.length > 0) {
    return command.seg;
  }
  if (command.seg && !Array.isArray(command.seg)) {
    return [command.seg];
  }
  return [{}];
}

export function normalizeSegments(command: WledJsonEnvelope, ledCount: number): ResolvedSegment[] {
  const safeCount = Math.max(1, Math.round(ledCount));
  const source = asSegments(command);
  const resolved: ResolvedSegment[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const seg = source[index] ?? {};
    const start = Math.max(0, Math.min(safeCount - 1, clampNonNegative(Number(seg.start), 0)));
    const stopRaw = clampNonNegative(Number(seg.stop), safeCount);
    const stop = Math.max(start + 1, Math.min(safeCount, stopRaw));
    const length = stop - start;
    if (length <= 0) {
      continue;
    }

    const grp = Math.max(1, clampByte(Number(seg.grp), 1));
    const spc = clampByte(Number(seg.spc), 0);
    const cycle = grp + spc;
    const virtualLength = Math.max(1, Math.ceil(length / Math.max(1, cycle)));
    const ofs = clampNonNegative(Number(seg.ofs), 0) % virtualLength;

    const payload: Required<Pick<WledSegmentPayload, "fx" | "sx" | "ix" | "pal" | "c1" | "c2" | "col">> = {
      fx: clampByte(Number(seg.fx), 8),
      sx: clampByte(Number(seg.sx), 128),
      ix: clampByte(Number(seg.ix), 128),
      pal: clampByte(Number(seg.pal), 0),
      c1: clampByte(Number(seg.c1), 0),
      c2: clampByte(Number(seg.c2), 0),
      col: Array.isArray(seg.col)
        ? [
            Array.isArray(seg.col[0]) ? seg.col[0].slice(0, 3).map((v) => clampByte(Number(v), 0)) : [255, 170, 0],
            Array.isArray(seg.col[1]) ? seg.col[1].slice(0, 3).map((v) => clampByte(Number(v), 0)) : [0, 0, 0],
            Array.isArray(seg.col[2]) ? seg.col[2].slice(0, 3).map((v) => clampByte(Number(v), 0)) : [0, 0, 0]
          ]
        : [
            [255, 170, 0],
            [0, 0, 0],
            [0, 0, 0]
          ]
    };

    resolved.push({
      index,
      start,
      stop,
      length,
      virtualLength,
      on: seg.on ?? true,
      bri: clampByte(Number(seg.bri), 125),
      ofs,
      grp,
      spc,
      rev: Boolean(seg.rev),
      mi: Boolean(seg.mi),
      payload
    });
  }

  if (resolved.length > 0) {
    return resolved;
  }

  return [
    {
      index: 0,
      start: 0,
      stop: safeCount,
      length: safeCount,
      virtualLength: safeCount,
      on: true,
      bri: 125,
      ofs: 0,
      grp: 1,
      spc: 0,
      rev: false,
      mi: false,
      payload: {
        fx: 8,
        sx: 128,
        ix: 128,
        pal: 0,
        c1: 0,
        c2: 0,
        col: [
          [255, 170, 0],
          [0, 0, 0],
          [0, 0, 0]
        ]
      }
    }
  ];
}

export function buildSegmentMap(segment: ResolvedSegment): SegmentMap {
  const localToVirtual = new Array<number>(segment.length).fill(-1);
  const cycle = segment.grp + segment.spc;
  const vlen = Math.max(1, segment.virtualLength);

  for (let local = 0; local < segment.length; local += 1) {
    const orderIndex = segment.rev ? segment.length - 1 - local : local;
    let mapped = orderIndex;
    if (segment.mi) {
      const half = Math.floor((segment.length - 1) / 2);
      mapped = orderIndex <= half ? orderIndex : segment.length - 1 - orderIndex;
    }

    const phase = mapped % cycle;
    if (phase >= segment.grp) {
      localToVirtual[local] = -1;
      continue;
    }

    const group = Math.floor(mapped / cycle);
    const virtualIndex = (group + segment.ofs) % vlen;
    localToVirtual[local] = virtualIndex;
  }

  return {
    localToVirtual,
    virtualLength: vlen
  };
}

function makeSegmentCommand(
  command: WledJsonEnvelope,
  segment: ResolvedSegment,
  globalBrightness: number
): WledJsonEnvelope {
  const payload = segment.payload;
  const effectiveBrightness = Math.max(0, Math.min(255, Math.round((globalBrightness * segment.bri) / 255)));
  return {
    on: true,
    bri: effectiveBrightness,
    seg: {
      fx: payload.fx,
      sx: payload.sx,
      ix: payload.ix,
      pal: payload.pal,
      c1: payload.c1,
      c2: payload.c2,
      col: payload.col
    }
  };
}

export function renderCompositedFrame(
  engine: WledEngine,
  command: WledJsonEnvelope,
  ledCount: number,
  simulatedMillis: number,
  cachedMaps: Map<string, SegmentMap> = new Map()
): Uint8Array {
  const safeCount = Math.max(1, Math.round(ledCount));
  const frame = new Uint8Array(safeCount * 3);
  const globalOn = command.on ?? true;
  const globalBrightness = clampByte(Number(command.bri), 255);
  if (!globalOn || globalBrightness <= 0) {
    return frame;
  }

  const segments = normalizeSegments(command, safeCount);
  for (const segment of segments) {
    const mapKey = `${segment.start}:${segment.stop}:${segment.ofs}:${segment.grp}:${segment.spc}:${segment.rev ? 1 : 0}:${segment.mi ? 1 : 0}`;
    const map = cachedMaps.get(mapKey) ?? buildSegmentMap(segment);
    cachedMaps.set(mapKey, map);

    const startOffset = segment.start * 3;
    const endOffset = segment.stop * 3;
    if (!segment.on || segment.bri <= 0) {
      frame.fill(0, startOffset, endOffset);
      continue;
    }

    engine.init(map.virtualLength);
    engine.jsonCommand(JSON.stringify(makeSegmentCommand(command, segment, globalBrightness)));
    const segmentFrame = engine.renderFrame(simulatedMillis);

    for (let local = 0; local < segment.length; local += 1) {
      const globalIndex = segment.start + local;
      const out = globalIndex * 3;
      const virtualIndex = map.localToVirtual[local];
      if (virtualIndex < 0) {
        frame[out] = 0;
        frame[out + 1] = 0;
        frame[out + 2] = 0;
        continue;
      }
      const source = virtualIndex * 3;
      frame[out] = segmentFrame[source] ?? 0;
      frame[out + 1] = segmentFrame[source + 1] ?? 0;
      frame[out + 2] = segmentFrame[source + 2] ?? 0;
    }
  }

  return frame;
}
