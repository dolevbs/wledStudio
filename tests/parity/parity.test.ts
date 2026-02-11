import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import vectors from "../fixtures/parity_vectors.json";
import { SoftwareWledEngine } from "../../src/engine/softwareEngine";

const effectIds = [0, 1, 2, 8, 9, 20, 28, 37, 41, 45, 57, 63];
const times = [0, 500, 1000, 2000];

describe("parity vectors", () => {
  it("matches deterministic golden frame hashes for curated effects", () => {
    for (const fx of effectIds) {
      const engine = new SoftwareWledEngine();
      engine.init(300);
      engine.jsonCommand(
        JSON.stringify({
          on: true,
          bri: 128,
          seg: {
            fx,
            sx: 128,
            ix: 128,
            col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
          }
        })
      );

      for (const t of times) {
        const frame = engine.renderFrame(t);
        const hash = crypto.createHash("sha256").update(frame).digest("hex");
        expect(hash).toBe(vectors[String(fx)][String(t)]);
      }
    }
  });
});
