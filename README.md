# WLED Studio

Browser-native WLED simulation IDE using a headless C++ shim compiled to WebAssembly.

## MVP Stack

- Next.js App Router + Zustand
- Three.js `InstancedMesh` renderer
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

## Testing

```bash
npm run test
npm run test:parity
npm run test:perf
npm run check:wasm-size
```

Parity tests use deterministic golden vectors under `tests/fixtures/parity_vectors.json` for a curated set of 12 effects.
