#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT_FILE="${ROOT_DIR}/vendor/WLED.commit"

if [[ ! -d "${ROOT_DIR}/vendor/WLED/.git" && ! -f "${ROOT_DIR}/vendor/WLED/.git" ]]; then
  echo "vendor/WLED submodule is missing" >&2
  exit 1
fi

commit=$(git -C "${ROOT_DIR}/vendor/WLED" rev-parse HEAD)
echo "${commit}" > "${COMMIT_FILE}"
echo "Pinned WLED commit: ${commit}"
