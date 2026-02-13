import { describe, expect, it } from "vitest";

import { buildSegmentMap, normalizeSegments, renderCompositedFrame } from "../src/engine/segmentComposer";
import type { WledEngine } from "../src/engine/softwareEngine";
import type { WledJsonEnvelope, WledSegmentPayload } from "../src/types/studio";

class FakeEngine implements WledEngine {
  private ledCount = 1;
  private frame = new Uint8Array(3);
  private state: Required<Pick<WledSegmentPayload, "fx" | "sx" | "ix" | "pal" | "c1" | "c2" | "col">> = {
    fx: 0,
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
  };
  private bri = 255;

  init(ledCount: number): void {
    this.ledCount = Math.max(1, Math.round(ledCount));
    this.frame = new Uint8Array(this.ledCount * 3);
  }

  jsonCommand(payload: string): void {
    const parsed = JSON.parse(payload) as WledJsonEnvelope;
    this.bri = typeof parsed.bri === "number" ? parsed.bri : 255;
    const seg = (Array.isArray(parsed.seg) ? parsed.seg[0] : parsed.seg) ?? {};
    this.state = {
      fx: seg.fx ?? 0,
      sx: seg.sx ?? 128,
      ix: seg.ix ?? 128,
      pal: seg.pal ?? 0,
      c1: seg.c1 ?? 0,
      c2: seg.c2 ?? 0,
      col: (seg.col ?? [
        [255, 170, 0],
        [0, 0, 0],
        [0, 0, 0]
      ]) as [[number, number, number], [number, number, number], [number, number, number]]
    };
  }

  renderFrame(simulatedMillis: number): Uint8Array {
    const c0 = this.state.col[0];
    const c1 = this.state.col[1];
    const scale = this.bri / 255;

    for (let i = 0; i < this.ledCount; i += 1) {
      const off = i * 3;
      let color: [number, number, number] = [0, 0, 0];
      if (this.state.fx === 1) {
        color = Math.floor(simulatedMillis / 120) % 2 === 0 ? [c0[0], c0[1], c0[2]] : [0, 0, 0];
      } else if (this.state.fx === 28) {
        color = i === (Math.floor(simulatedMillis / 40) % this.ledCount) ? [c0[0], c0[1], c0[2]] : [0, 0, 0];
      } else if (this.state.fx === 8) {
        const t = ((i + Math.floor(simulatedMillis / 20)) % this.ledCount) / Math.max(1, this.ledCount - 1);
        color = [
          Math.round(c0[0] + (c1[0] - c0[0]) * t),
          Math.round(c0[1] + (c1[1] - c0[1]) * t),
          Math.round(c0[2] + (c1[2] - c0[2]) * t)
        ];
      } else if (this.state.fx === 16) {
        color = (i + Math.floor(simulatedMillis / 50)) % 3 === 0 ? [c0[0], c0[1], c0[2]] : [0, 0, 0];
      } else {
        color = [c0[0], c0[1], c0[2]];
      }

      this.frame[off] = Math.round(color[0] * scale);
      this.frame[off + 1] = Math.round(color[1] * scale);
      this.frame[off + 2] = Math.round(color[2] * scale);
    }
    return this.frame;
  }

  getBufferSize(): number {
    return this.frame.length;
  }
  getLastError(): string {
    return "";
  }
}

function pixel(frame: Uint8Array, index: number): [number, number, number] {
  const off = index * 3;
  return [frame[off], frame[off + 1], frame[off + 2]];
}

describe("segment composer normalize/map", () => {
  it("defaults to one full-strip segment with on/bri defaults", () => {
    const segments = normalizeSegments({}, 150);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.start).toBe(0);
    expect(segments[0]?.stop).toBe(150);
    expect(segments[0]?.on).toBe(true);
    expect(segments[0]?.bri).toBe(125);
  });

  it("applies grouping and spacing mapping", () => {
    const [segment] = normalizeSegments({ seg: { start: 0, stop: 9, grp: 2, spc: 1 } }, 20);
    const map = buildSegmentMap(segment!);
    expect(map.localToVirtual).toEqual([0, 0, -1, 1, 1, -1, 2, 2, -1]);
  });
});

describe("segment composer compositing", () => {
  it("supports overlap ordering (later wins)", () => {
    const engine = new FakeEngine();
    const frame = renderCompositedFrame(
      engine,
      {
        on: true,
        bri: 255,
        seg: [
          { start: 0, stop: 8, bri: 255, fx: 0, col: [[255, 0, 0], [0, 0, 0], [0, 0, 0]] },
          { start: 4, stop: 10, bri: 255, fx: 0, col: [[0, 255, 0], [0, 0, 0], [0, 0, 0]] }
        ]
      },
      10,
      0
    );

    expect(pixel(frame, 2)).toEqual([255, 0, 0]);
    expect(pixel(frame, 5)).toEqual([0, 255, 0]);
    expect(pixel(frame, 9)).toEqual([0, 255, 0]);
  });

  it("matches example 1 basic state", () => {
    const engine = new FakeEngine();
    const frame = renderCompositedFrame(
      engine,
      { on: true, bri: 255, seg: { start: 0, stop: 100, bri: 255, fx: 1, col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]] } },
      100,
      0
    );
    expect(pixel(frame, 0)).toEqual([255, 170, 0]);
    expect(pixel(frame, 99)).toEqual([255, 170, 0]);
  });

  it("matches example 2 multi segment blink + solid", () => {
    const engine = new FakeEngine();
    const frame = renderCompositedFrame(
      engine,
      {
        on: true,
        bri: 255,
        seg: [
          { start: 0, stop: 11, bri: 255, fx: 1, col: [[0, 0, 255], [0, 0, 0], [0, 0, 0]] },
          { start: 11, stop: 100, bri: 255, fx: 0, col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]] }
        ]
      },
      100,
      0
    );
    expect(pixel(frame, 5)).toEqual([0, 0, 255]);
    expect(pixel(frame, 50)).toEqual([255, 170, 0]);
  });

  it("matches example 3 multi segment chase + colorloop", () => {
    const engine = new FakeEngine();
    const frame = renderCompositedFrame(
      engine,
      {
        on: true,
        bri: 255,
        seg: [
          { start: 0, stop: 51, bri: 255, fx: 28, col: [[255, 0, 0], [0, 0, 0], [0, 0, 0]] },
          { start: 51, stop: 100, bri: 255, fx: 8, col: [[0, 255, 0], [0, 0, 255], [0, 0, 0]] }
        ]
      },
      100,
      80
    );
    expect(pixel(frame, 10)).not.toEqual(pixel(frame, 70));
  });

  it("matches example 4 with powered-off middle segment", () => {
    const engine = new FakeEngine();
    const frame = renderCompositedFrame(
      engine,
      {
        on: true,
        bri: 255,
        seg: [
          { start: 0, stop: 31, bri: 255, fx: 1, col: [[255, 255, 0], [0, 0, 0], [0, 0, 0]] },
          { start: 31, stop: 61, on: false, fx: 0, col: [[255, 0, 255], [0, 0, 0], [0, 0, 0]] },
          { start: 61, stop: 100, bri: 255, fx: 16, col: [[0, 180, 255], [0, 0, 0], [0, 0, 0]] }
        ]
      },
      100,
      100
    );
    expect(pixel(frame, 10)).toEqual([255, 255, 0]);
    expect(pixel(frame, 40)).toEqual([0, 0, 0]);
    expect(pixel(frame, 80)).not.toEqual([0, 0, 0]);
  });
});
