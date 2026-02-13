# Export Compatibility PRD + Tech Spec

## User Stories
- As a user, I can export Studio presets/playlists and import them into real WLED.
- As a user, I can export cfg topology settings in WLED-safe key paths.
- As a user, I can import presets and cfg files with clear warnings for unsupported fields.

## Non-Goals
- Produce full-device `cfg.json` parity.
- Emit unsupported system/security/network fields.

## Data Contracts
- Export artifacts:
  - `cfg.json` safe subset.
  - `presets.json` full Studio preset library.
- Import:
  - `cfg.json` -> topology fields only.
  - `presets.json` -> preset library including playlists.

## Field-Level Rules
### presets.json
- Preserve key-value preset object structure.
- Preserve `playlist` object shape and normalized values.
- Preserve WLED state keys as-is when stored in library entries.

### cfg.json
- Include only Studio-owned LED layout fields under `hw.led`:
  - `total`, `matrix`, `width`, `height`, `serpentine`.
- Include optional Studio metadata only if namespaced and non-breaking.

## Import Fallbacks
- Unknown fields: ignore + warning.
- Invalid entry shape: skip entry + warning.
- Invalid JSON: hard fail with parse error.

## Acceptance Criteria
- presets roundtrip preserves playlists and preset metadata.
- cfg safe subset imports to Studio correctly and is WLED-ingestable.
- Warnings are user-visible and actionable.

## Test Matrix
- Full presets export/import roundtrip.
- Playlist-bearing preset roundtrip.
- cfg subset export validity.
- Unknown fields ignored.
- Invalid JSON failure path.

## Rollout Gates
- IO tests expanded and green.
- Export/import UI smoke-tested with both files.

## Known Gaps (Current Implementation)
- `cfg.json` export intentionally includes only `hw.led` safe-subset fields and does not include broader WLED config trees.
- Preset validation currently skips invalid preset entries during export instead of producing a structured per-entry export report.
- Import warnings are captured but not grouped by severity/type in UI.
- No automated integration check yet that uploads exported artifacts to a live WLED target.

## Next Steps
- Add optional “strict export report” artifact listing skipped presets and reasons.
- Add categorized warning UI for import (`ignored field`, `shape mismatch`, `normalization applied`).
- Add fixture tests for mixed-validity preset libraries and expected skip/report outcomes.
- Add hardware-loop validation step (automated or scripted) that verifies real-device import success for exported `presets.json` and `cfg.json`.
