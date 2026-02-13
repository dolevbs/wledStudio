# Playlist Parity PRD + Tech Spec

## User Stories
- As a user, I can create, edit, and run playlists that behave like WLED playlists.
- As a user, I can save playlists as presets and reload them reliably.
- As a user, I can manually advance an active playlist.

## Non-Goals
- Rebuild WLED preset/playlist UI exactly.
- Implement nested playlist recursion beyond explicit current product model.

## Data Contracts
- `WledPlaylistPayload`
  - `ps: number[]`
  - `dur: number[] | number`
  - `transition: number[] | number`
  - `repeat: number`
  - `end?: number`
  - `r?: boolean`
- `WledPresetEntry`
  - WLED-compatible state fields plus optional `playlist`, `n`, `ql`.

## Behavioral Rules
- Max 100 playlist entries.
- Scalar `dur`/`transition` expand to arrays.
- Short arrays extend from last value.
- Negative repeat normalizes to `repeat=0` and `r=true`.
- `end=255` preserved as restore marker.
- `end>250` (except 255) normalizes to `0`.
- `dur=0` means hold until manual advance.

## UX Requirements
- Enable preset/playlist controls in control deck:
  - Create preset
  - Export preset
  - Create/edit playlist
  - Export playlist
  - Test/stop playlist
  - Next-entry control
- Validation feedback inline for invalid operations.

## Edge Cases
- Empty playlist => invalid; disable start.
- Missing referenced preset => skip entry and record runtime warning.
- Playlist with one entry + finite repeat => runs as expected.

## Acceptance Criteria
- Playlist normalization tests pass.
- Runtime playlist tests cover repeat/shuffle/end/manual-advance.
- UI can create/save/load/test playlists without raw JSON editing.

## Test Matrix
- Scalar/array normalization
- Repeat finite/infinite/negative
- End behavior including 255
- Dur=0 manual advance
- Entry >100 clamp
- Shuffle on/off

## Rollout Gates
- Contract + unit tests green.
- Manual smoke test for preset/playlist UI controls.
- No regressions in effect/segment controls.

## Known Gaps (Current Implementation)
- Playlist execution currently runs in Studio app state timing, not inside worker/engine runtime messages.
- Nested playlist handoff behavior from upstream WLED is not fully modeled.
- Missing-preset playlist entries are currently tolerated but not surfaced with a dedicated runtime UI status panel.
- Transition tenths values are stored and normalized, but transition behavior is not yet mapped to a WLED-equivalent visual transition engine.

## Next Steps
- Add worker contract messages for playlist start/stop/tick/advance and move scheduler control to worker-driven runtime.
- Implement explicit nested playlist behavior compatibility and add tests for parent/child playlist restoration.
- Add playlist runtime diagnostics UI (active index, repeats left, skipped entries, warnings).
- Add transition parity tests against upstream vector fixtures for representative playlist scenarios.
