#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/public/wasm"
WLED_DIR="${ROOT_DIR}/vendor/WLED/wled00"
DOCKER_IMAGE="emscripten/emsdk:3.1.74"
USE_UPSTREAM="${USE_UPSTREAM:-0}"

mkdir -p "${OUT_DIR}"

BASE_DEFINES=(
  -DFASTLED_FORCE_SOFTWARE_SPI
  -DFASTLED_NO_ASM
  -DWLED_STUDIO_USE_UPSTREAM=${USE_UPSTREAM}
  -D__time_t_defined
  -DWLED_DISABLE_ALEXA
  -DWLED_DISABLE_MQTT
  -DWLED_DISABLE_INFRARED
  -DWLED_DISABLE_HUESYNC
  -DWLED_DISABLE_OTA
  -DWLED_DISABLE_LOXONE
  -DWLED_DISABLE_WEBSOCKETS
)

COMMON_FLAGS=(
  -O3
  -std=c++20
  -include /src/src/headless/Headless_Overrides.h
  -s WASM=1
  -s MODULARIZE=1
  -s EXPORT_NAME=WLEDModule
  -s ALLOW_MEMORY_GROWTH=1
  -s ENVIRONMENT=web,worker
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_wled_init","_wled_json_command","_wled_render_frame","_wled_get_buffer_size","_wled_get_last_error"]'
  -s EXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]'
  -I/src/vendor/FastLED/src/platforms/wasm/compiler
  -I/src/vendor/FastLED/src
  -I/src/src/headless
  -I/src/vendor/WLED/wled00
)

SOURCES=(
  /src/src/headless/wled_bridge.cpp
)

if [[ "${USE_UPSTREAM}" == "1" ]]; then
  BASE_DEFINES+=(
    -DWLED_DISABLE_2D
  )
  SOURCES+=(
    /src/src/headless/upstream_fx.cpp
    /src/src/headless/upstream_fx_particles.cpp
    /src/src/headless/upstream_host_stubs.cpp
    /src/src/headless/upstream_fastled_runtime.cpp
  )
fi

if printf '%s\n' "${SOURCES[@]}" | grep -Eq '(wled_server\.cpp|alexa\.cpp)$'; then
  echo "forbidden source file included (wled_server.cpp/alexa.cpp)" >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/src/headless/wled_bridge.cpp" ]]; then
  echo "missing bridge source" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for reproducible emscripten builds" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running; start Docker Desktop (or equivalent) and retry" >&2
  exit 1
fi

docker run --rm \
  -v "${ROOT_DIR}:/src" \
  -w /src \
  "${DOCKER_IMAGE}" \
  em++ \
  "${SOURCES[@]}" \
  "${BASE_DEFINES[@]}" \
  "${COMMON_FLAGS[@]}" \
  -o /src/public/wasm/wled.js

echo "WASM build complete: ${OUT_DIR}/wled.wasm"
