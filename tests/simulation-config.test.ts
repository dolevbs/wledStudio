import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { SoftwareWledEngine } from "../src/engine/softwareEngine";

function hashFrame(frame: Uint8Array): string {
  return crypto.createHash("sha256").update(frame).digest("hex");
}

describe("simulation configuration impact", () => {
  it("changes rendered output when effect changes", () => {
    const engine = new SoftwareWledEngine();
    engine.init(120);

    engine.jsonCommand(
      JSON.stringify({
        on: true,
        bri: 180,
        seg: {
          fx: 0,
          sx: 128,
          ix: 128,
          pal: 0,
          col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
        }
      })
    );
    const solidHash = hashFrame(engine.renderFrame(1000));

    engine.jsonCommand(
      JSON.stringify({
        seg: {
          fx: 8
        }
      })
    );
    const rainbowHash = hashFrame(engine.renderFrame(1000));

    expect(rainbowHash).not.toBe(solidHash);
  });

  it("changes rendered output when color scheme changes", () => {
    const engine = new SoftwareWledEngine();
    engine.init(120);

    engine.jsonCommand(
      JSON.stringify({
        on: true,
        bri: 180,
        seg: {
          fx: 8,
          sx: 128,
          ix: 128,
          pal: 1,
          col: [
            [255, 110, 60],
            [255, 20, 120],
            [80, 0, 160]
          ]
        }
      })
    );
    const sunsetHash = hashFrame(engine.renderFrame(800));

    engine.jsonCommand(
      JSON.stringify({
        seg: {
          pal: 2,
          col: [
            [0, 170, 255],
            [0, 70, 170],
            [120, 255, 220]
          ]
        }
      })
    );
    const oceanHash = hashFrame(engine.renderFrame(800));

    expect(oceanHash).not.toBe(sunsetHash);
  });

  it("changes rendered output when effect-specific controls change", () => {
    const engine = new SoftwareWledEngine();
    engine.init(60);

    engine.jsonCommand(
      JSON.stringify({
        on: true,
        bri: 180,
        seg: {
          fx: 0,
          sx: 128,
          ix: 128,
          pal: 0,
          c1: 0,
          col: [
            [255, 0, 0],
            [0, 0, 255],
            [0, 0, 0]
          ]
        }
      })
    );
    const noBlendHash = hashFrame(engine.renderFrame(500));

    engine.jsonCommand(
      JSON.stringify({
        seg: {
          c1: 255
        }
      })
    );
    const blendHash = hashFrame(engine.renderFrame(500));

    expect(blendHash).not.toBe(noBlendHash);
  });
});
