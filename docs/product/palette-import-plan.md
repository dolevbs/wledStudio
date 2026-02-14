# Palette Import Plan (WLED Studio)

## Facts

- Upstream WLED is pinned to commit `ce31d802d530c288989a21698e917c0343e99822` in `/Users/dolevbenshushan/work/wledStudio/vendor/WLED.commit`.
- Upstream WLED fixed palette names list contains 72 entries in `/Users/dolevbenshushan/work/wledStudio/vendor/WLED/wled00/FX_fcn.cpp` (`JSON_palette_names`).
- Current upstream build path compiles selected units only (`upstream_fx.cpp`, `upstream_fx_particles.cpp`, `upstream_host_stubs.cpp`, `upstream_fastled_runtime.cpp`) from `/Users/dolevbenshushan/work/wledStudio/scripts/build_wasm.sh`.
- Current host shim exposes `JSON_palette_names = "[]"` and only implements palette switch logic for approximately `pal 0..8` in `/Users/dolevbenshushan/work/wledStudio/src/headless/upstream_host_stubs.cpp`.

## Inference

- Importing all preconfigured palettes requires:
  - Full palette catalog availability (IDs + names) in Studio UI/state.
  - Runtime rendering parity for those palette IDs.

## Problem / Outcome / Constraints

- Problem: Studio currently cannot reliably expose and use all upstream preconfigured palettes in the current WASM path.
- Outcome: Users can select any upstream built-in palette from the pinned WLED version and get expected visual behavior.
- Constraints: Preserve current build reliability (`USE_UPSTREAM=1`, `WLED_DISABLE_2D`) and avoid regressions in parity/perf gates.

## Goals

- Primary goal: Achieve upstream-consistent built-in palette coverage in Studio for the pinned WLED commit.
- Supporting goals:
  - Keep palette IDs stable across upstream upgrades.
  - Eliminate manual palette list drift.
  - Maintain WASM size/perf within current guardrails.

## Success Metrics

- Palette availability in UI: unknown/partial -> `72/72` fixed palettes in one release cycle.
- Palette ID/name mismatch incidents: ad hoc -> `0` in CI checks.
- Parity pass rate for palette-sensitive effects: current `test:parity` baseline -> no regressions plus new palette vectors pass.
- WASM size delta: current baseline -> within agreed budget (example: <= +5%).

## Options

1. Option A (Fast path): import names only into UI.
   - Pros: fastest implementation.
   - Cons: high mismatch risk; visuals remain incorrect for many IDs.
2. Option B (Balanced): import names + runtime palette data path for fixed palettes, with parity tests.
   - Pros: correct user outcome, manageable effort, reversible.
   - Cons: moderate engineering effort.
3. Option C (Strategic): add auto-sync pipeline from upstream sources (codegen + CI drift checks) plus Option B.
   - Pros: best long-term maintainability.
   - Cons: highest initial effort.

## Recommendation

- Choose Option B now, then add Option C automation in the same release only if capacity remains.
- Rationale: Option B delivers immediate correctness; Option C prevents future drift.

## Prioritization

| Initiative | Impact | Confidence | Effort | Urgency | Score | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Palette catalog import/exposure in UI/state | 5 | 5 | 2 | 5 | 62.5 | Quick high-value coverage |
| Palette runtime parity path | 5 | 4 | 3 | 5 | 33.3 | Core correctness |
| CI drift check/codegen for upstream bumps | 4 | 4 | 3 | 4 | 21.3 | Maintainability |
| Palette-heavy visual regression suite | 4 | 3 | 3 | 4 | 16.0 | Regression protection |

Formula: `Score = (Impact * Confidence * Urgency) / Effort`

## Milestones

1. Milestone 1 (Week 1): Source-of-truth extraction
   - Exit criteria:
     - Generated palette manifest (ID/name/count) from pinned upstream.
     - CI check verifies `count == 72`.
2. Milestone 2 (Week 2): Runtime parity enablement
   - Exit criteria:
     - Full fixed palette mapping available in WASM path.
     - Palette selection works end-to-end.
3. Milestone 3 (Week 3): Parity hardening
   - Exit criteria:
     - Palette-focused parity vectors and regression checks added.
     - Gates green: `test`, `test:parity`, `test:perf`, `check:wasm-size`.

## Risks and Mitigations

- Risk: shim/upstream symbol conflicts.
  - Mitigation: isolate palette path behind compile guards and incremental link checks.
- Risk: WASM size increase.
  - Mitigation: define size budget and CI threshold.
- Risk: palette ID drift on future WLED bump.
  - Mitigation: generated manifest plus CI drift test against upstream sources.

## Not Now

- Custom palette editor parity.
- Runtime loading of user-uploaded custom palettes.
- 2D palette behavior expansion beyond current `WLED_DISABLE_2D` scope.

## Decision Request

- Approve Option B for the next cycle, with Option C as stretch scope if Week 2 completes on time.
- Immediate next action: create implementation ticket breakdown aligned to:
  - `/Users/dolevbenshushan/work/wledStudio/src/headless`
  - `/Users/dolevbenshushan/work/wledStudio/src/config`
  - `/Users/dolevbenshushan/work/wledStudio/tests`
