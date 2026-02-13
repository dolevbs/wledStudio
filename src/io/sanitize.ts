import type { ImportResult, StudioTopology, WledJsonEnvelope, WledPlaylistPayload, WledSegmentPayload } from "@/types/studio";
import { normalizePlaylistPayload } from "@/state/playlist";

function clampByte(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(255, Math.max(0, Math.round(n)));
}

function clampNonNegativeInt(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.max(0, Math.round(n));
}

function clampText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.slice(0, maxLength);
}

function asObject(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function sanitizeSegment(input: unknown, warnings: string[]): WledSegmentPayload {
  const src = asObject(input) ?? {};

  const fx = clampByte(src.fx, 0);
  const sx = clampByte(src.sx, 128);
  const ix = clampByte(src.ix, 128);
  const pal = clampByte(src.pal, 0);
  const c1 = clampByte(src.c1, 0);
  const c2 = clampByte(src.c2, 0);
  const i = clampNonNegativeInt(src.i);
  const n = clampText(src.n, 64);
  const start = clampNonNegativeInt(src.start);
  let stop = clampNonNegativeInt(src.stop);
  const ofs = clampNonNegativeInt(src.ofs);
  const startY = clampNonNegativeInt(src.startY);
  let stopY = clampNonNegativeInt(src.stopY);
  const bri = src.bri === undefined ? undefined : clampByte(src.bri, 255);
  const grp = src.grp === undefined ? undefined : clampByte(src.grp, 1);
  const spc = src.spc === undefined ? undefined : clampByte(src.spc, 0);
  const on = typeof src.on === "boolean" ? src.on : undefined;
  const rev = typeof src.rev === "boolean" ? src.rev : undefined;
  const mi = typeof src.mi === "boolean" ? src.mi : undefined;

  if (on === undefined && src.on !== undefined) {
    warnings.push("Ignored invalid seg.on payload; expected boolean");
  }
  if (rev === undefined && src.rev !== undefined) {
    warnings.push("Ignored invalid seg.rev payload; expected boolean");
  }
  if (mi === undefined && src.mi !== undefined) {
    warnings.push("Ignored invalid seg.mi payload; expected boolean");
  }

  if (start !== undefined && stop !== undefined && stop <= start) {
    stop = start + 1;
    warnings.push("Adjusted invalid segment bounds where stop <= start");
  }
  if (startY !== undefined && stopY !== undefined && stopY <= startY) {
    stopY = startY + 1;
    warnings.push("Adjusted invalid segment Y bounds where stopY <= startY");
  }

  let col: number[][] = [[255, 170, 0], [0, 0, 0], [0, 0, 0]];
  if (Array.isArray(src.col)) {
    const parsed = src.col
      .slice(0, 3)
      .map((entry) => (Array.isArray(entry) ? entry.slice(0, 3).map((ch) => clampByte(ch, 0)) : [0, 0, 0]));
    while (parsed.length < 3) {
      parsed.push([0, 0, 0]);
    }
    col = parsed;
  } else if (src.col !== undefined) {
    warnings.push("Ignored invalid seg.col payload; fallback color palette applied");
  }

  return { i, n, start, stop, ofs, startY, stopY, bri, on, rev, mi, grp, spc, fx, sx, ix, pal, c1, c2, col };
}

export function sanitizeWledEnvelope(input: unknown): ImportResult<WledJsonEnvelope> {
  const warnings: string[] = [];
  const src = asObject(input) ?? {};

  let on: boolean | undefined;
  if (typeof src.on === "boolean") {
    on = src.on;
  } else if (src.on === 1 || src.on === 0) {
    on = src.on === 1;
  }
  if (src.on !== undefined && typeof src.on !== "boolean" && src.on !== 1 && src.on !== 0) {
    warnings.push("Invalid on field; expected boolean/0/1");
  }

  const bri = clampByte(src.bri, 128);

  const segSource = src.seg;
  let seg: WledSegmentPayload | WledSegmentPayload[];
  if (Array.isArray(segSource) && segSource.length > 0) {
    seg = segSource.map((entry) => sanitizeSegment(entry, warnings));
  } else if (Array.isArray(segSource) && segSource.length === 0) {
    warnings.push("Empty seg array; fallback segment was applied");
    seg = sanitizeSegment(undefined, warnings);
  } else {
    seg = sanitizeSegment(segSource, warnings);
  }

  let playlist: WledPlaylistPayload | undefined;
  if (src.playlist !== undefined) {
    const playlistSource = asObject(src.playlist);
    if (!playlistSource) {
      warnings.push("Invalid playlist field; expected object");
    } else {
      const normalized = normalizePlaylistPayload({
        ps: Array.isArray(playlistSource.ps) ? playlistSource.ps.map((value) => Number(value)) : [],
        dur: Array.isArray(playlistSource.dur)
          ? playlistSource.dur.map((value) => Number(value))
          : Number(playlistSource.dur ?? 100),
        transition: Array.isArray(playlistSource.transition)
          ? playlistSource.transition.map((value) => Number(value))
          : Number(playlistSource.transition ?? 0),
        repeat: Number(playlistSource.repeat ?? 0),
        end: playlistSource.end === undefined ? undefined : Number(playlistSource.end),
        r: Boolean(playlistSource.r)
      });
      warnings.push(...normalized.warnings);
      if (normalized.playlist) playlist = normalized.playlist;
    }
  }

  const np = src.np === true;

  const sanitized: WledJsonEnvelope = { on, bri, seg, playlist, np };
  return { data: sanitized, warnings };
}

export function sanitizeTopology(input: unknown): ImportResult<StudioTopology> {
  const warnings: string[] = [];
  const src = asObject(input) ?? {};

  const mode = src.mode === "matrix" ? "matrix" : "strip";
  if (src.mode !== undefined && src.mode !== "strip" && src.mode !== "matrix") {
    warnings.push("Invalid topology mode; fallback to strip");
  }

  const width = Math.max(1, Number.isFinite(Number(src.width)) ? Math.round(Number(src.width)) : 60);
  const height = Math.max(1, Number.isFinite(Number(src.height)) ? Math.round(Number(src.height)) : 1);
  const ledCount = Math.max(1, Number.isFinite(Number(src.ledCount)) ? Math.round(Number(src.ledCount)) : width * height);

  const serpentine = Boolean(src.serpentine);

  const gaps = Array.isArray(src.gaps)
    ? src.gaps
        .map((entry) => asObject(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => ({
          start: Math.max(0, Math.round(Number(entry.start) || 0)),
          length: Math.max(0, Math.round(Number(entry.length) || 0))
        }))
        .filter((gap) => gap.length > 0)
    : [];

  if (src.gaps !== undefined && !Array.isArray(src.gaps)) {
    warnings.push("Invalid topology gaps field; expected array");
  }

  return {
    data: {
      mode,
      width,
      height,
      ledCount,
      serpentine,
      gaps
    },
    warnings
  };
}
