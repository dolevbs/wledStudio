import { describe, expect, it } from "vitest";

import { buildLedPositions, buildPhysicalIndexMap } from "../src/rendering/topology";

describe("topology mapping", () => {
  it("builds strip map with gap offsets", () => {
    const map = buildPhysicalIndexMap(8, [{ start: 3, length: 2 }]);
    expect(map).toEqual([0, 1, 2, 5, 6, 7, 8, 9]);
  });

  it("applies serpentine mapping in matrix", () => {
    const positions = buildLedPositions({
      mode: "matrix",
      ledCount: 6,
      width: 3,
      height: 2,
      serpentine: true,
      gaps: []
    });

    expect(positions).toEqual([
      [-1, 0.5, 0],
      [0, 0.5, 0],
      [1, 0.5, 0],
      [1, -0.5, 0],
      [0, -0.5, 0],
      [-1, -0.5, 0]
    ]);
  });
});
