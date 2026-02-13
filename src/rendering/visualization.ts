import type { PaintedStrip, StripSegmentLink, VisualizationProject, WledJsonEnvelope, WledSegmentPayload } from "@/types/studio";

export interface VisualizationSyncResult {
  topologyLedCount: number;
  segments: WledSegmentPayload[];
  derivedPositions: Array<[number, number, number]>;
  derivedIndexMap: number[];
}

function segmentArray(command: WledJsonEnvelope): WledSegmentPayload[] {
  if (Array.isArray(command.seg)) return command.seg.map((seg) => ({ ...seg }));
  if (command.seg) return [{ ...command.seg }];
  return [{ start: 0, stop: 1, on: true, fx: 8, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0, col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]] }];
}

function polylineLength(points: Array<[number, number]>): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    total += Math.hypot(next[0] - prev[0], next[1] - prev[1]);
  }
  return total;
}

function interpolatePolyline(points: Array<[number, number]>, count: number): Array<[number, number, number]> {
  if (points.length < 2 || count <= 0) return [];
  const distances: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    distances.push((distances[i - 1] ?? 0) + Math.hypot(next[0] - prev[0], next[1] - prev[1]));
  }
  const total = distances[distances.length - 1] ?? 0;
  if (total <= 0) {
    return new Array(count).fill(0).map(() => [points[0]![0], points[0]![1], 0]);
  }

  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const target = t * total;
    let segIndex = 1;
    while (segIndex < distances.length && (distances[segIndex] ?? 0) < target) segIndex += 1;
    const d1 = distances[Math.max(0, segIndex - 1)] ?? 0;
    const d2 = distances[Math.min(distances.length - 1, segIndex)] ?? d1;
    const p1 = points[Math.max(0, segIndex - 1)]!;
    const p2 = points[Math.min(points.length - 1, segIndex)]!;
    const localT = d2 <= d1 ? 0 : (target - d1) / (d2 - d1);
    out.push([p1[0] + (p2[0] - p1[0]) * localT, p1[1] + (p2[1] - p1[1]) * localT, 0]);
  }
  return out;
}

export function recomputeVisualizationSync(project: VisualizationProject, command: WledJsonEnvelope): VisualizationSyncResult {
  const baseSegments = segmentArray(command);
  const strips = project.strips;
  const linksByStrip = new Map<string, StripSegmentLink>();
  for (const link of project.links) linksByStrip.set(link.stripId, link);

  const mapped: Array<{ strip: PaintedStrip; link: StripSegmentLink; ledCount: number }> = [];
  for (const strip of strips) {
    const link = linksByStrip.get(strip.id);
    if (!link || strip.points.length < 2) continue;
    const estimated = Math.max(2, Math.round(polylineLength(strip.points) / 14));
    mapped.push({ strip, link, ledCount: strip.ledCount > 0 ? strip.ledCount : estimated });
  }

  mapped.sort((a, b) => a.link.segmentIndex - b.link.segmentIndex || a.strip.createdAt - b.strip.createdAt);

  if (mapped.length === 0) {
    return {
      topologyLedCount: baseSegments.reduce((acc, seg) => Math.max(acc, seg.stop ?? 0), 1),
      segments: baseSegments,
      derivedPositions: [],
      derivedIndexMap: []
    };
  }

  const highestSegment = mapped.reduce((max, entry) => Math.max(max, entry.link.segmentIndex), 0);
  while (baseSegments.length <= highestSegment) {
    baseSegments.push({ ...(baseSegments[baseSegments.length - 1] ?? baseSegments[0] ?? {}) });
  }

  let cursor = 0;
  const derivedPositions: Array<[number, number, number]> = [];

  for (let segIndex = 0; segIndex < baseSegments.length; segIndex += 1) {
    const segmentStrips = mapped.filter((entry) => entry.link.segmentIndex === segIndex);
    if (segmentStrips.length === 0) continue;

    const start = cursor;
    for (const entry of segmentStrips) {
      const count = Math.max(1, Math.round(entry.ledCount));
      const points = interpolatePolyline(entry.strip.points, count);
      derivedPositions.push(...points);
      cursor += points.length;
    }
    const stop = Math.max(start + 1, cursor);

    const seg = baseSegments[segIndex] ?? {};
    seg.start = start;
    seg.stop = stop;
    seg.on = seg.on ?? true;
    seg.bri = seg.bri ?? 125;
    baseSegments[segIndex] = seg;
  }

  const derivedIndexMap = new Array<number>(derivedPositions.length).fill(0).map((_, i) => i);

  return {
    topologyLedCount: Math.max(1, cursor),
    segments: baseSegments,
    derivedPositions,
    derivedIndexMap
  };
}
