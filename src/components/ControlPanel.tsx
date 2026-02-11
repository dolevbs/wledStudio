"use client";

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
    | "setRunning"
  >;
  onReset: () => void;
}

function getSegment(command: StudioState["command"]) {
  return Array.isArray(command.seg) ? command.seg[0] : command.seg;
}

export function ControlPanel({ state, onReset }: ControlPanelProps) {
  const segment = getSegment(state.command) ?? { fx: 8, sx: 128, ix: 128 };

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
          Effect ({segment.fx ?? 8})
          <input
            type="range"
            min={0}
            max={120}
            value={segment.fx ?? 8}
            onChange={(event) => state.setControl("fx", Number(event.target.value))}
          />
        </label>

        <label>
          Speed ({segment.sx ?? 128})
          <input
            type="range"
            min={0}
            max={255}
            value={segment.sx ?? 128}
            onChange={(event) => state.setControl("sx", Number(event.target.value))}
          />
        </label>

        <label>
          Intensity ({segment.ix ?? 128})
          <input
            type="range"
            min={0}
            max={255}
            value={segment.ix ?? 128}
            onChange={(event) => state.setControl("ix", Number(event.target.value))}
          />
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
