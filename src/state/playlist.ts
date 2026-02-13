import type { WledPlaylistPayload } from "@/types/studio";

export interface NormalizedPlaylist {
  ps: number[];
  dur: number[];
  transition: number[];
  repeat: number;
  end: number;
  r: boolean;
}

export interface PlaylistNormalizationResult {
  valid: boolean;
  warnings: string[];
  playlist: NormalizedPlaylist | null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeTimingField(
  value: number[] | number | undefined,
  length: number,
  fallback: number,
  max: number,
  warnings: string[],
  key: "dur" | "transition"
): number[] {
  let values: number[];
  if (Array.isArray(value)) {
    values = value.map((entry) => clampInt(entry, 0, max, fallback));
  } else {
    values = [clampInt(value, 0, max, fallback)];
  }

  if (values.length === 0) {
    values = [fallback];
  }

  if (values.length < length) {
    const last = values[values.length - 1] ?? fallback;
    while (values.length < length) values.push(last);
    warnings.push(`playlist.${key} was extended to match playlist.ps length`);
  }

  if (values.length > length) {
    values = values.slice(0, length);
    warnings.push(`playlist.${key} was truncated to playlist.ps length`);
  }

  return values;
}

export function normalizePlaylistPayload(payload: WledPlaylistPayload | null | undefined): PlaylistNormalizationResult {
  const warnings: string[] = [];
  if (!payload || !Array.isArray(payload.ps)) {
    return {
      valid: false,
      warnings: ["playlist.ps must be a non-empty array"],
      playlist: null
    };
  }

  let ps = payload.ps
    .map((entry) => clampInt(entry, 0, 255, 0))
    .filter((entry) => entry > 0 && entry <= 250);

  if (ps.length === 0) {
    return {
      valid: false,
      warnings: ["playlist.ps contained no valid preset IDs (1..250)"],
      playlist: null
    };
  }

  if (ps.length > 100) {
    ps = ps.slice(0, 100);
    warnings.push("playlist.ps was clamped to 100 entries");
  }

  const dur = normalizeTimingField(payload.dur, ps.length, 100, 65530, warnings, "dur");
  const transition = normalizeTimingField(payload.transition, ps.length, 0, 65530, warnings, "transition");

  let repeat = clampInt(payload.repeat, -32768, 32767, 0);
  let shuffle = Boolean(payload.r);
  if (repeat < 0) {
    repeat = 0;
    shuffle = true;
    warnings.push("playlist.repeat < 0 normalized to infinite repeat with shuffle enabled");
  }

  let end = clampInt(payload.end, 0, 255, 0);
  if (end > 250 && end !== 255) {
    end = 0;
    warnings.push("playlist.end > 250 (except 255) normalized to 0");
  }

  return {
    valid: true,
    warnings,
    playlist: {
      ps,
      dur,
      transition,
      repeat,
      end,
      r: shuffle
    }
  };
}

export function shufflePlaylistOrder(values: number[]): number[] {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j] ?? out[i];
    out[j] = tmp ?? out[j];
  }
  return out;
}
