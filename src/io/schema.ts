import type { StudioTopology, WledJsonEnvelope } from "@/types/studio";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isByte(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

export function validateWledEnvelope(payload: WledJsonEnvelope): ValidationResult {
  const errors: string[] = [];

  if (payload.on !== undefined && typeof payload.on !== "boolean") {
    errors.push("on must be a boolean");
  }

  if (payload.bri !== undefined && !isByte(payload.bri)) {
    errors.push("bri must be an integer between 0 and 255");
  }

  const seg = Array.isArray(payload.seg) ? payload.seg[0] : payload.seg;
  if (!seg) {
    errors.push("seg is required");
  } else {
    if (seg.fx !== undefined && !isByte(seg.fx)) {
      errors.push("seg.fx must be an integer between 0 and 255");
    }
    if (seg.sx !== undefined && !isByte(seg.sx)) {
      errors.push("seg.sx must be an integer between 0 and 255");
    }
    if (seg.ix !== undefined && !isByte(seg.ix)) {
      errors.push("seg.ix must be an integer between 0 and 255");
    }
    if (seg.pal !== undefined && !isByte(seg.pal)) {
      errors.push("seg.pal must be an integer between 0 and 255");
    }
    if (seg.c1 !== undefined && !isByte(seg.c1)) {
      errors.push("seg.c1 must be an integer between 0 and 255");
    }
    if (seg.c2 !== undefined && !isByte(seg.c2)) {
      errors.push("seg.c2 must be an integer between 0 and 255");
    }
    if (seg.col !== undefined) {
      if (!Array.isArray(seg.col) || seg.col.length === 0) {
        errors.push("seg.col must be a non-empty array");
      } else {
        seg.col.forEach((color, index) => {
          if (!Array.isArray(color) || color.length < 3 || !color.slice(0, 3).every(isByte)) {
            errors.push(`seg.col[${index}] must contain 3 byte channels`);
          }
        });
      }
    }
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
