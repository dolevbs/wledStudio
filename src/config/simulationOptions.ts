export interface EffectOption {
  id: number;
  label: string;
  controls: EffectControl[];
}

export type EffectControlKey = "sx" | "ix" | "pal" | "c1" | "c2";

export interface EffectControl {
  key: EffectControlKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
}

export interface ColorSchemeOption {
  id: string;
  label: string;
  pal: number;
  col: [[number, number, number], [number, number, number], [number, number, number]];
}

export const EFFECT_OPTIONS: EffectOption[] = [
  {
    id: 0,
    label: "Solid",
    controls: [
      { key: "c1", label: "Blend", min: 0, max: 255, defaultValue: 0 }
    ]
  },
  {
    id: 1,
    label: "Blink",
    controls: [
      { key: "sx", label: "Rate", min: 0, max: 255, defaultValue: 128 },
      { key: "c1", label: "Off Glow", min: 0, max: 255, defaultValue: 0 }
    ]
  },
  {
    id: 2,
    label: "Breath",
    controls: [
      { key: "sx", label: "Rate", min: 0, max: 255, defaultValue: 128 },
      { key: "c1", label: "Depth", min: 0, max: 255, defaultValue: 0 }
    ]
  },
  {
    id: 8,
    label: "Rainbow",
    controls: [
      { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
      { key: "ix", label: "Saturation", min: 0, max: 255, defaultValue: 128 },
      { key: "pal", label: "Palette Mode", min: 0, max: 4, step: 1, defaultValue: 0 }
    ]
  },
  {
    id: 9,
    label: "Rainbow Cycle",
    controls: [
      { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
      { key: "ix", label: "Saturation", min: 0, max: 255, defaultValue: 128 },
      { key: "c1", label: "Cycle Spread", min: 0, max: 255, defaultValue: 0 },
      { key: "pal", label: "Palette Mode", min: 0, max: 4, step: 1, defaultValue: 0 }
    ]
  },
  {
    id: 20,
    label: "Sparkle",
    controls: [
      { key: "sx", label: "Twinkle Rate", min: 0, max: 255, defaultValue: 128 },
      { key: "ix", label: "Density", min: 0, max: 255, defaultValue: 128 },
      { key: "c1", label: "Secondary Mix", min: 0, max: 255, defaultValue: 0 },
      { key: "pal", label: "Palette Mode", min: 0, max: 4, step: 1, defaultValue: 0 }
    ]
  },
  {
    id: 28,
    label: "Chase",
    controls: [
      { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
      { key: "c1", label: "Spacing", min: 0, max: 255, defaultValue: 0 },
      { key: "c2", label: "Tail", min: 0, max: 255, defaultValue: 0 }
    ]
  }
];

export const COLOR_SCHEME_OPTIONS: ColorSchemeOption[] = [
  {
    id: "amber",
    label: "Amber Glow",
    pal: 0,
    col: [
      [255, 170, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  },
  {
    id: "sunset",
    label: "Sunset",
    pal: 1,
    col: [
      [255, 110, 60],
      [255, 20, 120],
      [80, 0, 160]
    ]
  },
  {
    id: "ocean",
    label: "Ocean",
    pal: 2,
    col: [
      [0, 170, 255],
      [0, 70, 170],
      [120, 255, 220]
    ]
  },
  {
    id: "forest",
    label: "Forest",
    pal: 3,
    col: [
      [60, 170, 80],
      [200, 255, 90],
      [10, 70, 30]
    ]
  },
  {
    id: "icefire",
    label: "Ice + Fire",
    pal: 4,
    col: [
      [40, 130, 255],
      [255, 70, 30],
      [255, 255, 255]
    ]
  }
];

export function findColorSchemeById(id: string): ColorSchemeOption | undefined {
  return COLOR_SCHEME_OPTIONS.find((scheme) => scheme.id === id);
}

export function getEffectOption(effectId: number): EffectOption | undefined {
  return EFFECT_OPTIONS.find((effect) => effect.id === effectId);
}
