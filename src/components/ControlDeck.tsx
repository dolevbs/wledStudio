"use client";

import { useEffect, useMemo, useState } from "react";

import { ACTIVE_EFFECT_OPTIONS, COLOR_SCHEME_OPTIONS, getEffectOption, type EffectControlKey } from "@/config/simulationOptions";
import type { StudioState } from "@/state/studioStore";
import type { WledJsonEnvelope } from "@/types/studio";

interface ControlDeckProps {
  command: WledJsonEnvelope;
  selectedSegmentIndex: number;
  segmentCount: number;
  setControl: StudioState["setControl"];
  setColorScheme: StudioState["setColorScheme"];
  setSegmentColor: StudioState["setSegmentColor"];
  setSegmentName: StudioState["setSegmentName"];
  setSegmentNumericField: StudioState["setSegmentNumericField"];
  setSegmentBooleanField: StudioState["setSegmentBooleanField"];
  setSelectedSegment: StudioState["setSelectedSegment"];
  addSegment: StudioState["addSegment"];
  removeSelectedSegment: StudioState["removeSelectedSegment"];
}

function getSegment(command: WledJsonEnvelope, index: number) {
  if (Array.isArray(command.seg)) {
    return command.seg[Math.max(0, Math.min(command.seg.length - 1, index))];
  }
  return command.seg;
}

function getSegments(command: WledJsonEnvelope) {
  if (Array.isArray(command.seg) && command.seg.length > 0) {
    return command.seg;
  }
  if (command.seg) {
    return [command.seg];
  }
  return [{}];
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

function segmentInt(segment: ReturnType<typeof getSegment>, key: "start" | "stop" | "ofs" | "startY" | "stopY" | "bri" | "grp" | "spc"): number {
  const value = segment?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    if (key === "grp") return 1;
    return 0;
  }
  return Math.max(0, Math.round(value));
}

export function ControlDeck({
  command,
  selectedSegmentIndex,
  segmentCount,
  setControl,
  setColorScheme,
  setSegmentColor,
  setSegmentName,
  setSegmentNumericField,
  setSegmentBooleanField,
  setSelectedSegment,
  addSegment,
  removeSelectedSegment
}: ControlDeckProps) {
  const segment = getSegment(command, selectedSegmentIndex) ?? { fx: 8, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0 };
  const segments = useMemo(() => getSegments(command), [command]);
  const [openSegmentCards, setOpenSegmentCards] = useState<number[]>([]);

  useEffect(() => {
    setOpenSegmentCards((prev) => prev.filter((index) => index >= 0 && index < segments.length));
  }, [segments.length]);

  const isSegmentOpen = (index: number) => openSegmentCards.includes(index);
  const toggleSegmentCard = (index: number) =>
    setOpenSegmentCards((prev) => (prev.includes(index) ? prev.filter((entry) => entry !== index) : [...prev, index]));

  const applyToSegment = (index: number, apply: () => void) => {
    setSelectedSegment(index);
    apply();
  };

  const selectedEffect = segment.fx ?? 8;
  const effectConfig = getEffectOption(selectedEffect);
  const controls = effectConfig?.controls ?? [
    { key: "sx" as const, label: "Speed", min: 0, max: 255, defaultValue: 128 },
    { key: "ix" as const, label: "Intensity", min: 0, max: 255, defaultValue: 128 }
  ];
  const listedEffects = ACTIVE_EFFECT_OPTIONS;

  return (
    <section className="panelShell cardSection controlDeck">
      <div className="controlColumn">
        <h3 className="columnTitle">Color</h3>
        <label className="fieldLabel">
          Brightness ({command.bri ?? 128})
          <input type="range" min={0} max={255} value={command.bri ?? 128} onChange={(event) => setControl("bri", Number(event.target.value))} />
        </label>

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

        <div className="swatchRow" aria-label="Quick palette colors">
          {COLOR_SCHEME_OPTIONS.map((scheme) => (
            <div key={scheme.id} className="swatchItem">
              <span className="swatchLabel">{scheme.label}</span>
              <button
                type="button"
                className="swatchButton"
                style={{
                  background: `linear-gradient(120deg, rgb(${scheme.col[0].join(" ")}), rgb(${scheme.col[1].join(" ")}), rgb(${scheme.col[2].join(" ")}))`
                }}
                onClick={() => setColorScheme(scheme)}
                aria-label={scheme.label}
              />
            </div>
          ))}
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
        <div className="segmentCardsList">
          <button type="button" className="pillButton" onClick={addSegment}>
            + Add segment
          </button>
          {segments.map((entry, index) => {
            const entryStart = segmentInt(entry, "start");
            const entryStop = segmentInt(entry, "stop");
            const entryLength = Math.max(0, entryStop - entryStart);
            const open = isSegmentOpen(index);
            const segmentLabel = entry.n?.trim() ? entry.n : `Segment ${index}`;

            return (
              <section key={index} className="segmentPanel" aria-label={`Segment ${index}`}>
                <div className="segmentHeaderBar">
                  <label className="segmentDotToggle" aria-label="Segment power">
                    <input
                      type="checkbox"
                      checked={entry.on ?? true}
                      onChange={(event) => applyToSegment(index, () => setSegmentBooleanField("on", event.target.checked))}
                    />
                    <span />
                  </label>
                  <button
                    type="button"
                    className="segmentHeaderButton"
                    onClick={() => {
                      setSelectedSegment(index);
                      toggleSegmentCard(index);
                    }}
                  >
                    {segmentLabel}
                  </button>
                  <button
                    type="button"
                    className="segmentIconButton"
                    onClick={() => toggleSegmentCard(index)}
                    aria-label={open ? "Collapse segment" : "Expand segment"}
                  >
                    {open ? "˄" : "˅"}
                  </button>
                  <button
                    type="button"
                    className="segmentIconButton"
                    onClick={() => {
                      setSelectedSegment(index);
                      removeSelectedSegment();
                    }}
                    disabled={segmentCount <= 1}
                    aria-disabled={segmentCount <= 1}
                    aria-label="Remove segment"
                  >
                    -
                  </button>
                </div>

                {open ? (
                  <>
                    <label className="fieldLabel">
                      Segment Name
                      <input
                        type="text"
                        maxLength={64}
                        value={entry.n ?? ""}
                        onChange={(event) => applyToSegment(index, () => setSegmentName(event.target.value))}
                        placeholder={`Segment ${index}`}
                      />
                    </label>

                    <div className="segmentLabelsRow">
                      <span>Start LED</span>
                      <span>Stop LED</span>
                      <span>Offset</span>
                      <span />
                    </div>
                    <div className="segmentInputsRow">
                      <input
                        type="number"
                        min={0}
                        value={entryStart}
                        onChange={(event) => applyToSegment(index, () => setSegmentNumericField("start", Number(event.target.value)))}
                      />
                      <input
                        type="number"
                        min={0}
                        value={entryStop}
                        onChange={(event) => applyToSegment(index, () => setSegmentNumericField("stop", Number(event.target.value)))}
                      />
                      <input
                        type="number"
                        min={0}
                        value={segmentInt(entry, "ofs")}
                        onChange={(event) => applyToSegment(index, () => setSegmentNumericField("ofs", Number(event.target.value)))}
                      />
                      <button type="button" className="segmentApplyButton" aria-label="Apply segment configuration">
                        ✓
                      </button>
                    </div>

                    <div className="segmentLabelsRow">
                      <span>Grouping</span>
                      <span>Spacing</span>
                      <span />
                      <span />
                    </div>
                    <div className="segmentInputsRow segmentInputsRowTwo">
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={segmentInt(entry, "grp")}
                        onChange={(event) => applyToSegment(index, () => setSegmentNumericField("grp", Number(event.target.value)))}
                      />
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={segmentInt(entry, "spc")}
                        onChange={(event) => applyToSegment(index, () => setSegmentNumericField("spc", Number(event.target.value)))}
                      />
                      <span className="segmentLedCount">{entryLength} LEDs</span>
                    </div>

                    <label className="segmentCheckRow">
                      <input
                        type="checkbox"
                        checked={Boolean(entry.rev)}
                        onChange={(event) => applyToSegment(index, () => setSegmentBooleanField("rev", event.target.checked))}
                      />
                      <span>Reverse direction</span>
                    </label>
                    <label className="segmentCheckRow">
                      <input
                        type="checkbox"
                        checked={Boolean(entry.mi)}
                        onChange={(event) => applyToSegment(index, () => setSegmentBooleanField("mi", event.target.checked))}
                      />
                      <span>Mirror effect</span>
                    </label>
                  </>
                ) : null}

                <div className="segmentPowerRow">
                  <span>Power</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={segmentInt(entry, "bri")}
                    onChange={(event) => applyToSegment(index, () => setSegmentNumericField("bri", Number(event.target.value)))}
                  />
                </div>
              </section>
            );
          })}
        </div>
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
