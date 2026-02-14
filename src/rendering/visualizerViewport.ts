import type { VisualizationViewport } from "@/types/studio";

export const VISUALIZER_MIN_ZOOM = 0.25;
export const VISUALIZER_MAX_ZOOM = 8;

function maxPanForZoom(zoom: number): number {
  return 0.5 + zoom * 0.5;
}

export function clampViewport(viewport: VisualizationViewport): VisualizationViewport {
  const zoom = Math.max(VISUALIZER_MIN_ZOOM, Math.min(VISUALIZER_MAX_ZOOM, viewport.zoom));
  const maxPan = maxPanForZoom(zoom);
  return {
    zoom,
    panX: Math.max(-maxPan, Math.min(maxPan, viewport.panX)),
    panY: Math.max(-maxPan, Math.min(maxPan, viewport.panY))
  };
}

export function identityViewport(): VisualizationViewport {
  return { zoom: 1, panX: 0, panY: 0 };
}

export function sceneToScreenPoint(
  x: number,
  y: number,
  viewport: VisualizationViewport,
  width: number,
  height: number
): [number, number] {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const next = clampViewport(viewport);
  const sx = ((x - 0.5) * next.zoom + 0.5 + next.panX) * safeWidth;
  const sy = ((y - 0.5) * next.zoom + 0.5 + next.panY) * safeHeight;
  return [sx, sy];
}

export function projectSceneToViewport(
  point: [number, number],
  viewport: VisualizationViewport,
  width: number,
  height: number
): [number, number] {
  return sceneToScreenPoint(point[0], point[1], viewport, width, height);
}

export function screenToScenePoint(
  x: number,
  y: number,
  viewport: VisualizationViewport,
  width: number,
  height: number
): [number, number] {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const next = clampViewport(viewport);

  const nx = x / safeWidth;
  const ny = y / safeHeight;
  const sceneX = ((nx - 0.5 - next.panX) / next.zoom) + 0.5;
  const sceneY = ((ny - 0.5 - next.panY) / next.zoom) + 0.5;
  return [sceneX, sceneY];
}

export function clampScenePoint(x: number, y: number): [number, number] {
  const safeX = Math.max(0, Math.min(1, x));
  const safeY = Math.max(0, Math.min(1, y));
  return [safeX, safeY];
}
