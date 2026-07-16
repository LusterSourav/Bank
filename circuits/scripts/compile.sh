#!/usr/bin/env bash
set -euo pipefail
# ponytail: compile Noir circuits for browser proving. requires nargo (>=0.36).
# install: curl -L https://raw.githubusercontent.com/noir-lang/noir/master/install.sh | bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/../frontend/public/circuits"
mkdir -p "$OUT"
cd "$ROOT"
nargo compile --workspace --output-dir "$OUT"
echo "compiled circuits to ${OUT}"
