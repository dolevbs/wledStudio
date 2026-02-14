import { describe, expect, it } from "vitest";

import { StudioRenderer } from "../src/rendering/StudioRenderer";
import type { StudioTopology } from "../src/types/studio";

interface MutableCanvas extends HTMLCanvasElement {
  _setClientSize: (width: number, height: number) => void;
}

function createMockCanvas(initialWidth: number, initialHeight: number): MutableCanvas {
  let clientWidth = initialWidth;
  let clientHeight = initialHeight;
  const ctx = {
    setTransform: () => {},
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    fillStyle: "",
    globalAlpha: 1,
    shadowColor: "transparent",
    shadowBlur: 0
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: initialWidth,
    height: initialHeight,
    style: {},
    getContext: () => ctx
  } as unknown as MutableCanvas;

  Object.defineProperty(canvas, "clientWidth", { get: () => clientWidth });
  Object.defineProperty(canvas, "clientHeight", { get: () => clientHeight });
  canvas._setClientSize = (width: number, height: number) => {
    clientWidth = width;
    clientHeight = height;
  };
  return canvas;
}

function createTopology(ledCount: number): StudioTopology {
  return {
    mode: "strip",
    ledCount,
    width: ledCount,
    height: 1,
    serpentine: false,
    gaps: []
  };
}

describe("renderer resize sync", () => {
  it("keeps CSS size owned by layout and only updates backing store", () => {
    (globalThis as { window: { devicePixelRatio: number } }).window = { devicePixelRatio: 1 };
    const canvas = createMockCanvas(320, 240);
    const renderer = new StudioRenderer(canvas, createTopology(30));

    canvas._setClientSize(320, 540);
    renderer.resize();

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(540);
    expect((canvas.style as Record<string, string>).width).toBeUndefined();
    expect((canvas.style as Record<string, string>).height).toBeUndefined();
  });

  it("self-heals backing size when client size changes between frames", () => {
    (globalThis as { window: { devicePixelRatio: number } }).window = { devicePixelRatio: 1 };
    const canvas = createMockCanvas(300, 220);
    const renderer = new StudioRenderer(canvas, createTopology(20));
    const initialHeight = canvas.height;

    canvas._setClientSize(300, 480);
    renderer.render();

    expect(initialHeight).toBe(220);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(480);
  });
});
