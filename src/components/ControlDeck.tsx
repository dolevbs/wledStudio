"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { ACTIVE_EFFECT_OPTIONS, COLOR_SCHEME_OPTIONS, getEffectOption, type EffectControlKey } from "@/config/simulationOptions";
import type { StudioState } from "@/state/studioStore";
import type { VisualizationProject, WledJsonEnvelope, WledPlaylistPayload, WledPresetEntry } from "@/types/studio";

interface ControlDeckProps {
  command: WledJsonEnvelope;
  selectedSegmentIndex: number;
  segmentCount: number;
  presets: StudioState["presets"];
  visualization: VisualizationProject;
  setControl: StudioState["setControl"];
  setControlAt: StudioState["setControlAt"];
  setColorScheme: StudioState["setColorScheme"];
  setSegmentColor: StudioState["setSegmentColor"];
  setSegmentName: StudioState["setSegmentName"];
  setSegmentNumericField: StudioState["setSegmentNumericField"];
  setSegmentBooleanField: StudioState["setSegmentBooleanField"];
  setSelectedSegment: StudioState["setSelectedSegment"];
  addSegment: StudioState["addSegment"];
  removeSegmentAt: StudioState["removeSegmentAt"];
  savePreset: StudioState["savePreset"];
  deletePreset: StudioState["deletePreset"];
  applyPreset: StudioState["applyPreset"];
  setPresetQuickLabel: StudioState["setPresetQuickLabel"];
  setPlaylistForPreset: StudioState["setPlaylistForPreset"];
  clearPlaylistForPreset: StudioState["clearPlaylistForPreset"];
  startPlaylist: StudioState["startPlaylist"];
  stopPlaylist: StudioState["stopPlaylist"];
  advancePlaylist: StudioState["advancePlaylist"];
  setVisualizationEnabled: StudioState["setVisualizationEnabled"];
  setVisualizationBackground: StudioState["setVisualizationBackground"];
  startVisualizationStrip: StudioState["startVisualizationStrip"];
  addVisualizationPoint: StudioState["addVisualizationPoint"];
  finishVisualizationStrip: StudioState["finishVisualizationStrip"];
  cancelVisualizationStrip: StudioState["cancelVisualizationStrip"];
  removeVisualizationStrip: StudioState["removeVisualizationStrip"];
  mapVisualizationStrip: StudioState["mapVisualizationStrip"];
  updateVisualizationStripLedCount: StudioState["updateVisualizationStripLedCount"];
  importVisualizationProject: StudioState["importVisualizationProject"];
  exportVisualizationProject: StudioState["exportVisualizationProject"];
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
  if (command.seg && !Array.isArray(command.seg)) {
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
    if (key === "bri") return 125;
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function segmentStopInclusive(segment: ReturnType<typeof getSegment>): number {
  const stopExclusive = segmentInt(segment, "stop");
  return Math.max(0, stopExclusive - 1);
}

function csvToNumberArray(input: string): number[] {
  return input
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));
}

function numberArrayToCsv(values: number[] | number | undefined, fallback: string): string {
  if (Array.isArray(values)) return values.join(",");
  if (typeof values === "number" && Number.isFinite(values)) return String(values);
  return fallback;
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildPlaylistForm(entry: WledPresetEntry | undefined): { ps: string; dur: string; transition: string; repeat: string; end: string; r: boolean } {
  const playlist = entry?.playlist;
  return {
    ps: playlist?.ps?.join(",") ?? "",
    dur: numberArrayToCsv(playlist?.dur, "100"),
    transition: numberArrayToCsv(playlist?.transition, "0"),
    repeat: String(playlist?.repeat ?? 0),
    end: String(playlist?.end ?? 0),
    r: Boolean(playlist?.r)
  };
}

function toPlaylistPayload(form: { ps: string; dur: string; transition: string; repeat: string; end: string; r: boolean }): WledPlaylistPayload {
  const ps = csvToNumberArray(form.ps);
  const durValues = csvToNumberArray(form.dur);
  const trValues = csvToNumberArray(form.transition);

  return {
    ps,
    dur: durValues.length <= 1 ? (durValues[0] ?? 100) : durValues,
    transition: trValues.length <= 1 ? (trValues[0] ?? 0) : trValues,
    repeat: Number.isFinite(Number(form.repeat)) ? Math.round(Number(form.repeat)) : 0,
    end: Number.isFinite(Number(form.end)) ? Math.round(Number(form.end)) : 0,
    r: form.r
  };
}

export function ControlDeck({
  command,
  selectedSegmentIndex,
  segmentCount,
  presets,
  visualization,
  setControl,
  setControlAt,
  setColorScheme,
  setSegmentColor,
  setSegmentName,
  setSegmentNumericField,
  setSegmentBooleanField,
  setSelectedSegment,
  addSegment,
  removeSegmentAt,
  savePreset,
  deletePreset,
  applyPreset,
  setPresetQuickLabel,
  setPlaylistForPreset,
  clearPlaylistForPreset,
  startPlaylist,
  stopPlaylist,
  advancePlaylist,
  setVisualizationEnabled,
  setVisualizationBackground,
  startVisualizationStrip,
  addVisualizationPoint,
  finishVisualizationStrip,
  cancelVisualizationStrip,
  removeVisualizationStrip,
  mapVisualizationStrip,
  updateVisualizationStripLedCount,
  importVisualizationProject,
  exportVisualizationProject
}: ControlDeckProps) {
  const segment = getSegment(command, selectedSegmentIndex) ?? { fx: 8, sx: 128, ix: 128, pal: 0, c1: 0, c2: 0 };
  const segments = useMemo(() => getSegments(command), [command]);
  const presetIds = useMemo(
    () => Object.keys(presets.entries).map((id) => Number(id)).filter((id) => Number.isInteger(id)).sort((a, b) => a - b),
    [presets.entries]
  );

  const [openSegmentCards, setOpenSegmentCards] = useState<number[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number>(presetIds[0] ?? 1);
  const [presetName, setPresetName] = useState<string>(presets.entries[String(selectedPresetId)]?.n ?? "");
  const [quickLabel, setQuickLabel] = useState<string>(presets.entries[String(selectedPresetId)]?.ql ?? "");
  const [playlistForm, setPlaylistForm] = useState(() => buildPlaylistForm(presets.entries[String(selectedPresetId)]));

  useEffect(() => {
    setOpenSegmentCards((prev) => prev.filter((index) => index >= 0 && index < segments.length));
  }, [segments.length]);

  useEffect(() => {
    const fallback = presetIds[0] ?? 1;
    if (!presetIds.includes(selectedPresetId)) setSelectedPresetId(fallback);
  }, [presetIds, selectedPresetId]);

  useEffect(() => {
    const entry = presets.entries[String(selectedPresetId)];
    setPresetName(entry?.n ?? "");
    setQuickLabel(entry?.ql ?? "");
    setPlaylistForm(buildPlaylistForm(entry));
  }, [selectedPresetId, presets.entries]);

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

  const visualSvgLines = useMemo(() => {
    const committed = visualization.strips.map((strip) => ({
      id: strip.id,
      points: strip.points
    }));
    const draft = visualization.draftPoints.length >= 2 ? [{ id: "draft", points: visualization.draftPoints }] : [];
    return committed.concat(draft);
  }, [visualization]);

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
              onChange={(event) => setControlAt(selectedSegmentIndex, control.key, Number(event.target.value))}
            />
          </label>
        ))}
        <div className="effectList" role="listbox" aria-label="Effects">
          {listedEffects.map((effect) => (
            <button
              key={effect.id}
              type="button"
              className={effect.id === selectedEffect ? "pillButton active" : "pillButton"}
              onClick={() => setControlAt(selectedSegmentIndex, "fx", effect.id)}
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
            const entryStopInclusive = segmentStopInclusive(entry);
            const entryLength = Math.max(0, entryStopInclusive - entryStart + 1);
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
                    onClick={() => {
                      setSelectedSegment(index);
                      toggleSegmentCard(index);
                    }}
                    aria-label={open ? "Collapse segment" : "Expand segment"}
                  >
                    {open ? "˄" : "˅"}
                  </button>
                  <button
                    type="button"
                    className="segmentIconButton"
                    onClick={() => removeSegmentAt(index)}
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
                        value={entryStopInclusive}
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

        <label className="fieldLabel">
          Preset
          <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(Number(event.target.value))}>
            {presetIds.map((id) => (
              <option key={id} value={id}>
                {id} - {presets.entries[String(id)]?.n ?? `Preset ${id}`}
              </option>
            ))}
          </select>
        </label>

        <label className="fieldLabel">
          Preset name
          <input value={presetName} maxLength={32} onChange={(event) => setPresetName(event.target.value)} />
        </label>

        <label className="fieldLabel">
          Quick label
          <input value={quickLabel} maxLength={8} onChange={(event) => setQuickLabel(event.target.value)} />
        </label>

        <div className="actions">
          <button
            type="button"
            className="pillButton"
            onClick={() => {
              const createdId = savePreset(undefined, presetName || undefined);
              if (createdId) {
                setSelectedPresetId(createdId);
                if (quickLabel.trim()) setPresetQuickLabel(createdId, quickLabel.trim());
              }
            }}
          >
            + Create preset
          </button>
          <button
            type="button"
            className="pillButton"
            onClick={() => {
              savePreset(selectedPresetId, presetName || undefined);
              setPresetQuickLabel(selectedPresetId, quickLabel.trim());
            }}
          >
            Save preset
          </button>
          <button type="button" className="pillButton" onClick={() => applyPreset(selectedPresetId)}>
            Apply preset
          </button>
          <button type="button" className="pillButton" onClick={() => deletePreset(selectedPresetId)}>
            Delete preset
          </button>
          <button
            type="button"
            className="pillButton"
            onClick={() => downloadJson(`preset-${selectedPresetId}.json`, { [selectedPresetId]: presets.entries[String(selectedPresetId)] })}
          >
            Export preset
          </button>
        </div>

        <h3 className="columnTitle">Playlist</h3>

        <label className="fieldLabel">
          Preset IDs (CSV)
          <input value={playlistForm.ps} onChange={(event) => setPlaylistForm((prev) => ({ ...prev, ps: event.target.value }))} />
        </label>
        <label className="fieldLabel">
          Durations (tenths CSV)
          <input value={playlistForm.dur} onChange={(event) => setPlaylistForm((prev) => ({ ...prev, dur: event.target.value }))} />
        </label>
        <label className="fieldLabel">
          Transitions (tenths CSV)
          <input value={playlistForm.transition} onChange={(event) => setPlaylistForm((prev) => ({ ...prev, transition: event.target.value }))} />
        </label>
        <label className="fieldLabel">
          Repeat
          <input type="number" value={playlistForm.repeat} onChange={(event) => setPlaylistForm((prev) => ({ ...prev, repeat: event.target.value }))} />
        </label>
        <label className="fieldLabel">
          End preset (0/255/id)
          <input type="number" value={playlistForm.end} onChange={(event) => setPlaylistForm((prev) => ({ ...prev, end: event.target.value }))} />
        </label>
        <label className="segmentCheckRow">
          <input type="checkbox" checked={playlistForm.r} onChange={(event) => setPlaylistForm((prev) => ({ ...prev, r: event.target.checked }))} />
          <span>Shuffle</span>
        </label>

        <div className="actions">
          <button type="button" className="pillButton" onClick={() => setPlaylistForPreset(selectedPresetId, toPlaylistPayload(playlistForm))}>
            Create playlist
          </button>
          <button
            type="button"
            className="pillButton"
            onClick={() => downloadJson(`playlist-${selectedPresetId}.json`, { playlist: toPlaylistPayload(playlistForm) })}
          >
            Export playlist
          </button>
          <button type="button" className="pillButton" onClick={() => startPlaylist(toPlaylistPayload(playlistForm), selectedPresetId)}>
            Test playlist
          </button>
          <button type="button" className="pillButton" onClick={stopPlaylist}>
            Stop playlist
          </button>
          <button type="button" className="pillButton" onClick={advancePlaylist}>
            Next entry
          </button>
          <button type="button" className="pillButton" onClick={() => clearPlaylistForPreset(selectedPresetId)}>
            Clear playlist
          </button>
        </div>

        <h3 className="columnTitle">Visualizer</h3>
        <label className="segmentCheckRow">
          <input type="checkbox" checked={visualization.enabled} onChange={(event) => setVisualizationEnabled(event.target.checked)} />
          <span>Enable mapped view</span>
        </label>

        <label className="fieldLabel">
          Background image
          <input
            type="file"
            accept="image/*"
            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              const image = new Image();
              image.src = dataUrl;
              image.onload = () => {
                setVisualizationBackground({
                  name: file.name,
                  dataUrl,
                  width: image.naturalWidth,
                  height: image.naturalHeight
                });
              };
            }}
          />
        </label>

        <div className="actions">
          <button type="button" className="pillButton" onClick={startVisualizationStrip}>
            Start strip
          </button>
          <button type="button" className="pillButton" onClick={finishVisualizationStrip}>
            Finish strip
          </button>
          <button type="button" className="pillButton" onClick={cancelVisualizationStrip}>
            Cancel strip
          </button>
        </div>

        <div
          className="visualizerCanvas"
          onClick={(event) => {
            if (!visualization.drawing) return;
            const rect = event.currentTarget.getBoundingClientRect();
            addVisualizationPoint(event.clientX - rect.left, event.clientY - rect.top);
          }}
          style={{
            position: "relative",
            width: "100%",
            height: "220px",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "12px",
            overflow: "hidden",
            cursor: visualization.drawing ? "crosshair" : "default",
            background: "#11161f"
          }}
        >
          {visualization.background ? (
            <img
              src={visualization.background.dataUrl}
              alt={visualization.background.name}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
            />
          ) : null}
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            {visualSvgLines.map((line) => (
              <polyline
                key={line.id}
                points={line.points.map((point) => `${point[0]},${point[1]}`).join(" ")}
                stroke={line.id === "draft" ? "#ffe082" : "#7ad887"}
                strokeWidth={3}
                fill="none"
              />
            ))}
          </svg>
        </div>

        <div className="segmentCardsList">
          {visualization.strips.map((strip) => {
            const link = visualization.links.find((entry) => entry.stripId === strip.id);
            return (
              <section key={strip.id} className="segmentPanel">
                <div className="segmentHeaderBar">
                  <button type="button" className="segmentHeaderButton" onClick={() => removeVisualizationStrip(strip.id)}>
                    {strip.id}
                  </button>
                  <button type="button" className="segmentIconButton" onClick={() => removeVisualizationStrip(strip.id)}>
                    -
                  </button>
                </div>
                <label className="fieldLabel">
                  Segment
                  <select value={link?.segmentIndex ?? 0} onChange={(event) => mapVisualizationStrip(strip.id, Number(event.target.value))}>
                    {segments.map((_, index) => (
                      <option key={index} value={index}>
                        Segment {index}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fieldLabel">
                  LED count
                  <input
                    type="number"
                    min={1}
                    value={strip.ledCount || 1}
                    onChange={(event) => updateVisualizationStripLedCount(strip.id, Number(event.target.value))}
                  />
                </label>
              </section>
            );
          })}
        </div>

        <div className="actions">
          <button type="button" className="pillButton" onClick={() => downloadJson("visualization.json", JSON.parse(exportVisualizationProject()))}>
            Export visualizer
          </button>
          <label className="pillButton" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            Import visualizer
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const parsed = JSON.parse(text) as Partial<VisualizationProject>;
                importVisualizationProject(parsed);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
