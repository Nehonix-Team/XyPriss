#!/bin/bash
set -e

PORT=8087
RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"
OUTPUT="$RESULTS_DIR/fastify.txt"

echo "==========================================" | tee "$OUTPUT"
echo " Baseline: Fastify + @fastify/static"      | tee -a "$OUTPUT"
echo "==========================================" | tee -a "$OUTPUT"

command -v node >/dev/null 2>&1 || { echo "[!] node not found"; exit 1; }
command -v autocannon >/dev/null 2>&1 || { echo "[!] autocannon not found. Run: xfpm i -g autocannon"; exit 1; }

cd "$(dirname "$0")/../baseline-fastify"
[ ! -d node_modules ] && xfpm install --silent

ulimit -n 65535

echo "[*] Starting Fastify server..." | tee -a "$OUTPUT"
node server.js &
SERVER_PID=$!

echo "[*] Waiting for port $PORT..." | tee -a "$OUTPUT"
until curl -sf http://127.0.0.1:$PORT/static/texte.txt > /dev/null; do sleep 0.3; done

echo "[*] Warmup..." | tee -a "$OUTPUT"
autocannon -c 10 -d 3 http://127.0.0.1:$PORT/static/texte.txt > /dev/null

for CONNS in 100 500 1000; do
  echo "" | tee -a "$OUTPUT"
  echo "--- $CONNS connections ---" | tee -a "$OUTPUT"
  autocannon -c $CONNS -d 15 http://127.0.0.1:$PORT/static/texte.txt | tee -a "$OUTPUT"
done

echo "[*] Stopping Fastify." | tee -a "$OUTPUT"
kill $SERVER_PID 2>/dev/null || true
echo "[*] Done. Results saved to $OUTPUT"
 