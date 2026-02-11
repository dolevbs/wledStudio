import type { WledJsonEnvelope } from "@/types/studio";

export interface WledEngine {
  init(ledCount: number): void;
  jsonCommand(payload: string): void;
  renderFrame(simulatedMillis: number): Uint8Array;
  getBufferSize(): number;
  getLastError(): string;
}

interface SoftwareState {
  ledCount: number;
  frame: Uint8Array;
  on: boolean;
  bri: number;
  fx: number;
  sx: number;
  ix: number;
  color: [number, number, number];
  lastError: string;
}

function clampByte(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hf = (h / 255) * 6;
  const sf = s / 255;
  const vf = v / 255;

  const i = Math.floor(hf);
  const f = hf - i;
  const p = vf * (1 - sf);
  const q = vf * (1 - sf * f);
  const t = vf * (1 - sf * (1 - f));

  const table: Array<[number, number, number]> = [
    [vf, t, p],
    [q, vf, p],
    [p, vf, t],
    [p, q, vf],
    [t, p, vf],
    [vf, p, q]
  ];

  const [r, g, b] = table[i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hashNoise(value: number): number {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x >>> 0;
}

export class SoftwareWledEngine implements WledEngine {
  private state: SoftwareState = {
    ledCount: 1,
    frame: new Uint8Array(3),
    on: true,
    bri: 128,
    fx: 8,
    sx: 128,
    ix: 128,
    color: [255, 170, 0],
    lastError: ""
  };

  init(ledCount: number): void {
    const safeCount = Math.max(1, Math.min(100000, Math.round(ledCount)));
    this.state.ledCount = safeCount;
    this.state.frame = new Uint8Array(safeCount * 3);
    this.state.lastError = "";
  }

  jsonCommand(payload: string): void {
    try {
      const parsed = JSON.parse(payload) as WledJsonEnvelope;
      this.state.lastError = "";

      if (typeof parsed.on === "boolean") {
        this.state.on = parsed.on;
      }
      if (typeof parsed.bri === "number") {
        this.state.bri = clampByte(parsed.bri, this.state.bri);
      }

      const seg = Array.isArray(parsed.seg) ? parsed.seg[0] : parsed.seg;
      if (seg) {
        if (typeof seg.fx === "number") this.state.fx = clampByte(seg.fx, this.state.fx);
        if (typeof seg.sx === "number") this.state.sx = clampByte(seg.sx, this.state.sx);
        if (typeof seg.ix === "number") this.state.ix = clampByte(seg.ix, this.state.ix);
        if (Array.isArray(seg.col?.[0]) && seg.col[0].length >= 3) {
          this.state.color = [clampByte(seg.col[0][0]), clampByte(seg.col[0][1]), clampByte(seg.col[0][2])];
        }
      }
    } catch (error) {
      this.state.lastError = `json parse failed: ${String(error)}`;
    }
  }

  renderFrame(simulatedMillis: number): Uint8Array {
    if (!this.state.on) {
      this.state.frame.fill(0);
      return this.state.frame;
    }

    switch (this.state.fx) {
      case 0:
        this.renderSolid();
        break;
      case 1:
        this.renderBlink(simulatedMillis);
        break;
      case 2:
        this.renderBreath(simulatedMillis);
        break;
      case 20:
        this.renderSparkle(simulatedMillis);
        break;
      case 28:
        this.renderChase(simulatedMillis);
        break;
      case 8:
      case 9:
      default:
        this.renderRainbow(simulatedMillis);
        break;
    }

    return this.state.frame;
  }

  getBufferSize(): number {
    return this.state.frame.length;
  }

  getLastError(): string {
    return this.state.lastError;
  }

  private renderSolid(): void {
    const [r, g, b] = this.applyBrightness(this.state.color);
    for (let i = 0; i < this.state.ledCount; i += 1) {
      const offset = i * 3;
      this.state.frame[offset] = r;
      this.state.frame[offset + 1] = g;
      this.state.frame[offset + 2] = b;
    }
  }

  private renderBlink(simulatedMillis: number): void {
    const interval = 120 + (255 - this.state.sx) * 6;
    const on = Math.floor(simulatedMillis / interval) % 2 === 0;
    const color: [number, number, number] = on ? this.applyBrightness(this.state.color) : [0, 0, 0];
    for (let i = 0; i < this.state.ledCount; i += 1) {
      const offset = i * 3;
      this.state.frame[offset] = color[0];
      this.state.frame[offset + 1] = color[1];
      this.state.frame[offset + 2] = color[2];
    }
  }

  private renderBreath(simulatedMillis: number): void {
    const phase = (simulatedMillis % 4096) / 4096;
    const breath = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;
    const prev = this.state.bri;
    this.state.bri = clampByte(prev * breath, prev);
    this.renderSolid();
    this.state.bri = prev;
  }

  private renderRainbow(simulatedMillis: number): void {
    const sat = 180 + Math.round(this.state.ix / 4);
    const base = Math.floor((simulatedMillis * (this.state.sx + 1)) / 24) & 255;

    for (let i = 0; i < this.state.ledCount; i += 1) {
      const hue = (base + Math.floor((i * 255) / Math.max(1, this.state.ledCount))) & 255;
      const rgb = hsvToRgb(hue, sat, 255);
      const [r, g, b] = this.applyBrightness(rgb);
      const offset = i * 3;
      this.state.frame[offset] = r;
      this.state.frame[offset + 1] = g;
      this.state.frame[offset + 2] = b;
    }
  }

  private renderSparkle(simulatedMillis: number): void {
    this.renderSolid();
    const sparkles = Math.max(1, Math.floor((this.state.ledCount * (this.state.ix + 16)) / 2048));
    for (let i = 0; i < sparkles; i += 1) {
      const noise = hashNoise(i * 0x9e3779b9 + simulatedMillis * 31);
      const idx = noise % this.state.ledCount;
      const offset = idx * 3;
      const [r, g, b] = this.applyBrightness([255, 255, 255]);
      this.state.frame[offset] = r;
      this.state.frame[offset + 1] = g;
      this.state.frame[offset + 2] = b;
    }
  }

  private renderChase(simulatedMillis: number): void {
    const stride = Math.max(2, 14 - Math.floor(this.state.sx / 20));
    const head = Math.floor(simulatedMillis / 40) % Math.max(1, this.state.ledCount);
    const lit = this.applyBrightness(this.state.color);

    for (let i = 0; i < this.state.ledCount; i += 1) {
      const on = (i + head) % stride === 0;
      const offset = i * 3;
      this.state.frame[offset] = on ? lit[0] : 0;
      this.state.frame[offset + 1] = on ? lit[1] : 0;
      this.state.frame[offset + 2] = on ? lit[2] : 0;
    }
  }

  private applyBrightness(color: [number, number, number]): [number, number, number] {
    const scale = this.state.bri / 255;
    return [
      Math.round(color[0] * scale),
      Math.round(color[1] * scale),
      Math.round(color[2] * scale)
    ];
  }
}
