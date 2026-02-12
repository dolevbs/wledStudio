# WLED Studio

Browser-native WLED simulation IDE using a headless C++ shim compiled to WebAssembly.

## MVP Stack

- Next.js App Router + Zustand
- 2D canvas renderer (`StudioRenderer`)
- C++ bridge + mock HAL in `src/headless`
- Dockerized Emscripten build (`scripts/build_wasm.sh`)

## Commands

```bash
npm install
npm run sync:wled
npm run build:wasm
npm run dev
```

## WASM Build Notes

- Docker image: `emscripten/emsdk:3.1.74`
- Output artifacts:
  - `public/wasm/wled.js`
  - `public/wasm/wled.wasm`
- Safety flags:
  - `FASTLED_FORCE_SOFTWARE_SPI`
  - `FASTLED_NO_ASM`
- `wled_server.cpp` and `alexa.cpp` are excluded.

### Upstream WLED Runtime

The simulator supports an upstream WLED runtime path compiled into WASM.

```bash
USE_UPSTREAM=1 scripts/build_wasm.sh
```

Debug-oriented upstream build (extra assertions, Node-compatible environment):

```bash
DEBUG_WASM=1 USE_UPSTREAM=1 scripts/build_wasm.sh
```

Current upstream build configuration includes:

- `WLED_STUDIO_USE_UPSTREAM=1`
- `WLED_DISABLE_2D` (active effect list is filtered to non-2D effects)
- `WLED_PS_DONT_REPLACE_1D_FX` (keeps original 1D effects that PS can replace)

## Simulation Controls

- Effect and palette controls are metadata-driven from `src/config/wledEffectCatalog.ts`.
- Effect-specific sliders are derived from effect metadata and can differ per effect.
- Three independent color inputs are supported and sent as `seg.col[0..2]`.
- When switching effects, segment defaults are initialized from WLED metadata (for example `sx`, `ix`, `pal`, `c1`, `c2`) to avoid invalid static-looking states.

## Diagnostics

- Runtime diagnostics are emitted from the worker and shell as `[diag]` logs.
- Engine init/render state and frame snapshots are logged in dev mode.
- Worker errors are surfaced in the status bar and console.

## Testing

```bash
npm run test
npm run test:parity
npm run test:perf
npm run check:wasm-size
```

Parity tests use deterministic golden vectors under `tests/fixtures/parity_vectors.json` for a curated set of 12 effects.

## Known Limitations

- `Copy Segment (77)` requires a valid source segment; in single-segment simulation it is expected to appear static/black.
- 2D effects are cataloged but filtered from the active UI list when running the current upstream build flags.
