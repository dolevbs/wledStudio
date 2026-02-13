import { describe, expect, it } from "vitest";

import { recomputeVisualizationSync } from "../src/rendering/visualization";
import type { VisualizationProject, WledJsonEnvelope } from "../src/types/studio";

describe("visualization sync", () => {
  const baseCommand: WledJsonEnvelope = {
    on: true,
    bri: 128,
    seg: [
      { i: 0, start: 0, stop: 10, fx: 8, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0, col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]] },
      { i: 1, start: 10, stop: 20, fx: 9, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0, col: [[0, 120, 255], [0, 0, 0], [0, 0, 0]] }
    ]
  };

  it("maps strips to segment ranges and creates derived positions", () => {
    const project: VisualizationProject = {
      enabled: true,
      background: null,
      strips: [
        {
          id: "strip_1",
          points: [
            [0, 0],
            [100, 0]
          ],
          ledCount: 8,
          createdAt: 1
        },
        {
          id: "strip_2",
          points: [
            [0, 20],
            [100, 20]
          ],
          ledCount: 6,
          createdAt: 2
        }
      ],
      links: [
        { stripId: "strip_1", segmentIndex: 0 },
        { stripId: "strip_2", segmentIndex: 1 }
      ],
      derivedIndexMap: [],
      derivedPositions: [],
      draftPoints: [],
      drawing: false
    };

    const result = recomputeVisualizationSync(project, baseCommand);
    const segments = result.segments;

    expect(result.topologyLedCount).toBe(14);
    expect(result.derivedPositions.length).toBe(14);
    expect(result.derivedIndexMap).toEqual(new Array(14).fill(0).map((_, i) => i));

    expect(segments[0]?.start).toBe(0);
    expect(segments[0]?.stop).toBe(8);
    expect(segments[1]?.start).toBe(8);
    expect(segments[1]?.stop).toBe(14);
  });
});
