#!/bin/bash
set -e

RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"
OUTPUT="$RESULTS_DIR/routing_xypriss.txt"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

command -v xfpm >/dev/null 2>&1 || { echo "[!] xfpm not found"; exit 1; }
command -v autocannon >/dev/null 2>&1 || { echo "[!] autocannon not found. Run: xfpm i -g autocannon"; exit 1; }

echo "[*] Running XyPriss Dynamic Routing benchmark via xfpm..."
(cd "$ROOT_DIR" && xfpm run XCIS:bench.routing) | tee "$OUTPUT"

echo "[*] Done. Results saved to $OUTPUT"
