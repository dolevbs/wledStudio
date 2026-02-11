#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fxHeaderPath = path.join(root, "vendor/WLED/wled00/FX.h");
const fxCppPath = path.join(root, "vendor/WLED/wled00/FX.cpp");
const outPath = path.join(root, "src/config/wledEffectCatalog.ts");

const fxHeader = fs.readFileSync(fxHeaderPath, "utf8");
const fxCpp = fs.readFileSync(fxCppPath, "utf8");

const effectIdBySymbol = {};
for (const match of fxHeader.matchAll(/^#define\s+(FX_MODE_[A-Z0-9_]+)\s+(\d+)/gm)) {
  effectIdBySymbol[match[1]] = Number.parseInt(match[2], 10);
}

const metadataByDataSymbol = {};
for (const match of fxCpp.matchAll(/static const char (_data_FX_MODE_[A-Z0-9_]+)\[\]\s+PROGMEM\s*=\s*"([^"]*)";/g)) {
  metadataByDataSymbol[match[1]] = match[2];
}

const rawEntries = [];
for (const match of fxCpp.matchAll(/addEffect\((FX_MODE_[A-Z0-9_]+),\s*&[A-Za-z0-9_]+,\s*(_data_FX_MODE_[A-Z0-9_]+)\);/g)) {
  const effectSymbol = match[1];
  const dataSymbol = match[2];
  const id = effectIdBySymbol[effectSymbol];
  if (!Number.isInteger(id)) {
    continue;
  }
  const metadata = metadataByDataSymbol[dataSymbol] ?? "";
  const label = ((metadata.split("@")[0] ?? "").split(";")[0] ?? "").trim() || effectSymbol;
  rawEntries.push({ id, label, metadata });
}

if (!rawEntries.some((entry) => entry.id === 0)) {
  const metadata = metadataByDataSymbol._data_FX_MODE_STATIC ?? "Solid";
  rawEntries.push({
    id: 0,
    label: (metadata.split("@")[0] ?? "Solid").trim() || "Solid",
    metadata
  });
}

const entries = [];
const seenIds = new Set();
for (const entry of rawEntries.sort((a, b) => a.id - b.id)) {
  if (seenIds.has(entry.id)) {
    continue;
  }
  seenIds.add(entry.id);
  entries.push(entry);
}

const output = `export interface WledEffectCatalogEntry {
  id: number;
  label: string;
  metadata: string;
}

export const WLED_EFFECT_CATALOG: WledEffectCatalogEntry[] = [
${entries.map((entry) => `  { id: ${entry.id}, label: ${JSON.stringify(entry.label)}, metadata: ${JSON.stringify(entry.metadata)} }`).join(",\n")}
];
`;

fs.writeFileSync(outPath, output);
console.log(`Generated ${entries.length} WLED effects into ${path.relative(root, outPath)}`);
