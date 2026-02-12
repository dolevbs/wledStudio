"use client";

import { useState, type ChangeEvent } from "react";

import { buildExportArtifacts } from "@/io/jsonIO";
import { sanitizeTopology, sanitizeWledEnvelope } from "@/io/sanitize";
import type { StudioState } from "@/state/studioStore";

interface ImportExportPanelProps {
  state: Pick<StudioState, "topology" | "command" | "replaceTopology" | "replaceCommand">;
}

function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCfgAndPresets(topology: StudioState["topology"], command: StudioState["command"]): void {
  const artifacts = buildExportArtifacts(topology, command);
  downloadFile("cfg.json", artifacts.cfgJson);
  downloadFile("presets.json", artifacts.presetsJson);
}

function firstPresetValue(input: Record<string, unknown>): unknown {
  const [firstKey] = Object.keys(input);
  return firstKey ? input[firstKey] : null;
}

export function ImportExportPanel({ state }: ImportExportPanelProps) {
  const [message, setMessage] = useState("Ready");

  const onExport = () => {
    try {
      exportCfgAndPresets(state.topology, state.command);
      setMessage("Exported cfg.json and presets.json");
    } catch (error) {
      setMessage(`Export failed: ${String(error)}`);
    }
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      if (parsed.hw && typeof parsed.hw === "object") {
        const led = (parsed.hw as Record<string, unknown>).led as Record<string, unknown> | undefined;
        const topology = {
          mode: led?.matrix ? "matrix" : "strip",
          width: Number(led?.width) || state.topology.width,
          height: Number(led?.height) || state.topology.height,
          ledCount: Number(led?.total) || state.topology.ledCount,
          serpentine: Boolean(led?.serpentine),
          gaps: []
        };

        const sanitizedTopology = sanitizeTopology(topology);
        state.replaceTopology(sanitizedTopology.data);
        setMessage(`Imported topology with ${sanitizedTopology.warnings.length} warning(s)`);
        return;
      }

      const maybePreset = parsed.seg || parsed.on !== undefined || parsed.bri !== undefined ? parsed : firstPresetValue(parsed);
      const sanitized = sanitizeWledEnvelope(maybePreset);
      state.replaceCommand(sanitized.data, sanitized.warnings);
      setMessage(`Imported command with ${sanitized.warnings.length} warning(s)`);
    } catch (error) {
      setMessage(`Import failed: ${String(error)}`);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="panel">
      <h2>Import / Export</h2>
      <div className="actions">
        <label className="filePicker">
          Import cfg/presets
          <input type="file" accept="application/json,.json" onChange={onImport} />
        </label>
        <button type="button" onClick={onExport}>
          Export cfg + presets
        </button>
      </div>
      <p className="small">{message}</p>
    </section>
  );
}
