import type { ImportResult, StudioTopology, WledJsonEnvelope, WledSegmentPayload } from "@/types/studio";

function clampByte(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(255, Math.max(0, Math.round(n)));
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

  return { fx, sx, ix, col };
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
  let seg: WledSegmentPayload;
  if (Array.isArray(segSource) && segSource.length > 0) {
    seg = sanitizeSegment(segSource[0], warnings);
    if (segSource.length > 1) {
      warnings.push("Multiple segments found; MVP currently applies first segment only");
    }
  } else {
    seg = sanitizeSegment(segSource, warnings);
  }

  const sanitized: WledJsonEnvelope = { on, bri, seg };
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
