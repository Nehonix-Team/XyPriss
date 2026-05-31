#!/bin/bash
set -e

RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"
OUTPUT="$RESULTS_DIR/xcis.txt"

command -v xfpm >/dev/null 2>&1 || { echo "[!] xfpm not found"; exit 1; }
command -v autocannon >/dev/null 2>&1 || { echo "[!] autocannon not found. Run: xfpm i -g autocannon"; exit 1; }

echo "[*] Running XCIS benchmark via xfpm..."
xfpm -C "." run XCIS:bench.xstatic | tee "$OUTPUT"

echo "[*] Done. Results saved to $OUTPUT"
