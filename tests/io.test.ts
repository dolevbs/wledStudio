import { describe, expect, it } from "vitest";

import { buildCfgJson, buildPresetsJson } from "../src/io/jsonIO";
import { sanitizeTopology, sanitizeWledEnvelope } from "../src/io/sanitize";

describe("io sanitization", () => {
  it("sanitizes missing WLED fields", () => {
    const result = sanitizeWledEnvelope({ seg: [{ fx: 8 }] });
    const seg = Array.isArray(result.data.seg) ? result.data.seg[0] : result.data.seg;

    expect(result.data.on).toBeUndefined();
    expect(result.data.bri).toBe(128);
    expect(seg?.sx).toBe(128);
    expect(seg?.ix).toBe(128);
  });

  it("sanitizes topology gaps", () => {
    const result = sanitizeTopology({
      mode: "strip",
      ledCount: 200,
      width: 200,
      height: 1,
      gaps: [{ start: 10, length: 2 }, { start: -5, length: 2 }]
    });

    expect(result.data.gaps).toEqual([
      { start: 10, length: 2 },
      { start: 0, length: 2 }
    ]);
  });
});

describe("io export", () => {
  it("exports valid cfg json", () => {
    const json = buildCfgJson({
      mode: "matrix",
      ledCount: 900,
      width: 30,
      height: 30,
      serpentine: true,
      gaps: []
    });

    const parsed = JSON.parse(json);
    expect(parsed.hw.led.total).toBe(900);
    expect(parsed.hw.led.matrix).toBe(true);
  });

  it("exports valid presets json", () => {
    const json = buildPresetsJson({
      on: true,
      bri: 180,
      seg: {
        fx: 8,
        sx: 128,
        ix: 128,
        col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
      }
    });

    const parsed = JSON.parse(json);
    expect(parsed["0"].seg.fx).toBe(8);
  });
});
