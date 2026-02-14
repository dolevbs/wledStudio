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
      schemaVersion: 2,
      enabled: true,
      ledOpacity: 0.8,
      userLedOpacityOverride: false,
      background: null,
      viewport: { zoom: 1, panX: 0, panY: 0 },
      imageFit: { scaleX: 1, scaleY: 1, lockAspectRatio: true },
      strips: [
        {
          id: "strip_1",
          points: [
            [0, 0],
            [1, 0]
          ],
          ledCount: 8,
          createdAt: 1
        },
        {
          id: "strip_2",
          points: [
            [0, 0.2],
            [1, 0.2]
          ],
          ledCount: 6,
          createdAt: 2
        }
      ],
      links: [
        { stripId: "strip_1", allocations: [{ segmentIndex: 0, share: 1 }] },
        { stripId: "strip_2", allocations: [{ segmentIndex: 1, share: 1 }] }
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

  it("splits one strip across multiple segments by share", () => {
    const project: VisualizationProject = {
      schemaVersion: 2,
      enabled: true,
      ledOpacity: 0.8,
      userLedOpacityOverride: false,
      background: null,
      viewport: { zoom: 1, panX: 0, panY: 0 },
      imageFit: { scaleX: 1, scaleY: 1, lockAspectRatio: true },
      strips: [
        {
          id: "strip_multi",
          points: [
            [0, 0],
            [0.5, 0.5],
            [1, 0]
          ],
          ledCount: 10,
          createdAt: 1
        }
      ],
      links: [
        {
          stripId: "strip_multi",
          allocations: [
            { segmentIndex: 0, share: 0.4 },
            { segmentIndex: 1, share: 0.6 }
          ]
        }
      ],
      derivedIndexMap: [],
      derivedPositions: [],
      draftPoints: [],
      drawing: false
    };

    const result = recomputeVisualizationSync(project, baseCommand);
    const segments = result.segments;
    expect(result.topologyLedCount).toBe(10);
    expect(result.derivedPositions.length).toBe(10);
    expect(segments[0]?.start).toBe(0);
    expect(segments[0]?.stop).toBe(4);
    expect(segments[1]?.start).toBe(4);
    expect(segments[1]?.stop).toBe(10);
  });
});
