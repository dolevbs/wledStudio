# Background Image Visibility Toggle PRD

## Feature
Hide uploaded background image without removing it.

## Assumptions
- Users can upload a background image in the simulator canvas today.
- Uploaded image is currently always visible once set.
- UI and state are managed in Next.js + Zustand.

## Facts, Inferences, Open Questions
### Facts
- Request is to hide a user-uploaded background image.

### Inferences
- Users need a faster way to declutter the view while tuning effects.

### Open Questions
- Should hidden state persist across refresh/project reload, or be session-only?

## Problem Statement
Users need to focus on LED/effect output without deleting and re-uploading their background image.

## Outcomes
- Users can toggle background image visibility instantly.
- Uploaded asset remains intact while hidden.
- Iterative preview/testing becomes faster and less destructive.

## Scope
### In Scope (MVP)
1. Add a `Show background` toggle near background controls.
2. Hiding does not delete the uploaded image.
3. Canvas updates immediately when toggled.
4. Default remains visible after upload.

### Not Now
1. Opacity slider.
2. Per-scene visibility presets.
3. Auto-hide logic based on zoom.
4. Multiple background layers.

## UX Behavior
1. User uploads image, image is visible.
2. User turns off `Show background`, image is hidden.
3. User turns it back on, same image returns.
4. Optional helper text while hidden: "Background hidden (image retained)".

## Success Metrics
- Task completion time (focus on effects without delete/reupload):
  - Baseline: unknown (estimated 8-12s workaround)
  - Target: under 1s
- Mis-action rate (delete instead of hide):
  - Baseline: unknown
  - Target: 80% reduction
- Adoption among users with uploaded backgrounds:
  - Baseline: 0%
  - Target: 30%+ weekly usage

## Implementation Notes
1. Add UI toggle in background panel.
2. Add Zustand flag: `backgroundVisible: boolean`.
3. Render background only when flag is true.
4. Preserve uploaded image data while hidden.
5. Add tests:
   - state toggle unit test
   - render behavior test (visible/hidden)
   - regression test for retained upload after toggle

## Risks and Mitigations
- Risk: Users confuse hide with remove.
  - Mitigation: keep a separate explicit `Remove image` action.
- Risk: Persistence behavior surprises users.
  - Mitigation: decide and document persistence behavior.

## Dependencies
- Existing canvas rendering path where background image draw is applied.
- State wiring between control panel and renderer.

## Rollout
1. Optional feature flag for staged release.
2. Internal validation first.
3. Monitor usage and support feedback for 1-2 sprints.

## Decision Request
Approve MVP scope and choose persistence behavior:
1. Persist hidden state across reload/project save.
2. Reset to visible on reload (recommended for predictability).
