#!/bin/bash
set -e

echo "=========================================="
echo " XyPriss JSON API Benchmark (autocannon)"
echo "=========================================="

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || (cd "$DIR/../.." && pwd))"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

echo "[*] Cleaning up old processes..."
pkill -9 -f "server.ts" 2>/dev/null || true
pkill -9 -f "xhsc-linux-amd64" 2>/dev/null || true
fuser -k 5618/tcp 2>/dev/null || true
fuser -k 5628/tcp 2>/dev/null || true
fuser -k 7628/tcp 2>/dev/null || true
sleep 1

ulimit -n 65535

echo "[*] Starting XyPriss server with libXESS..."
fileonix -l xess --script ./src/server.ts > /dev/null 2>&1 &
SERVER_PID=$!

echo "[*] Waiting for port 5618..."
for i in $(seq 1 25); do
  if curl -sf http://127.0.0.1:5618/ping > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Verify GET /json works
echo "[*] Testing GET /json endpoint..."
curl -s http://127.0.0.1:5618/json | head -c 120
echo ""

# Verify POST /json works
echo "[*] Testing POST /json endpoint..."
curl -s -X POST -H "Content-Type: application/json" -d '{"bench":"xypriss","active":true}' http://127.0.0.1:5618/json | head -c 120
echo ""

echo "[*] Warmup..."
autocannon -c 10 -d 3 http://127.0.0.1:5618/json > /dev/null

echo "=========================================="
echo " Section 1: GET /json (Serialization)"
echo "=========================================="
for CONNS in 100 500 1000 2000; do
  echo ""
  echo "--- GET /json with $CONNS connections ---"
  autocannon -c $CONNS -d 10 http://127.0.0.1:5618/json
done

echo "=========================================="
echo " Section 2: POST /json (Parsing & Echo)"
echo "=========================================="
for CONNS in 100 500 1000 2000; do
  echo ""
  echo "--- POST /json with $CONNS connections ---"
  autocannon -c $CONNS -d 10 -m POST -H "Content-Type: application/json" -b '{"user":"nehonix","id":1024,"action":"benchmark","tags":["fast","go","ts"]}' http://127.0.0.1:5618/json
done

echo "[*] Benchmark completed. Stopping XyPriss server."
kill $SERVER_PID 2>/dev/null || true
pkill -9 -f "server.ts" 2>/dev/null || true
pkill -9 -f "xhsc-linux-amd64" 2>/dev/null || true
echo "[*] Done."
