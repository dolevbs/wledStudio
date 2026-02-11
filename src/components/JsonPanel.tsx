"use client";

import type { StudioState } from "@/state/studioStore";

interface JsonPanelProps {
  state: Pick<StudioState, "rawJson" | "setRawJson" | "applyRawJson" | "warnings">;
}

export function JsonPanel({ state }: JsonPanelProps) {
  return (
    <section className="panel">
      <h2>Raw JSON Command</h2>
      <textarea
        value={state.rawJson}
        onChange={(event) => state.setRawJson(event.target.value)}
        spellCheck={false}
        rows={14}
      />
      <div className="actions">
        <button type="button" onClick={() => state.applyRawJson()}>
          Sanitize + Apply
        </button>
      </div>
      {state.warnings.length > 0 ? (
        <ul className="warnings">
          {state.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
