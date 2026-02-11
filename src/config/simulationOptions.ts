export interface EffectOption {
  id: number;
  label: string;
}

export interface ColorSchemeOption {
  id: string;
  label: string;
  pal: number;
  col: [[number, number, number], [number, number, number], [number, number, number]];
}

export const EFFECT_OPTIONS: EffectOption[] = [
  { id: 0, label: "Solid" },
  { id: 1, label: "Blink" },
  { id: 2, label: "Breath" },
  { id: 8, label: "Rainbow" },
  { id: 9, label: "Rainbow Cycle" },
  { id: 20, label: "Sparkle" },
  { id: 28, label: "Chase" }
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
