#!/bin/bash
set -e

PORT=8085
WAIT=8  # Workers need ~6s to boot in cluster mode

echo "=== CSRF Security Validation ==="
echo ""

# Kill any leftover server
lsof -ti :$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "[*] Starting XyPriss server (cluster: 10 workers)..."
bun run src/server.ts > server.log 2>&1 &
SERVER_PID=$!
echo "[*] Waiting ${WAIT}s for workers to register..."
sleep $WAIT

# Verify server is alive
if ! curl -s --max-time 2 http://localhost:$PORT/ping > /dev/null 2>&1; then
    echo "[!] Server not responding on port $PORT. Check server.log"
    kill -9 $SERVER_PID 2>/dev/null || true
    exit 1
fi
echo "[OK] Server is up."
echo ""

# --- Test 1: Get CSRF token ---
echo "--- TEST 1: GET /csrf-token ---"
RESPONSE=$(curl -s -c cookie.jar http://localhost:$PORT/csrf-token)
echo "Response: $RESPONSE"
TOKEN=$(echo "$RESPONSE" | grep -oP '"token"\s*:\s*"\K[^"]+' || true)

if [ -z "$TOKEN" ]; then
    echo "[FAIL] Could not extract CSRF token."
    kill -9 $SERVER_PID 2>/dev/null || true
    rm -f cookie.jar
    exit 1
fi
echo "[OK] Token: ${TOKEN:0:32}..."
echo ""

# --- Test 2: POST without token (must be rejected) ---
echo "--- TEST 2: POST /csrf-test WITHOUT token (expect 403) ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:$PORT/csrf-test -b cookie.jar)
echo "HTTP Status: $STATUS"
if [ "$STATUS" = "403" ]; then
    echo "[OK] Correctly rejected (403)."
else
    echo "[WARN] Expected 403, got $STATUS."
fi
echo ""

# --- Test 3: POST with valid token (must pass) ---
echo "--- TEST 3: POST /csrf-test WITH valid token (expect 200) ---"
BODY=$(curl -s -w "\n%{http_code}" -X POST http://localhost:$PORT/csrf-test \
    -b cookie.jar \
    -H "x-csrf-token: $TOKEN" \
    -H "Content-Type: application/json")
STATUS=$(echo "$BODY" | tail -1)
RESP=$(echo "$BODY" | head -n -1)
echo "Response: $RESP"
echo "HTTP Status: $STATUS"
if [ "$STATUS" = "200" ]; then
    echo "[OK] CSRF check passed with valid token."
else
    echo "[WARN] Expected 200, got $STATUS."
fi
echo ""

# Cleanup
echo "[*] Cleaning up..."
kill -9 $SERVER_PID 2>/dev/null || true
rm -f cookie.jar
echo "=== Done ==="
