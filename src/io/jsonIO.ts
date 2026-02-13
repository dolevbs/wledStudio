import type { StudioPresetLibrary, StudioTopology, WledJsonEnvelope, WledPresetEntry } from "@/types/studio";
import { validateTopology, validateWledEnvelope } from "@/io/schema";

export interface ExportArtifacts {
  cfgJson: string;
  presetsJson: string;
}

export function buildCfgJson(topology: StudioTopology): string {
  const cfg = {
    hw: {
      led: {
        total: topology.ledCount,
        matrix: topology.mode === "matrix",
        width: topology.width,
        height: topology.height,
        serpentine: topology.serpentine
      }
    }
  };

  const validation = validateTopology(topology);
  if (!validation.valid) {
    throw new Error(`cfg export failed validation: ${validation.errors.join(", ")}`);
  }

  return JSON.stringify(cfg, null, 2);
}

function sanitizePresetForExport(entry: WledPresetEntry): WledPresetEntry {
  const out: WledPresetEntry = {
    ...entry
  };
  if (out.n) out.n = out.n.slice(0, 32);
  if (out.ql) out.ql = out.ql.slice(0, 8);
  return out;
}

export function buildPresetsJson(payload: WledJsonEnvelope): string {
  const validation = validateWledEnvelope(payload);
  if (!validation.valid) {
    throw new Error(`presets export failed validation: ${validation.errors.join(", ")}`);
  }
  return buildPresetsJsonFromLibrary({
    entries: {
      "0": {
        n: "Studio Export",
        ...payload
      }
    },
    currentPresetId: null,
    activePlaylist: null
  });
}

export function buildPresetsJsonFromLibrary(library: StudioPresetLibrary): string {
  const entries: Record<string, WledPresetEntry> = {};
  for (const [id, rawEntry] of Object.entries(library.entries)) {
    const idNumber = Number(id);
    if (!Number.isInteger(idNumber) || idNumber < 0 || idNumber > 250) continue;
    const entry = sanitizePresetForExport(rawEntry);
    const validation = validateWledEnvelope(entry);
    if (!validation.valid) continue;
    entries[id] = entry;
  }

  if (Object.keys(entries).length === 0) {
    entries["0"] = {
      n: "Studio Export",
      on: true,
      bri: 128,
      seg: {
        fx: 8,
        sx: 128,
        ix: 128,
        pal: 0,
        c1: 0,
        c2: 0,
        col: [[255, 170, 0], [0, 0, 0], [0, 0, 0]]
      }
    };
  }

  return JSON.stringify(entries, null, 2);
}

export function buildExportArtifacts(topology: StudioTopology, payload: WledJsonEnvelope, presets?: StudioPresetLibrary): ExportArtifacts {
  return {
    cfgJson: buildCfgJson(topology),
    presetsJson: presets ? buildPresetsJsonFromLibrary(presets) : buildPresetsJson(payload)
  };
}
