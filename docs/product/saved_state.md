### Feature Plan: Per-User Saved Studio State + Navbar Reset State

### Summary
Add client-side persistence so a user’s studio session resumes after closing/reopening the tab, and add a new `Reset State` button in the navbar to fully clear saved state and restore defaults.

This repo already has a single Zustand store and no auth model, so this iteration will use a **single local user** per browser profile (your selected default), with a persistence design that can later be namespaced by real user id.

### Suggested Persistence Approaches
1. Browser-only local persistence (chosen now).
2. Backend profile persistence (future option for cross-device).
3. Hybrid local-first + backend sync (future option).

### Scope and Behavior (locked)
1. Persistence backend: `localStorage` via Zustand `persist`.
2. User model for now: single local user (no auth namespacing yet).
3. Reset action scope: full reset.
4. “Full reset” means:
1. Restore all default store slices (`topology`, `simulation`, `command`, `presets`, `visualization`, `ui`, `rawJson`, `warnings`, `lastError`, `frame`, `simulatedMillis`).
2. Clear persisted storage key from `localStorage`.
3. Reset worker clock path currently triggered by `Reset Clock`.
4. Keep app functional with no page reload required.

### Important API/Interface Changes
1. In `/Users/dolevbenshushan/work/wledStudio/src/state/studioStore.ts`:
1. Introduce persisted store using Zustand `persist` middleware.
2. Add `resetState: () => void` to `StudioState`.
3. Add a stable storage key constant, for example `wled-studio:state:v1`.
4. Add explicit persisted-state versioning/migration scaffold (`version`, `migrate`) for schema evolution.
5. Add `partialize` to persist only serializable and useful slices.
6. Exclude `frame` from persistence (large, transient render buffer).
7. Exclude `lastError` and `warnings` from persistence unless product wants carry-over diagnostics.
8. Persist `simulatedMillis` only if session continuity of timeline is desired; otherwise reset to `0` on hydration for deterministic restart.
2. In `/Users/dolevbenshushan/work/wledStudio/src/components/TopBar.tsx`:
1. Add `onResetState` prop.
2. Add new navbar button label: `Reset State`.
3. Keep existing `Reset Clock` button unchanged.
3. In `/Users/dolevbenshushan/work/wledStudio/src/components/StudioShell.tsx`:
1. Wire `TopBar.onResetState` to store reset action.
2. Ensure reset also triggers worker reset message path so engine and UI stay consistent.
3. Optionally guard with `window.confirm("Reset all saved state?")` before destructive reset.

### Data Persistence Specification
1. Persisted slices:
1. `topology`
2. `simulation` (except fields decided transient if needed)
3. `command`
4. `presets`
5. `visualization`
6. `ui`
7. `rawJson`
8. `simulatedMillis` (decision: persist or reset-on-hydration, choose one and document in code)
2. Non-persisted slices:
1. `frame`
2. `lastError`
3. `warnings` (recommended non-persisted)
3. On startup hydration:
1. Hydrate persisted state before user interaction.
2. Keep sanitize flows intact by relying on existing setters/import sanitizers for user-driven changes.
3. Add migration hook so future type changes do not break old local snapshots.

### UX Plan
1. Navbar now contains `Run/Pause`, `Reset Clock`, `Reset State`, `Export`.
2. `Reset State` clears persisted state and immediately returns app to first-load defaults.
3. Optional confirmation dialog before reset to prevent accidental destructive action.

### Test Plan
1. Add new tests in `/Users/dolevbenshushan/work/wledStudio/tests` (for example `studio-store-persistence.test.ts`).
2. Scenarios:
1. Persists state mutation and rehydrates expected fields.
2. Does not persist transient fields (`frame`, `lastError`, `warnings` if excluded).
3. `resetState` restores defaults.
4. `resetState` clears persisted storage key.
5. Version migration path handles old payload shape safely.
6. Existing visualization import/export tests remain passing.
3. Run `npm run test` to validate full suite.

### Rollout and Compatibility
1. Use a versioned key suffix `:v1`.
2. For future auth support, plan key format migration from single local key to `wled-studio:state:{userId}:vN`.
3. Keep reset logic centralized in store so navbar is just a trigger.

### Assumptions and Defaults Chosen
1. Persist strategy: browser-only local persistence.
2. Per-user identity: single local user in this iteration.
3. Reset scope: full reset.
4. Reset action placement: top navbar button.
5. No backend/API work in this phase.
