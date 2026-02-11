import type { StudioTopology, WledJsonEnvelope } from "@/types/studio";
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

export function buildPresetsJson(payload: WledJsonEnvelope): string {
  const validation = validateWledEnvelope(payload);
  if (!validation.valid) {
    throw new Error(`presets export failed validation: ${validation.errors.join(", ")}`);
  }

  const preset = {
    "0": {
      n: "Studio Export",
      on: payload.on ?? true,
      bri: payload.bri ?? 128,
      seg: payload.seg
    }
  };

  return JSON.stringify(preset, null, 2);
}

export function buildExportArtifacts(topology: StudioTopology, payload: WledJsonEnvelope): ExportArtifacts {
  return {
    cfgJson: buildCfgJson(topology),
    presetsJson: buildPresetsJson(payload)
  };
}
