import { WLED_EFFECT_CATALOG } from "@/config/wledEffectCatalog";

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

const DEFAULT_CONTROL_LABELS: Record<EffectControlKey, string> = {
  sx: "Speed",
  ix: "Intensity",
  pal: "Palette",
  c1: "Custom 1",
  c2: "Custom 2"
};

const KEY_ORDER: EffectControlKey[] = ["sx", "ix", "c1", "c2"];

function sanitizeControlLabel(label: string, key: EffectControlKey): string {
  const cleaned = label.replace(/!/g, "").trim();
  if (!cleaned) {
    return DEFAULT_CONTROL_LABELS[key];
  }
  return cleaned;
}

function deriveControlsFromMetadata(metadata: string): EffectControl[] {
  if (!metadata.includes("@")) {
    return [];
  }

  const rawParams = metadata.split("@")[1]?.split(";")[0] ?? "";
  const paramTokens = rawParams.split(",").map((token) => token.trim());
  const controls: EffectControl[] = [];

  for (let i = 0; i < KEY_ORDER.length; i += 1) {
    const token = paramTokens[i] ?? "";
    if (!token) {
      continue;
    }
    const key = KEY_ORDER[i];
    controls.push({
      key,
      label: sanitizeControlLabel(token, key),
      min: 0,
      max: 255,
      defaultValue: key === "sx" || key === "ix" ? 128 : 0
    });
  }

  if (controls.length === 0) {
    return [];
  }
  return controls;
}

const CONTROL_OVERRIDES: Record<number, EffectControl[]> = {
  0: [{ key: "c1", label: "Blend", min: 0, max: 255, defaultValue: 0 }],
  1: [
    { key: "sx", label: "Rate", min: 0, max: 255, defaultValue: 128 },
    { key: "c1", label: "Off Glow", min: 0, max: 255, defaultValue: 0 }
  ],
  2: [
    { key: "sx", label: "Rate", min: 0, max: 255, defaultValue: 128 },
    { key: "c1", label: "Depth", min: 0, max: 255, defaultValue: 0 }
  ],
  8: [
    { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
    { key: "ix", label: "Saturation", min: 0, max: 255, defaultValue: 128 },
    { key: "pal", label: "Palette Mode", min: 0, max: 255, step: 1, defaultValue: 0 }
  ],
  9: [
    { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
    { key: "ix", label: "Saturation", min: 0, max: 255, defaultValue: 128 },
    { key: "c1", label: "Cycle Spread", min: 0, max: 255, defaultValue: 0 },
    { key: "pal", label: "Palette Mode", min: 0, max: 255, step: 1, defaultValue: 0 }
  ],
  20: [
    { key: "sx", label: "Twinkle Rate", min: 0, max: 255, defaultValue: 128 },
    { key: "ix", label: "Density", min: 0, max: 255, defaultValue: 128 },
    { key: "c1", label: "Secondary Mix", min: 0, max: 255, defaultValue: 0 },
    { key: "pal", label: "Palette Mode", min: 0, max: 255, step: 1, defaultValue: 0 }
  ],
  28: [
    { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
    { key: "c1", label: "Spacing", min: 0, max: 255, defaultValue: 0 },
    { key: "c2", label: "Tail", min: 0, max: 255, defaultValue: 0 }
  ]
};

export const EFFECT_OPTIONS: EffectOption[] = WLED_EFFECT_CATALOG.map((effect) => {
  const derived = deriveControlsFromMetadata(effect.metadata);
  const controls = CONTROL_OVERRIDES[effect.id] ?? derived;
  return {
    id: effect.id,
    label: effect.label,
    controls
  };
});

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
