# Advanced LED Visualizer PRD + Tech Spec

## Product Direction
The advanced visualizer is merged into **LEDs View**. Users upload a picture, fit it to the LEDs workspace (pan/zoom/reset), draw strips directly on top, map strips to segments, and see mapped rendering updates in the same view.

## User Stories
- As a user, I can upload a background image in LEDs View.
- As a user, I can pan/zoom/reset the uploaded image to fit my real setup.
- As a user, I can paint straight-line strips directly in LEDs View and map them to segments.
- As a user, I can export/import the visualizer project with a versioned schema.

## Non-Goals
- 3D rendering/perspective tools.
- Curved/freehand strip painting.
- Rotation, perspective warp, or crop tools in v1.
- Legacy import migration for pre-v2 visualizer JSON files.

## Data Contracts
- `VisualizationProject`
  - `schemaVersion: 2`
  - `enabled: boolean`
  - `background: BackgroundAsset | null`
  - `viewport: { zoom: number; panX: number; panY: number }`
  - `strips: PaintedStrip[]`
  - `links: StripSegmentLink[]`
  - `derivedIndexMap: number[]`
  - `derivedPositions: Array<[number, number, number]>`
  - `draftPoints: Array<[number, number]>`
  - `drawing: boolean`
- `PaintedStrip.points` are normalized scene coordinates in `[0..1]`.

## Interaction Rules
- Drawing rules
  - Click adds points.
  - Consecutive points create straight segments.
  - Explicit finish action commits strip.
  - Finish requires at least two points.
- Mapping rules
  - Each committed strip can map to one segment.
  - Multiple strips may map to the same segment.
- Viewport rules
  - Pan/zoom transforms both background and strip overlay.
  - Reset returns to `zoom=1`, `panX=0`, `panY=0`.
  - Uploading a new image resets viewport to baseline fit.

## UI Requirements
- LEDs View contains the full visualizer workflow:
  - `Enable mapped view`
  - `Upload image`
  - `Start strip`
  - `Finish strip`
  - `Cancel strip`
  - `Zoom +`
  - `Zoom -`
  - `Reset view`
  - `Export`
  - `Import`
- Strip mapping cards (segment assignment + LED count) render under LEDs View.
- Control Deck no longer contains visualizer-specific controls.

## Auto-Sync Rules
- Recompute derived LED positions and index map on strip/mapping/strip-led-count changes.
- Update topology and segment ranges from derived model.
- Keep canonical segment/effect controls active and coherent.

## Persistence
- Export/import project JSON with `schemaVersion: 2`.
- Import rejects payloads without `schemaVersion: 2`.
- Persist visualization project in Studio state during session.

## Edge Cases
- No background image: painting still allowed.
- Unmapped strip: flagged in UI by absence of mapping and excluded from sync calculations.
- Segment removed after mapping: mapping requires reassignment.
- Legacy visualizer file (no schema v2): reject import and keep existing state unchanged.

## Acceptance Criteria
- No visualizer canvas/tools remain in Control Deck.
- LEDs View provides complete upload-fit-draw-map workflow.
- Pan/zoom/reset affects both background and strip geometry.
- Strip mapping updates derived render positions and segment bounds.
- Import/export enforces `schemaVersion: 2`.

## Test Matrix
- Viewport transform tests: screen->scene->screen roundtrip, zoom/pan clamping, reset behavior.
- Visualization sync tests: deterministic derived index map and segment ranges for normalized strip points.
- Import/export tests: schema validation and viewport persistence.
- Manual UI checks: upload -> fit -> draw -> map -> render update on desktop/mobile.

## Rollout Gates
- Unit tests for viewport + visualization sync + import/export are green.
- Manual smoke test of merged LEDs View workflow is complete.
- No regressions in segment/effect/preset/playlist controls.
