import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LedViewCard } from "../src/components/LedViewCard";
import type { VisualizationProject } from "../src/types/studio";

function buildVisualization(backgroundVisible: boolean): VisualizationProject {
  return {
    schemaVersion: 2,
    enabled: false,
    ledOpacity: 0.8,
    userLedOpacityOverride: false,
    background: {
      name: "bg.png",
      dataUrl: "data:image/png;base64,abc",
      width: 10,
      height: 10
    },
    backgroundVisible,
    viewport: { zoom: 1, panX: 0, panY: 0 },
    imageFit: { scaleX: 1, scaleY: 1, lockAspectRatio: true },
    strips: [],
    links: [],
    derivedIndexMap: [],
    derivedPositions: [],
    draftPoints: [],
    drawing: false
  };
}

function renderCard(visualization: VisualizationProject): string {
  return renderToStaticMarkup(
    createElement(LedViewCard, {
      canvasRef: { current: null } as RefObject<HTMLCanvasElement>,
      ledCount: 10,
      simulatedMillis: 0,
      simTickRate: 30,
      lastError: "",
      visualization,
      segmentCount: 1,
      ledViewHeightPx: 300,
      setLedViewHeight: vi.fn(),
      addSegment: vi.fn(),
      setVisualizationEnabled: vi.fn(),
      setVisualizationLedOpacity: vi.fn(),
      setVisualizationBackground: vi.fn(),
      setVisualizationBackgroundVisible: vi.fn(),
      setVisualizationViewport: vi.fn(),
      resetVisualizationViewport: vi.fn(),
      startVisualizationStrip: vi.fn(),
      addVisualizationPoint: vi.fn(),
      finishVisualizationStrip: vi.fn(),
      cancelVisualizationStrip: vi.fn(),
      removeVisualizationStrip: vi.fn(),
      setStripSegmentAllocations: vi.fn(),
      updateVisualizationStripLedCount: vi.fn(),
      importVisualizationProject: vi.fn(),
      exportVisualizationProject: vi.fn(() => "{}")
    })
  );
}

describe("LedViewCard background visibility", () => {
  it("renders background image when visible", () => {
    const html = renderCard(buildVisualization(true));
    expect(html).toContain("ledOverlayImage");
    expect(html).not.toContain("Background hidden (image retained)");
  });

  it("hides background image and shows helper text when hidden", () => {
    const html = renderCard(buildVisualization(false));
    expect(html).not.toContain("ledOverlayImage");
    expect(html).toContain("Background hidden (image retained)");
  });
});
