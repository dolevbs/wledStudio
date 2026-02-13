"use client";

import { useState } from "react";

import type { StudioTopology } from "@/types/studio";

interface LedConfigCardProps {
  topology: StudioTopology;
  onModeChange: (mode: "strip" | "matrix") => void;
  onDimensionsChange: (width: number, height: number) => void;
  onLedCountChange: (count: number) => void;
  onSerpentineChange: (enabled: boolean) => void;
  onGapsChange: (gaps: string) => void;
}

export function LedConfigCard({
  topology,
  onModeChange,
  onDimensionsChange,
  onLedCountChange,
  onSerpentineChange,
  onGapsChange
}: LedConfigCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className="panelShell cardSection">
      <div className="sectionHeaderRow">
        <h2 className="sectionLabel">LED Configuration</h2>
        <button type="button" className="pillButton" onClick={() => setCollapsed((prev) => !prev)} aria-expanded={!collapsed}>
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="configGrid">
            <div className="pillTabs" role="tablist" aria-label="Topology mode">
              <button
                type="button"
                role="tab"
                aria-selected={topology.mode === "matrix"}
                className={topology.mode === "matrix" ? "pillButton active" : "pillButton"}
                onClick={() => onModeChange("matrix")}
              >
                Matrix
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={topology.mode === "strip"}
                className={topology.mode === "strip" ? "pillButton active" : "pillButton"}
                onClick={() => onModeChange("strip")}
              >
                Strip
              </button>
            </div>

            {topology.mode === "matrix" ? (
              <label className="fieldLabel">
                Width / Height
                <div className="inlineFields">
                  <input
                    type="number"
                    min={1}
                    value={topology.width}
                    onChange={(event) => onDimensionsChange(Number(event.target.value), topology.height)}
                  />
                  <span className="orText">x</span>
                  <input
                    type="number"
                    min={1}
                    value={topology.height}
                    onChange={(event) => onDimensionsChange(topology.width, Number(event.target.value))}
                  />
                </div>
              </label>
            ) : (
              <label className="fieldLabel">
                Length
                <input type="number" min={1} value={topology.ledCount} onChange={(event) => onLedCountChange(Number(event.target.value))} />
              </label>
            )}

            <label className="fieldLabel">
              <span>Serpentine</span>
              <input
                type="checkbox"
                checked={topology.serpentine}
                onChange={(event) => onSerpentineChange(event.target.checked)}
                disabled={topology.mode !== "matrix"}
                aria-disabled={topology.mode !== "matrix"}
              />
            </label>
          </div>
          <label className="fieldLabel configGapsField">
            Gaps JSON
            <input
              type="text"
              placeholder='[{"start":300,"length":20}]'
              defaultValue={JSON.stringify(topology.gaps)}
              onBlur={(event) => onGapsChange(event.target.value)}
            />
          </label>
        </>
      ) : null}
    </section>
  );
}
