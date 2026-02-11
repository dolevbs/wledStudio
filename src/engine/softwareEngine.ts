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
  pal: number;
  c1: number;
  c2: number;
  colors: [[number, number, number], [number, number, number], [number, number, number]];
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

function blendColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped)
  ];
}

function scaleColor(color: [number, number, number], scale: number): [number, number, number] {
  return [
    clampByte(color[0] * scale, 0),
    clampByte(color[1] * scale, 0),
    clampByte(color[2] * scale, 0)
  ];
}

function hasVisibleColor(color: [number, number, number]): boolean {
  return color[0] > 0 || color[1] > 0 || color[2] > 0;
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
    pal: 0,
    c1: 0,
    c2: 0,
    colors: [
      [255, 170, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
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
        if (typeof seg.pal === "number") this.state.pal = clampByte(seg.pal, this.state.pal);
        if (typeof seg.c1 === "number") this.state.c1 = clampByte(seg.c1, this.state.c1);
        if (typeof seg.c2 === "number") this.state.c2 = clampByte(seg.c2, this.state.c2);
        if (Array.isArray(seg.col)) {
          const nextColors: [[number, number, number], [number, number, number], [number, number, number]] = [
            [...this.state.colors[0]],
            [...this.state.colors[1]],
            [...this.state.colors[2]]
          ];
          for (let i = 0; i < 3; i += 1) {
            const color = seg.col[i];
            if (Array.isArray(color) && color.length >= 3) {
              nextColors[i] = [clampByte(color[0]), clampByte(color[1]), clampByte(color[2])];
            }
          }
          this.state.colors = nextColors;
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
        this.renderRainbow(simulatedMillis, false);
        break;
      case 9:
        this.renderRainbow(simulatedMillis, true);
        break;
      default:
        this.renderRainbow(simulatedMillis, false);
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
    const [c0, c1] = this.state.colors;
    for (let i = 0; i < this.state.ledCount; i += 1) {
      const blend = this.state.c1 > 0 ? (i / Math.max(1, this.state.ledCount - 1)) * (this.state.c1 / 255) : 0;
      const base = blend > 0 ? blendColor(c0, c1, blend) : c0;
      const [r, g, b] = this.applyBrightness(base);
      const offset = i * 3;
      this.state.frame[offset] = r;
      this.state.frame[offset + 1] = g;
      this.state.frame[offset + 2] = b;
    }
  }

  private renderBlink(simulatedMillis: number): void {
    const interval = 120 + (255 - this.state.sx) * 6;
    const on = Math.floor(simulatedMillis / interval) % 2 === 0;
    const primary = this.applyBrightness(this.state.colors[0]);
    const offScale = this.state.c1 > 0 ? this.state.c1 / 255 : 0.2;
    const offBase: [number, number, number] = hasVisibleColor(this.state.colors[1])
      ? this.applyBrightness(scaleColor(this.state.colors[1], offScale))
      : [0, 0, 0];
    const color: [number, number, number] = on ? primary : offBase;
    for (let i = 0; i < this.state.ledCount; i += 1) {
      const offset = i * 3;
      this.state.frame[offset] = color[0];
      this.state.frame[offset + 1] = color[1];
      this.state.frame[offset + 2] = color[2];
    }
  }

  private renderBreath(simulatedMillis: number): void {
    const period = Math.max(512, 4096 + (128 - this.state.sx) * 24);
    const phase = (simulatedMillis % period) / period;
    const depth = this.state.c1 > 0 ? this.state.c1 / 255 : 1;
    const breath = 1 - depth + depth * (0.5 + Math.sin(phase * Math.PI * 2) * 0.5);
    const prev = this.state.bri;
    this.state.bri = clampByte(prev * breath, prev);
    this.renderSolid();
    this.state.bri = prev;
  }

  private renderRainbow(simulatedMillis: number, cycleMode: boolean): void {
    const sat = 180 + Math.round(this.state.ix / 4);
    const base = Math.floor((simulatedMillis * (this.state.sx + 1)) / 24) & 255;
    const spreadScale = cycleMode ? 1 + this.state.c1 / 64 : 1;

    if (this.state.pal === 0) {
      for (let i = 0; i < this.state.ledCount; i += 1) {
        const hue = (base + Math.floor((i * 255 * spreadScale) / Math.max(1, this.state.ledCount))) & 255;
        const rgb = hsvToRgb(hue, sat, 255);
        const [r, g, b] = this.applyBrightness(rgb);
        const offset = i * 3;
        this.state.frame[offset] = r;
        this.state.frame[offset + 1] = g;
        this.state.frame[offset + 2] = b;
      }
      return;
    }

    for (let i = 0; i < this.state.ledCount; i += 1) {
      const hue = (base + Math.floor((i * 255 * spreadScale) / Math.max(1, this.state.ledCount))) & 255;
      const rgb = this.paletteColor(hue, sat);
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
    const white: [number, number, number] = [255, 255, 255];
    const schemeSpark = hasVisibleColor(this.state.colors[1]) ? this.state.colors[1] : white;
    const speedFactor = Math.max(1, 31 + Math.floor((this.state.sx - 128) / 4));
    const secondaryMix = this.state.c1 / 255;
    for (let i = 0; i < sparkles; i += 1) {
      const noise = hashNoise(i * 0x9e3779b9 + simulatedMillis * speedFactor);
      const idx = noise % this.state.ledCount;
      const offset = idx * 3;
      const sparkleBase = this.state.pal > 0 ? this.paletteColor((noise + simulatedMillis) & 255, 255) : schemeSpark;
      const sparkleColor = secondaryMix > 0 ? blendColor(sparkleBase, this.state.colors[2], secondaryMix) : sparkleBase;
      const [r, g, b] = this.applyBrightness(sparkleColor);
      this.state.frame[offset] = r;
      this.state.frame[offset + 1] = g;
      this.state.frame[offset + 2] = b;
    }
  }

  private renderChase(simulatedMillis: number): void {
    const stride = this.state.c1 > 0 ? Math.max(2, 2 + Math.floor(this.state.c1 / 18)) : Math.max(2, 14 - Math.floor(this.state.sx / 20));
    const head = Math.floor(simulatedMillis / 40) % Math.max(1, this.state.ledCount);
    const lit = this.applyBrightness(this.state.colors[0]);
    const bg: [number, number, number] = hasVisibleColor(this.state.colors[2])
      ? this.applyBrightness(scaleColor(this.state.colors[2], 0.45))
      : [0, 0, 0];
    const tail = Math.floor(this.state.c2 / 52);

    for (let i = 0; i < this.state.ledCount; i += 1) {
      const offset = i * 3;
      const phase = (i + head) % stride;
      if (phase === 0) {
        this.state.frame[offset] = lit[0];
        this.state.frame[offset + 1] = lit[1];
        this.state.frame[offset + 2] = lit[2];
      } else if (tail > 0 && phase <= tail) {
        const fade = 1 - phase / (tail + 1);
        const trail: [number, number, number] = [
          Math.round(lit[0] * fade + bg[0] * (1 - fade)),
          Math.round(lit[1] * fade + bg[1] * (1 - fade)),
          Math.round(lit[2] * fade + bg[2] * (1 - fade))
        ];
        this.state.frame[offset] = trail[0];
        this.state.frame[offset + 1] = trail[1];
        this.state.frame[offset + 2] = trail[2];
      } else {
        this.state.frame[offset] = bg[0];
        this.state.frame[offset + 1] = bg[1];
        this.state.frame[offset + 2] = bg[2];
      }
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

  private paletteColor(position: number, sat: number): [number, number, number] {
    const [c0, c1, c2] = this.state.colors;
    const t = (position & 255) / 255;
    switch (this.state.pal % 5) {
      case 1:
        return t < 0.5 ? blendColor(c0, c1, t * 2) : blendColor(c1, c2, (t - 0.5) * 2);
      case 2: {
        const wave = (Math.sin(t * Math.PI * 2) + 1) * 0.5;
        return blendColor(c0, c1, wave);
      }
      case 3: {
        const slot = Math.floor(t * 3) % 3;
        return slot === 0 ? c0 : slot === 1 ? c1 : c2;
      }
      case 4:
        return blendColor(c2, c0, t);
      default:
        return blendColor(c0, hsvToRgb(position & 255, sat, 255), 0.35);
    }
  }
}
