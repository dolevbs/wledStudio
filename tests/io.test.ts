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
    expect(seg?.pal).toBe(0);
    expect(seg?.c1).toBe(0);
    expect(seg?.c2).toBe(0);
  });

  it("preserves and sanitizes multiple segments", () => {
    const result = sanitizeWledEnvelope({
      seg: [
        { i: 0, start: 0, stop: 50, fx: 8, col: [[255, 0, 0], [0, 0, 0], [0, 0, 0]] },
        { i: 1, start: 50, stop: 100, fx: 9, col: [[0, 0, 255], [0, 0, 0], [0, 0, 0]] }
      ]
    });

    expect(Array.isArray(result.data.seg)).toBe(true);
    const seg = result.data.seg as Array<{ i?: number; start?: number; stop?: number; fx?: number }>;
    expect(seg).toHaveLength(2);
    expect(seg[0]?.i).toBe(0);
    expect(seg[0]?.start).toBe(0);
    expect(seg[0]?.stop).toBe(50);
    expect(seg[1]?.i).toBe(1);
    expect(seg[1]?.start).toBe(50);
    expect(seg[1]?.stop).toBe(100);
    expect(seg[1]?.fx).toBe(9);
  });

  it("sanitizes segment configuration fields", () => {
    const result = sanitizeWledEnvelope({
      seg: {
        n: "Kitchen Strip",
        start: 40,
        stop: 30,
        ofs: 12,
        startY: 5,
        stopY: 2,
        bri: 300,
        on: true,
        rev: true,
        mi: false,
        grp: 3,
        spc: 2
      }
    });
    const seg = Array.isArray(result.data.seg) ? result.data.seg[0] : result.data.seg;
    expect(seg?.n).toBe("Kitchen Strip");
    expect(seg?.start).toBe(40);
    expect(seg?.stop).toBe(41);
    expect(seg?.ofs).toBe(12);
    expect(seg?.startY).toBe(5);
    expect(seg?.stopY).toBe(6);
    expect(seg?.bri).toBe(255);
    expect(seg?.on).toBe(true);
    expect(seg?.rev).toBe(true);
    expect(seg?.mi).toBe(false);
    expect(seg?.grp).toBe(3);
    expect(seg?.spc).toBe(2);
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
        pal: 2,
        c1: 64,
        c2: 32,
        col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
      }
    });

    const parsed = JSON.parse(json);
    expect(parsed["0"].seg.fx).toBe(8);
    expect(parsed["0"].seg.pal).toBe(2);
    expect(parsed["0"].seg.c1).toBe(64);
    expect(parsed["0"].seg.c2).toBe(32);
  });
});
