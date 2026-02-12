"use client";

import { ACTIVE_EFFECT_OPTIONS, COLOR_SCHEME_OPTIONS, getEffectOption, type EffectControlKey } from "@/config/simulationOptions";
import type { StudioState } from "@/state/studioStore";

interface ControlPanelProps {
  state: Pick<
    StudioState,
    | "topology"
    | "simulation"
    | "command"
    | "setMode"
    | "setDimensions"
    | "setLedCount"
    | "setSerpentine"
    | "setGaps"
    | "setControl"
    | "setColorScheme"
    | "setSegmentColor"
    | "setRunning"
  >;
  onReset: () => void;
}

function getSegment(command: StudioState["command"]) {
  return Array.isArray(command.seg) ? command.seg[0] : command.seg;
}

function colorsMatch(a: number[] | undefined, b: number[]): boolean {
  if (!Array.isArray(a) || a.length < 3) {
    return false;
  }
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function getSelectedSchemeId(segment: ReturnType<typeof getSegment>): string {
  for (const scheme of COLOR_SCHEME_OPTIONS) {
    if (
      (segment?.pal ?? 0) === scheme.pal &&
      colorsMatch(segment?.col?.[0], scheme.col[0]) &&
      colorsMatch(segment?.col?.[1], scheme.col[1]) &&
      colorsMatch(segment?.col?.[2], scheme.col[2])
    ) {
      return scheme.id;
    }
  }
  return "custom";
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

export function ControlPanel({ state, onReset }: ControlPanelProps) {
  const segment = getSegment(state.command) ?? { fx: 8, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0 };
  const selectedEffect = segment.fx ?? 8;
  const effectConfig = getEffectOption(selectedEffect);
  const hasKnownEffect = Boolean(effectConfig);
  const selectedSchemeId = getSelectedSchemeId(segment);
  const controls = effectConfig?.controls ?? [
    { key: "sx", label: "Speed", min: 0, max: 255, defaultValue: 128 },
    { key: "ix", label: "Intensity", min: 0, max: 255, defaultValue: 128 }
  ];

  return (
    <section className="panel">
      <h2>Simulation Controls</h2>
      <div className="grid two">
        <label>
          Mode
          <select value={state.topology.mode} onChange={(event) => state.setMode(event.target.value as "strip" | "matrix")}>
            <option value="matrix">Matrix</option>
            <option value="strip">Strip</option>
          </select>
        </label>

        {state.topology.mode === "matrix" ? (
          <>
            <label>
              Width
              <input
                type="number"
                min={1}
                value={state.topology.width}
                onChange={(event) => state.setDimensions(Number(event.target.value), state.topology.height)}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min={1}
                value={state.topology.height}
                onChange={(event) => state.setDimensions(state.topology.width, Number(event.target.value))}
              />
            </label>
          </>
        ) : (
          <label>
            LEDs
            <input type="number" min={1} value={state.topology.ledCount} onChange={(event) => state.setLedCount(Number(event.target.value))} />
          </label>
        )}

        <label>
          Serpentine
          <input
            type="checkbox"
            checked={state.topology.serpentine}
            onChange={(event) => state.setSerpentine(event.target.checked)}
            disabled={state.topology.mode !== "matrix"}
          />
        </label>
      </div>

      <label>
        Gaps JSON
        <input
          type="text"
          placeholder='[{"start":300,"length":20}]'
          defaultValue={JSON.stringify(state.topology.gaps)}
          onBlur={(event) => state.setGaps(event.target.value)}
        />
      </label>

      <div className="grid two">
        <label>
          Power
          <input
            type="checkbox"
            checked={Boolean(state.command.on)}
            onChange={(event) => state.setControl("on", event.target.checked)}
          />
        </label>

        <label>
          Brightness ({state.command.bri ?? 128})
          <input
            type="range"
            min={0}
            max={255}
            value={state.command.bri ?? 128}
            onChange={(event) => state.setControl("bri", Number(event.target.value))}
          />
        </label>

        <label>
          Effect
          <select value={selectedEffect} onChange={(event) => state.setControl("fx", Number(event.target.value))}>
            {!hasKnownEffect ? <option value={selectedEffect}>Custom ({selectedEffect})</option> : null}
            {ACTIVE_EFFECT_OPTIONS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label} ({effect.id})
              </option>
            ))}
          </select>
        </label>

        <label>
          Color Scheme
          <select
            value={selectedSchemeId}
            onChange={(event) => {
              const scheme = COLOR_SCHEME_OPTIONS.find((entry) => entry.id === event.target.value) ?? COLOR_SCHEME_OPTIONS[0];
              if (scheme) {
                state.setColorScheme(scheme);
              }
            }}
          >
            {selectedSchemeId === "custom" ? <option value="custom">Custom</option> : null}
            {COLOR_SCHEME_OPTIONS.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.label}
              </option>
            ))}
          </select>
        </label>

        {controls.map((control) => (
          <label key={control.key}>
            {control.label} ({controlValue(segment, control.key)})
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step ?? 1}
              value={controlValue(segment, control.key)}
              onChange={(event) => state.setControl(control.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="grid two">
        <label>
          Primary Color
          <input type="color" value={rgbToHex(segment?.col?.[0])} onChange={(event) => state.setSegmentColor(0, hexToRgb(event.target.value))} />
        </label>
        <label>
          Secondary Color
          <input type="color" value={rgbToHex(segment?.col?.[1])} onChange={(event) => state.setSegmentColor(1, hexToRgb(event.target.value))} />
        </label>
        <label>
          Tertiary Color
          <input type="color" value={rgbToHex(segment?.col?.[2])} onChange={(event) => state.setSegmentColor(2, hexToRgb(event.target.value))} />
        </label>
      </div>

      <div className="actions">
        <button type="button" onClick={() => state.setRunning(!state.simulation.running)}>
          {state.simulation.running ? "Pause" : "Start"}
        </button>
        <button type="button" onClick={onReset}>
          Reset Clock
        </button>
      </div>
    </section>
  );
}
