# Advanced LED Visualizer PRD + Tech Spec

## User Stories
- As a user, I can upload a background image and paint straight-line LED strips on top.
- As a user, I can map painted strips to existing segments.
- As a user, I see auto-synced simulation updates from the mapping.

## Non-Goals
- 3D rendering/perspective tools.
- Curved/freehand strip painting.
- Photorealistic environment lighting.

## Data Contracts
- `VisualizationProject`
  - `background: BackgroundAsset | null`
  - `strips: PaintedStrip[]`
  - `links: StripSegmentLink[]`
  - `derivedIndexMap: number[]`
- Painted strip geometry uses polyline points; each segment is straight line between points.

## Interaction Rules
- Click adds points.
- Consecutive points create straight segments.
- Explicit finish action commits strip.
- Each committed strip can map to one segment.
- Multiple strips may map to the same segment.

## Auto-Sync Rules
- Recompute derived LED positions and index map on mapping changes.
- Update topology/segment bounds from derived model.
- Keep canonical segment/effect controls active and coherent.

## Persistence
- Save/load visualizer project JSON from UI.
- Persist in Studio state during session.

## Edge Cases
- No background image: still allow painting.
- Unmapped strip: flagged in UI, excluded from sync calculations.
- Segment removed after mapping: mapping marked stale and requires reassignment.

## Acceptance Criteria
- Background upload and strip painting functional.
- Straight-line-only behavior enforced.
- Segment mapping works with validation.
- Auto-sync updates rendering positions and segment bounds.

## Test Matrix
- Painter interaction tests.
- Mapping validation tests.
- Derived index map determinism tests.
- Renderer override positions tests.

## Rollout Gates
- Visualizer UI integration stable on desktop/mobile.
- Unit tests for derived mapping green.
- Manual E2E check: paint -> map -> render update.

## Known Gaps (Current Implementation)
- Visualizer canvas uses basic click/polyline editing; richer editing affordances (snap, drag vertex, undo/redo) are not present.
- LED count estimation and mapping are functional but currently heuristic-first, not calibrated against physical strip metadata.
- Auto-sync updates strip topology/segments, but there is no conflict-resolution flow when manual segment edits race with visualizer-derived bounds.
- Visualizer rendering is 2D overlay only; no depth/perspective/environment realism.

## Next Steps
- Add edit tooling: vertex drag, insert/remove point, undo/redo, and optional grid snapping.
- Add explicit strip property model (direction, spacing, pitch) to improve deterministic LED placement.
- Introduce topology conflict strategy (lock mode or merge prompts) for visualizer vs manual segment edits.
- Add e2e UI tests for paint/map/import/export flows and mobile interaction behavior.
