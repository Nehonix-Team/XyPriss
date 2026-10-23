#!/bin/bash
set -e

PORT=8087
RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"
OUTPUT="$RESULTS_DIR/routing_fastify.txt"

echo "==========================================" | tee "$OUTPUT"
echo " Baseline: Fastify Dynamic Routing"         | tee -a "$OUTPUT"
echo "==========================================" | tee -a "$OUTPUT"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

cd "$(dirname "$0")/../baseline-fastify"
ulimit -n 65535

echo "[*] Starting Fastify server..." | tee -a "$OUTPUT"
node server.js &
SERVER_PID=$!

echo "[*] Waiting for port $PORT..." | tee -a "$OUTPUT"
until curl -sf http://127.0.0.1:$PORT/ping > /dev/null; do sleep 0.3; done

TARGET_URL="http://127.0.0.1:$PORT/api/v1/orgs/nehonix-corp/projects/xypriss-core/issues/4096?filter=open&sort=desc"

echo "[*] Verifying target parametric route..." | tee -a "$OUTPUT"
curl -s "$TARGET_URL" | head -c 120 | tee -a "$OUTPUT"
echo "" | tee -a "$OUTPUT"

echo "[*] Warmup..." | tee -a "$OUTPUT"
autocannon -c 10 -d 3 "$TARGET_URL" > /dev/null

echo "==========================================" | tee -a "$OUTPUT"
echo " Section: Parametric Route Matching"        | tee -a "$OUTPUT"
echo "==========================================" | tee -a "$OUTPUT"
for CONNS in 100 500 1000 2000; do
  echo "" | tee -a "$OUTPUT"
  echo "--- Dynamic Route with $CONNS connections ---" | tee -a "$OUTPUT"
  autocannon -c $CONNS -d 10 "$TARGET_URL"
done

echo "[*] Stopping Fastify." | tee -a "$OUTPUT"
kill $SERVER_PID 2>/dev/null || true
echo "[*] Done. Results saved to $OUTPUT"
