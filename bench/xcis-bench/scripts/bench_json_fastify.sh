#!/bin/bash
set -e

PORT=8087
RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"
OUTPUT="$RESULTS_DIR/json_fastify.txt"

echo "==========================================" | tee "$OUTPUT"
echo " Baseline: Fastify JSON API"                | tee -a "$OUTPUT"
echo "==========================================" | tee -a "$OUTPUT"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

command -v node >/dev/null 2>&1 || { echo "[!] node not found"; exit 1; }
command -v autocannon >/dev/null 2>&1 || { echo "[!] autocannon not found. Run: xfpm i -g autocannon"; exit 1; }

cd "$(dirname "$0")/../baseline-fastify"
[ ! -d node_modules ] && xfpm install --silent

ulimit -n 65535

echo "[*] Starting Fastify server..." | tee -a "$OUTPUT"
node server.js &
SERVER_PID=$!

echo "[*] Waiting for port $PORT..." | tee -a "$OUTPUT"
until curl -sf http://127.0.0.1:$PORT/ping > /dev/null; do sleep 0.3; done

# Verify GET /json works
echo "[*] Testing GET /json endpoint..." | tee -a "$OUTPUT"
curl -s http://127.0.0.1:$PORT/json | head -c 120 | tee -a "$OUTPUT"
echo "" | tee -a "$OUTPUT"

# Verify POST /json works
echo "[*] Testing POST /json endpoint..." | tee -a "$OUTPUT"
curl -s -X POST -H "Content-Type: application/json" -d '{"bench":"fastify","active":true}' http://127.0.0.1:$PORT/json | head -c 120 | tee -a "$OUTPUT"
echo "" | tee -a "$OUTPUT"

echo "[*] Warmup..." | tee -a "$OUTPUT"
autocannon -c 10 -d 3 http://127.0.0.1:$PORT/json > /dev/null

echo "==========================================" | tee -a "$OUTPUT"
echo " Section 1: GET /json (Serialization)"      | tee -a "$OUTPUT"
echo "==========================================" | tee -a "$OUTPUT"
for CONNS in 100 500 1000 2000; do
  echo "" | tee -a "$OUTPUT"
  echo "--- GET /json with $CONNS connections ---" | tee -a "$OUTPUT"
  autocannon -c $CONNS -d 10 http://127.0.0.1:$PORT/json | tee -a "$OUTPUT"
done

echo "==========================================" | tee -a "$OUTPUT"
echo " Section 2: POST /json (Parsing & Echo)"     | tee -a "$OUTPUT"
echo "==========================================" | tee -a "$OUTPUT"
for CONNS in 100 500 1000 2000; do
  echo "" | tee -a "$OUTPUT"
  echo "--- POST /json with $CONNS connections ---" | tee -a "$OUTPUT"
  autocannon -c $CONNS -d 10 -m POST -H "Content-Type: application/json" -b '{"user":"nehonix","id":1024,"action":"benchmark","tags":["fast","go","ts"]}' http://127.0.0.1:$PORT/json | tee -a "$OUTPUT"
done

echo "[*] Stopping Fastify." | tee -a "$OUTPUT"
kill $SERVER_PID 2>/dev/null || true
echo "[*] Done. Results saved to $OUTPUT"
