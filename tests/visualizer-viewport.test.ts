import { describe, expect, it } from "vitest";

import {
  clampViewport,
  identityViewport,
  projectSceneToViewport,
  sceneToScreenPoint,
  screenToScenePoint,
  VISUALIZER_MAX_ZOOM,
  VISUALIZER_MIN_ZOOM
} from "../src/rendering/visualizerViewport";

describe("visualizer viewport", () => {
  it("roundtrips scene->screen->scene", () => {
    const viewport = { zoom: 2.2, panX: 0.1, panY: -0.05 };
    const point: [number, number] = [0.23, 0.77];

    const [sx, sy] = sceneToScreenPoint(point[0], point[1], viewport, 800, 600);
    const [x, y] = screenToScenePoint(sx, sy, viewport, 800, 600);

    expect(x).toBeCloseTo(point[0], 8);
    expect(y).toBeCloseTo(point[1], 8);
  });

  it("clamps zoom and pan", () => {
    const clamped = clampViewport({ zoom: 999, panX: 999, panY: -999 });
    expect(clamped.zoom).toBe(VISUALIZER_MAX_ZOOM);
    expect(clamped.panX).toBeLessThanOrEqual(0.5 + VISUALIZER_MAX_ZOOM * 0.5);
    expect(clamped.panY).toBeGreaterThanOrEqual(-(0.5 + VISUALIZER_MAX_ZOOM * 0.5));

    const clampedLow = clampViewport({ zoom: 0.0001, panX: 0, panY: 0 });
    expect(clampedLow.zoom).toBe(VISUALIZER_MIN_ZOOM);
  });

  it("returns identity viewport", () => {
    expect(identityViewport()).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it("keeps projection parity across varying viewport sizes", () => {
    const viewport = { zoom: 1.75, panX: -0.12, panY: 0.08 };
    const point: [number, number] = [0.62, 0.31];
    const sizes = [
      [320, 220],
      [960, 360],
      [1280, 720]
    ] as const;

    for (const [width, height] of sizes) {
      const [sxA, syA] = sceneToScreenPoint(point[0], point[1], viewport, width, height);
      const [sxB, syB] = projectSceneToViewport(point, viewport, width, height);
      expect(sxA).toBeCloseTo(sxB, 8);
      expect(syA).toBeCloseTo(syB, 8);
    }
  });
});
