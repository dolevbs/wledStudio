# Headless Engine Notes

The bridge currently ships with a deterministic software fallback implementation embedded in `wled_bridge.cpp`.

## Upstream mode

Set `USE_UPSTREAM=1` when running `scripts/build_wasm.sh` to include selected upstream WLED compilation units in the Emscripten command.

```bash
USE_UPSTREAM=1 scripts/build_wasm.sh
```

This repo already wires:

- Mock HAL headers (`Mock_Arduino.h`, `Mock_NeoPixelBus.h`, `Mock_Network.h`)
- Exclusion guard for `wled_server.cpp` and `alexa.cpp`
- FastLED compatibility defines (`FASTLED_FORCE_SOFTWARE_SPI`, `FASTLED_NO_ASM`)

Additional upstream symbols are expected and should be shimmed incrementally as parity integration continues.
