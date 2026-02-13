# WLED Studio Parity Contract

## Purpose
This contract defines exactly what "WLED parity" means for the current implementation scope.

## Scope
- Playlist behavior and JSON payload compatibility are aligned to upstream WLED semantics from:
  - `vendor/WLED/wled00/playlist.cpp`
  - `vendor/WLED/wled00/json.cpp`
- Export/import compatibility targets WLED ingestion safety for `presets.json` and a safe-subset `cfg.json`.
- UI parity is explicitly out of scope.

## Non-Goals
- Pixel-identical WLED UI recreation.
- Full-device `cfg.json` cloning (network/security/system settings).
- Hardware networking, flashing, or firmware-level FS behavior.

## JSON Compatibility Rules
### Playlist payload (`playlist`)
- Keys: `ps`, `dur`, `transition`, `repeat`, `end`, `r`.
- `ps`: array of preset IDs, clamped to max 100 entries.
- `dur` and `transition`:
  - Accept scalar or array input.
  - Normalize to arrays of `ps.length` by extending last value.
  - Values represent tenths of seconds.
- `repeat`:
  - `0` => infinite.
  - negative => treated as infinite and enables shuffle (`r=true`).
- `end`:
  - `255` => restore prior preset behavior marker.
  - values `>250` (except `255`) normalize to `0`.
- `r`: shuffle flag.

### Preset entry payload (`presets.json` values)
- Preset entries preserve WLED-compatible state fields (`on`, `bri`, `seg`, etc.) and optional metadata (`n`, `ql`).
- Playlist presets include `playlist` object preserving normalized values.

### Configuration payload (`cfg.json` safe subset)
- Emit only topology/layout fields owned by Studio under WLED key paths.
- No fake defaults for unsupported domains (WiFi, MQTT, OTA, security).

## Runtime Parity Rules
- Playlist scheduler semantics:
  - Entry timing based on `dur`/`transition` tenths values.
  - `dur=0` behaves as infinite hold until manual advance.
  - Supports next-entry trigger (`np`) from runtime control.
  - Repeat/shuffle/end behavior follows normalization rules above.
- Applying presets from playlist updates simulation command payload with no schema translation loss.

## Validation and Fallbacks
- Unknown/unsupported fields are ignored with warnings, not hard failures.
- Invalid JSON => fail import with clear error message.
- Invalid playlist shape => normalize where possible; reject only when no valid `ps` exists.

## Acceptance Gates
- Contract tests pass for playlist normalization and export/import roundtrip.
- Existing command simulation behavior remains unchanged outside playlist/preset/visualization additions.
- No regression in raw JSON editing and segment control workflows.

## Known Gaps (Current Implementation)
- Parity is behavior/schema aligned for selected domains, not a full firmware runtime parity guarantee.
- Playlist control plane is currently app-state driven; worker-level parity transport is pending.
- `cfg.json` parity is contractually safe-subset only and excludes non-topology domains.
- Transition/timing visuals are compatibility-oriented but not yet verified against upstream frame-level playlist transition traces.

## Next Steps
- Add parity test vectors for playlist runtime progression and transition timing against upstream traces.
- Define and implement worker/runtime contract for playlist lifecycle control.
- Add explicit contract appendix enumerating unsupported `cfg.json` branches and rationale.
- Add periodic parity review process tied to upstream WLED updates (diff + contract update + regression run).
