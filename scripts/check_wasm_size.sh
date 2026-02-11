#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM_PATH="${ROOT_DIR}/public/wasm/wled.wasm"
MAX_BYTES=$((2 * 1024 * 1024))

if [[ ! -f "${WASM_PATH}" ]]; then
  echo "missing wasm artifact at ${WASM_PATH}" >&2
  exit 1
fi

actual_bytes=$(gzip -c "${WASM_PATH}" | wc -c | tr -d ' ')
if (( actual_bytes > MAX_BYTES )); then
  echo "gzipped wasm exceeds budget: ${actual_bytes} > ${MAX_BYTES}" >&2
  exit 1
fi

echo "wasm size budget ok: ${actual_bytes} bytes gzipped"
