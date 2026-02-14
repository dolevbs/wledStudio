import { afterEach, describe, expect, it } from "vitest";

import { useStudioStore } from "../src/state/studioStore";

afterEach(() => {
  useStudioStore.getState().resetState();
});

describe("visualization project store contract", () => {
  it("rejects import without schemaVersion=2", () => {
    const before = useStudioStore.getState().visualization;

    useStudioStore.getState().importVisualizationProject({});

    const state = useStudioStore.getState();
    expect(state.warnings).toContain("Visualizer import failed: only schemaVersion=2 projects are supported.");
    expect(state.visualization).toEqual(before);
  });

  it("imports schemaVersion=2 payload and exports schemaVersion=2", () => {
    useStudioStore.getState().importVisualizationProject({
      schemaVersion: 2,
      enabled: true,
      ledOpacity: 1,
      viewport: { zoom: 1.5, panX: 0.2, panY: -0.1 },
      imageFit: { scaleX: 1.2, scaleY: 0.8, lockAspectRatio: false },
      background: null,
      strips: [
        {
          id: "s1",
          points: [
            [0, 0],
            [1, 1]
          ],
          ledCount: 4,
          createdAt: 123
        }
      ],
      links: [{ stripId: "s1", allocations: [{ segmentIndex: 0, share: 1 }] }]
    });

    const exported = JSON.parse(useStudioStore.getState().exportVisualizationProject()) as {
      schemaVersion: number;
      ledOpacity: number;
      viewport: { zoom: number; panX: number; panY: number };
      imageFit: { scaleX: number; scaleY: number; lockAspectRatio: boolean };
      strips: Array<{ id: string }>;
    };

    expect(exported.schemaVersion).toBe(2);
    expect(exported.ledOpacity).toBe(1);
    expect(exported.viewport.zoom).toBeCloseTo(1.5, 6);
    expect(exported.viewport.panX).toBeCloseTo(0.2, 6);
    expect(exported.viewport.panY).toBeCloseTo(-0.1, 6);
    expect(exported.imageFit.scaleX).toBeCloseTo(1.2, 6);
    expect(exported.imageFit.scaleY).toBeCloseTo(0.8, 6);
    expect(exported.imageFit.lockAspectRatio).toBe(false);
    expect(exported.strips[0]?.id).toBe("s1");
  });

  it("validates normalized points during import", () => {
    useStudioStore.getState().importVisualizationProject({
      schemaVersion: 2,
      enabled: true,
      ledOpacity: 0.8,
      viewport: { zoom: 1, panX: 0, panY: 0 },
      imageFit: { scaleX: 1, scaleY: 1, lockAspectRatio: true },
      background: null,
      strips: [
        {
          id: "invalid",
          points: [
            [-1, 0.2],
            [2, 0.8]
          ],
          ledCount: 5,
          createdAt: 111
        }
      ],
      links: [{ stripId: "invalid", allocations: [{ segmentIndex: 0, share: 1 }] }]
    });

    const state = useStudioStore.getState();
    expect(state.visualization.strips).toHaveLength(0);
    expect(state.visualization.links).toHaveLength(0);
  });

  it("locks aspect ratio by default when changing image scale", () => {
    useStudioStore.getState().setVisualizationImageScale(1.5, 0.9);
    let fit = useStudioStore.getState().visualization.imageFit;
    expect(fit.scaleX).toBeCloseTo(1.5, 6);
    expect(fit.scaleY).toBeCloseTo(1.5, 6);
    expect(fit.lockAspectRatio).toBe(true);

    useStudioStore.getState().setVisualizationAspectLock(false);
    useStudioStore.getState().setVisualizationImageScale(1.4, 0.9);
    fit = useStudioStore.getState().visualization.imageFit;
    expect(fit.scaleX).toBeCloseTo(1.4, 6);
    expect(fit.scaleY).toBeCloseTo(0.9, 6);
    expect(fit.lockAspectRatio).toBe(false);
  });

  it("supports preset and custom LEDs view heights", () => {
    useStudioStore.getState().setLedViewSizePreset("s");
    let ui = useStudioStore.getState().ui;
    expect(ui.ledViewSizePreset).toBe("s");
    expect(ui.ledViewHeightPx).toBe(260);

    useStudioStore.getState().setLedViewHeight(9999);
    ui = useStudioStore.getState().ui;
    expect(ui.ledViewSizePreset).toBe("custom");
    expect(ui.ledViewHeightPx).toBe(720);
  });

  it("uses 80% LED opacity by default and supports 100%", () => {
    let state = useStudioStore.getState();
    expect(state.visualization.ledOpacity).toBeCloseTo(0.8, 6);

    state.setVisualizationLedOpacity(1);
    state = useStudioStore.getState();
    expect(state.visualization.ledOpacity).toBeCloseTo(1, 6);
  });

  it("auto-boosts opacity on upload until user manually overrides it", () => {
    const background = {
      name: "test.png",
      dataUrl: "data:image/png;base64,abc",
      width: 100,
      height: 100
    };

    let state = useStudioStore.getState();
    state.setVisualizationBackground(background);
    state = useStudioStore.getState();
    expect(state.visualization.ledOpacity).toBeCloseTo(1, 6);
    expect(state.visualization.userLedOpacityOverride).toBe(false);

    state.setVisualizationLedOpacity(0.8);
    state = useStudioStore.getState();
    expect(state.visualization.userLedOpacityOverride).toBe(true);

    state.setVisualizationBackground(background);
    state = useStudioStore.getState();
    expect(state.visualization.ledOpacity).toBeCloseTo(0.8, 6);
  });
});
