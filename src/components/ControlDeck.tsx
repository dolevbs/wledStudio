"use client";

import { ACTIVE_EFFECT_OPTIONS, COLOR_SCHEME_OPTIONS, getEffectOption, type EffectControlKey } from "@/config/simulationOptions";
import type { StudioState } from "@/state/studioStore";
import type { WledJsonEnvelope } from "@/types/studio";

interface ControlDeckProps {
  command: WledJsonEnvelope;
  setControl: StudioState["setControl"];
  setColorScheme: StudioState["setColorScheme"];
  setSegmentColor: StudioState["setSegmentColor"];
}

function getSegment(command: WledJsonEnvelope) {
  return Array.isArray(command.seg) ? command.seg[0] : command.seg;
}

function toHexChannel(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function rgbToHex(color: number[] | undefined): string {
  if (!Array.isArray(color) || color.length < 3) {
    return "#000000";
  }
  return `#${toHexChannel(color[0])}${toHexChannel(color[1])}${toHexChannel(color[2])}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return [0, 0, 0];
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0];
}

function controlValue(segment: ReturnType<typeof getSegment>, key: EffectControlKey): number {
  if (key === "sx") return segment?.sx ?? 128;
  if (key === "ix") return segment?.ix ?? 128;
  if (key === "pal") return segment?.pal ?? 0;
  if (key === "c1") return segment?.c1 ?? 0;
  return segment?.c2 ?? 0;
}

export function ControlDeck({ command, setControl, setColorScheme, setSegmentColor }: ControlDeckProps) {
  const segment = getSegment(command) ?? { fx: 8, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0 };
  const selectedEffect = segment.fx ?? 8;
  const effectConfig = getEffectOption(selectedEffect);
  const controls = effectConfig?.controls ?? [
    { key: "sx" as const, label: "Speed", min: 0, max: 255, defaultValue: 128 },
    { key: "ix" as const, label: "Intensity", min: 0, max: 255, defaultValue: 128 }
  ];
  const listedEffects = ACTIVE_EFFECT_OPTIONS.slice(0, 20);

  return (
    <section className="panelShell cardSection controlDeck">
      <div className="controlColumn">
        <h3 className="columnTitle">Color</h3>
        <label className="colorWheelField">
          <span className="srOnly">Primary color</span>
          <input type="color" value={rgbToHex(segment?.col?.[0])} onChange={(event) => setSegmentColor(0, hexToRgb(event.target.value))} />
        </label>

        <label className="fieldLabel">
          Brightness ({command.bri ?? 128})
          <input type="range" min={0} max={255} value={command.bri ?? 128} onChange={(event) => setControl("bri", Number(event.target.value))} />
        </label>

        <div className="swatchRow" aria-label="Quick palette colors">
          {COLOR_SCHEME_OPTIONS.map((scheme) => (
            <button
              key={scheme.id}
              type="button"
              className="swatchButton"
              style={{
                background: `linear-gradient(120deg, rgb(${scheme.col[0].join(" ")}), rgb(${scheme.col[1].join(" ")}), rgb(${scheme.col[2].join(" ")}))`
              }}
              onClick={() => setColorScheme(scheme)}
            >
              <span className="srOnly">{scheme.label}</span>
            </button>
          ))}
        </div>

        <div className="segmentColorInputs">
          <label className="fieldLabel">
            Color 1
            <input type="color" value={rgbToHex(segment?.col?.[0])} onChange={(event) => setSegmentColor(0, hexToRgb(event.target.value))} />
          </label>
          <label className="fieldLabel">
            Color 2
            <input type="color" value={rgbToHex(segment?.col?.[1])} onChange={(event) => setSegmentColor(1, hexToRgb(event.target.value))} />
          </label>
          <label className="fieldLabel">
            Color 3
            <input type="color" value={rgbToHex(segment?.col?.[2])} onChange={(event) => setSegmentColor(2, hexToRgb(event.target.value))} />
          </label>
        </div>
      </div>

      <div className="controlColumn">
        <h3 className="columnTitle">Effects</h3>
        {controls.map((control) => (
          <label key={control.key} className="fieldLabel">
            {control.label} ({controlValue(segment, control.key)})
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step ?? 1}
              value={controlValue(segment, control.key)}
              onChange={(event) => setControl(control.key, Number(event.target.value))}
            />
          </label>
        ))}
        <div className="effectList" role="listbox" aria-label="Effects">
          {listedEffects.map((effect) => (
            <button
              key={effect.id}
              type="button"
              className={effect.id === selectedEffect ? "pillButton active" : "pillButton"}
              onClick={() => setControl("fx", effect.id)}
            >
              {effect.label}
            </button>
          ))}
        </div>
      </div>

      <div className="controlColumn">
        <h3 className="columnTitle">Segments</h3>
        <label className="fieldLabel">
          Active segment
          <select value="0" onChange={() => undefined}>
            <option value="0">Segment 0</option>
          </select>
        </label>
        <button type="button" className="pillButton isDisabled" disabled aria-disabled="true">
          + Add segment
        </button>
        <label className="fieldLabel">
          Transition
          <div className="transitionField">
            <input type="number" value="0.7" disabled aria-disabled="true" className="isDisabled" readOnly />
            <span>s</span>
          </div>
        </label>
      </div>

      <div className="controlColumn">
        <h3 className="columnTitle">Presets & Playlist</h3>
        <button type="button" className="pillButton isDisabled" disabled aria-disabled="true">
          + Create preset
        </button>
        <button type="button" className="pillButton isDisabled" disabled aria-disabled="true">
          Export preset
        </button>
        <button type="button" className="pillButton isDisabled" disabled aria-disabled="true">
          Create playlist
        </button>
        <button type="button" className="pillButton isDisabled" disabled aria-disabled="true">
          Export playlist
        </button>
        <button type="button" className="pillButton isDisabled" disabled aria-disabled="true">
          PC Mode
        </button>
      </div>
    </section>
  );
}
