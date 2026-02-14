import type { StudioTopology } from "@/types/studio";
import { buildLedPositions, buildPhysicalIndexMap } from "@/rendering/topology";

type Vec3 = [number, number, number];
type OverrideMode = "world" | "normalized" | "screen";

export class StudioRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private topology: StudioTopology;
  private positions: Vec3[] = [];
  private frame: Uint8Array = new Uint8Array();
  private dpr = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private radius = 4;
  private scale = 1;
  private centerX = 0;
  private centerY = 0;
  private worldMidX = 0;
  private worldMidY = 0;
  private overridePositions: Vec3[] | null = null;
  private overrideMode: OverrideMode = "world";
  private ledOpacity = 0.8;
  private backgroundActive = false;

  constructor(canvas: HTMLCanvasElement, topology: StudioTopology) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context is not available");
    }
    this.ctx = ctx;
    this.topology = topology;
    this.resize();
    this.rebuildTopology(topology);
  }

  updateTopology(topology: StudioTopology): void {
    this.topology = topology;
    this.rebuildTopology(topology);
  }

  updateFrame(buffer: Uint8Array): void {
    this.frame = buffer;
  }

  setOverridePositions(positions: Vec3[] | null, mode: OverrideMode = "world"): void {
    this.overridePositions = positions;
    this.overrideMode = positions ? mode : "world";
    this.recomputeProjection();
  }

  setLedOpacity(opacity: number): void {
    this.ledOpacity = Math.max(0, Math.min(1, opacity));
  }

  setBackgroundActive(active: boolean): void {
    this.backgroundActive = active;
  }

  render(): void {
    const currentCssWidth = Math.max(1, this.canvas.clientWidth);
    const currentCssHeight = Math.max(1, this.canvas.clientHeight);
    if (currentCssWidth !== this.cssWidth || currentCssHeight !== this.cssHeight) {
      this.resize();
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#060b12";
    ctx.fillRect(0, 0, width, height);

    const activePositions = this.overridePositions ?? this.positions;
    const count = Math.min(activePositions.length, Math.floor(this.frame.length / 3));
    const cssWidth = this.cssWidth;
    const cssHeight = this.cssHeight;
    for (let i = 0; i < count; i += 1) {
      const [x, y] = activePositions[i]!;
      const sx = this.overrideMode === "screen" ? x : this.overrideMode === "normalized" ? x * cssWidth : this.centerX + (x - this.worldMidX) * this.scale;
      const sy = this.overrideMode === "screen" ? y : this.overrideMode === "normalized" ? y * cssHeight : this.centerY - (y - this.worldMidY) * this.scale;

      const offset = i * 3;
      const boost = this.backgroundActive ? 1.35 : 1;
      const r = Math.max(0, Math.min(255, Math.round((this.frame[offset] ?? 0) * boost)));
      const g = Math.max(0, Math.min(255, Math.round((this.frame[offset + 1] ?? 0) * boost)));
      const b = Math.max(0, Math.min(255, Math.round((this.frame[offset + 2] ?? 0) * boost)));
      ctx.globalAlpha = this.ledOpacity;

      if (r === 0 && g === 0 && b === 0) {
        ctx.fillStyle = "#050505";
      } else {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      }

      ctx.beginPath();
      if (this.backgroundActive) {
        ctx.shadowColor = "rgba(255, 255, 255, 0.45)";
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
      ctx.arc(sx, sy, this.radius + (this.backgroundActive ? 0.8 : 0), 0, Math.PI * 2);
      ctx.fill();
      if (this.backgroundActive) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }

  resize(): void {
    const cssWidth = Math.max(1, this.canvas.clientWidth);
    const cssHeight = Math.max(1, this.canvas.clientHeight);
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    this.canvas.width = Math.floor(cssWidth * this.dpr);
    this.canvas.height = Math.floor(cssHeight * this.dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.centerX = cssWidth / 2;
    this.centerY = cssHeight / 2;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.recomputeProjection();
  }

  dispose(): void {
    // No external resources to dispose for 2D canvas.
  }

  private rebuildTopology(topology: StudioTopology): void {
    const physicalIndexMap = buildPhysicalIndexMap(topology.ledCount, topology.gaps);
    const withMap = { ...topology, physicalIndexMap };
    this.positions = buildLedPositions(withMap);
    this.recomputeProjection();
  }

  private recomputeProjection(): void {
    const activePositions = this.overridePositions ?? this.positions;
    if (this.overrideMode !== "world") {
      this.scale = 1;
      this.radius = 4;
      this.worldMidX = 0;
      this.worldMidY = 0;
      return;
    }
    if (activePositions.length === 0) {
      this.scale = 1;
      this.radius = 4;
      this.worldMidX = 0;
      this.worldMidY = 0;
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < activePositions.length; i += 1) {
      const [x, y] = activePositions[i]!;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const cssWidth = Math.max(1, this.canvas.clientWidth);
    const cssHeight = Math.max(1, this.canvas.clientHeight);
    const margin = 24;
    const spanX = Math.max(1, maxX - minX + 1);
    const spanY = Math.max(1, maxY - minY + 1);
    const scaleX = Math.max(1, (cssWidth - margin * 2) / spanX);
    const scaleY = Math.max(1, (cssHeight - margin * 2) / spanY);

    this.scale = Math.min(scaleX, scaleY);
    this.radius = Math.max(2, Math.min(12, this.scale * 0.32));
    this.worldMidX = (minX + maxX) / 2;
    this.worldMidY = (minY + maxY) / 2;
  }
}
