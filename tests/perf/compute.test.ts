import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { SoftwareWledEngine } from "../../src/engine/softwareEngine";

describe("performance smoke", () => {
  it("computes 2000 LED frames under 4ms average in software fallback", () => {
    const engine = new SoftwareWledEngine();
    engine.init(2000);
    engine.jsonCommand(
      JSON.stringify({
        on: true,
        bri: 180,
        seg: {
          fx: 8,
          sx: 150,
          ix: 140,
          col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
        }
      })
    );

    const frames = 180;
    const start = performance.now();
    for (let i = 0; i < frames; i += 1) {
      engine.renderFrame(i * 16);
    }
    const total = performance.now() - start;
    const average = total / frames;

    expect(average).toBeLessThan(4);
  });
});
