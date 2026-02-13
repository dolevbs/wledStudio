import type { StudioTopology, WledJsonEnvelope, WledPlaylistPayload, WledSegmentPayload } from "@/types/studio";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isByte(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

function isNonNegativeInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateSegment(segment: WledSegmentPayload, prefix: string): string[] {
  const errors: string[] = [];

  if (segment.i !== undefined && !isNonNegativeInt(segment.i)) {
    errors.push(`${prefix}.i must be a non-negative integer`);
  }
  if (segment.n !== undefined && typeof segment.n !== "string") {
    errors.push(`${prefix}.n must be text`);
  }
  if (typeof segment.n === "string" && segment.n.length > 64) {
    errors.push(`${prefix}.n must be at most 64 characters`);
  }
  if (segment.start !== undefined && !isNonNegativeInt(segment.start)) {
    errors.push(`${prefix}.start must be a non-negative integer`);
  }
  if (segment.stop !== undefined && !isNonNegativeInt(segment.stop)) {
    errors.push(`${prefix}.stop must be a non-negative integer`);
  }
  if (segment.ofs !== undefined && !isNonNegativeInt(segment.ofs)) {
    errors.push(`${prefix}.ofs must be a non-negative integer`);
  }
  if (segment.startY !== undefined && !isNonNegativeInt(segment.startY)) {
    errors.push(`${prefix}.startY must be a non-negative integer`);
  }
  if (segment.stopY !== undefined && !isNonNegativeInt(segment.stopY)) {
    errors.push(`${prefix}.stopY must be a non-negative integer`);
  }
  if (segment.bri !== undefined && !isByte(segment.bri)) {
    errors.push(`${prefix}.bri must be an integer between 0 and 255`);
  }
  if (segment.grp !== undefined && !isByte(segment.grp)) {
    errors.push(`${prefix}.grp must be an integer between 0 and 255`);
  }
  if (segment.spc !== undefined && !isByte(segment.spc)) {
    errors.push(`${prefix}.spc must be an integer between 0 and 255`);
  }
  if (
    segment.start !== undefined &&
    segment.stop !== undefined &&
    isNonNegativeInt(segment.start) &&
    isNonNegativeInt(segment.stop) &&
    segment.stop <= segment.start
  ) {
    errors.push(`${prefix}.stop must be greater than ${prefix}.start`);
  }
  if (segment.on !== undefined && typeof segment.on !== "boolean") {
    errors.push(`${prefix}.on must be a boolean`);
  }
  if (segment.rev !== undefined && typeof segment.rev !== "boolean") {
    errors.push(`${prefix}.rev must be a boolean`);
  }
  if (segment.mi !== undefined && typeof segment.mi !== "boolean") {
    errors.push(`${prefix}.mi must be a boolean`);
  }
  if (segment.fx !== undefined && !isByte(segment.fx)) {
    errors.push(`${prefix}.fx must be an integer between 0 and 255`);
  }
  if (segment.sx !== undefined && !isByte(segment.sx)) {
    errors.push(`${prefix}.sx must be an integer between 0 and 255`);
  }
  if (segment.ix !== undefined && !isByte(segment.ix)) {
    errors.push(`${prefix}.ix must be an integer between 0 and 255`);
  }
  if (segment.pal !== undefined && !isByte(segment.pal)) {
    errors.push(`${prefix}.pal must be an integer between 0 and 255`);
  }
  if (segment.c1 !== undefined && !isByte(segment.c1)) {
    errors.push(`${prefix}.c1 must be an integer between 0 and 255`);
  }
  if (segment.c2 !== undefined && !isByte(segment.c2)) {
    errors.push(`${prefix}.c2 must be an integer between 0 and 255`);
  }
  if (segment.col !== undefined) {
    if (!Array.isArray(segment.col) || segment.col.length === 0) {
      errors.push(`${prefix}.col must be a non-empty array`);
    } else {
      segment.col.forEach((color, index) => {
        if (!Array.isArray(color) || color.length < 3 || !color.slice(0, 3).every(isByte)) {
          errors.push(`${prefix}.col[${index}] must contain 3 byte channels`);
        }
      });
    }
  }

  return errors;
}

function validatePlaylist(playlist: WledPlaylistPayload, prefix: string): string[] {
  const errors: string[] = [];
  if (!Array.isArray(playlist.ps) || playlist.ps.length === 0) {
    errors.push(`${prefix}.ps must be a non-empty array`);
  } else {
    playlist.ps.forEach((presetId, index) => {
      if (!isNonNegativeInt(presetId) || presetId < 1 || presetId > 250) {
        errors.push(`${prefix}.ps[${index}] must be an integer between 1 and 250`);
      }
    });
  }

  const validateTimeLike = (value: number[] | number, key: "dur" | "transition") => {
    if (Array.isArray(value)) {
      if (value.length === 0) errors.push(`${prefix}.${key} array cannot be empty`);
      value.forEach((entry, index) => {
        if (!isNonNegativeInt(entry)) errors.push(`${prefix}.${key}[${index}] must be a non-negative integer`);
      });
      return;
    }
    if (!isNonNegativeInt(value)) errors.push(`${prefix}.${key} must be a non-negative integer or array`);
  };

  validateTimeLike(playlist.dur, "dur");
  validateTimeLike(playlist.transition, "transition");

  if (!Number.isInteger(playlist.repeat)) {
    errors.push(`${prefix}.repeat must be an integer`);
  }
  if (playlist.end !== undefined && (!Number.isInteger(playlist.end) || playlist.end < 0 || playlist.end > 255)) {
    errors.push(`${prefix}.end must be an integer between 0 and 255`);
  }
  if (playlist.r !== undefined && typeof playlist.r !== "boolean") {
    errors.push(`${prefix}.r must be a boolean`);
  }

  return errors;
}

export function validateWledEnvelope(payload: WledJsonEnvelope): ValidationResult {
  const errors: string[] = [];

  if (payload.on !== undefined && typeof payload.on !== "boolean") {
    errors.push("on must be a boolean");
  }

  if (payload.bri !== undefined && !isByte(payload.bri)) {
    errors.push("bri must be an integer between 0 and 255");
  }

  const segments = Array.isArray(payload.seg) ? payload.seg : payload.seg ? [payload.seg] : [];
  if (segments.length > 0) {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const prefix = segments.length === 1 && !Array.isArray(payload.seg) ? "seg" : `seg[${index}]`;
      errors.push(...validateSegment(segment, prefix));
    }
  }

  if (payload.playlist !== undefined) {
    errors.push(...validatePlaylist(payload.playlist, "playlist"));
  }
  if (segments.length === 0 && payload.playlist === undefined) {
    errors.push("either seg or playlist is required");
  }

  if (payload.np !== undefined && typeof payload.np !== "boolean") {
    errors.push("np must be a boolean");
  }

  return { valid: errors.length === 0, errors };
}

export function validateTopology(topology: StudioTopology): ValidationResult {
  const errors: string[] = [];

  if (topology.mode !== "strip" && topology.mode !== "matrix") {
    errors.push("mode must be strip or matrix");
  }
  if (!Number.isInteger(topology.ledCount) || topology.ledCount < 1) {
    errors.push("ledCount must be a positive integer");
  }
  if (!Number.isInteger(topology.width) || topology.width < 1) {
    errors.push("width must be a positive integer");
  }
  if (!Number.isInteger(topology.height) || topology.height < 1) {
    errors.push("height must be a positive integer");
  }

  return { valid: errors.length === 0, errors };
}
