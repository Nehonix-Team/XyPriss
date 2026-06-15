#!/bin/bash
# XHSC Pipeline Profiler
# Mesure le temps passé dans chaque phase pour comprendre le goulot.
set -e

SERVER_URL="http://127.0.0.1:8093/api/download"
ASSET="bench/mixed-bench/assets/dummy-500k.bin"
SAMPLES=20

echo "============================================================"
echo "  XHSC Pipeline Debug — phase-by-phase timing"
echo "============================================================"

# ── Phase 1 : latence séquentielle brute (1 connexion) ──────────
echo ""
echo "[Phase 1] Sequential latency (1 conn, no concurrency)"
echo "  → Isolates pure IPC + file-serve overhead, no queuing"
echo "---"
for i in $(seq 1 $SAMPLES); do
  curl -s -o /dev/null -w "%{time_total}\n" "$SERVER_URL"
done | awk '
  BEGIN { min=9999; max=0; sum=0; n=0 }
  { v=$1+0; sum+=v; n++; if(v<min) min=v; if(v>max) max=v }
  END { printf "  min=%.0fms  avg=%.0fms  max=%.0fms  (n=%d)\n", min*1000, (sum/n)*1000, max*1000, n }
'

# ── Phase 2 : throughput séquentiel vs Express/Fastify ──────────
echo ""
echo "[Phase 2] Sequential req/s comparison"
echo "  → If sequential is also slow, the problem is per-request, not queuing"
for URL in "http://127.0.0.1:8091/api/download" "http://127.0.0.1:8092/api/download" "$SERVER_URL"; do
  # Quick check if port is up
  curl -sf "$URL" -o /dev/null 2>/dev/null || { echo "  $URL — server not running, skip"; continue; }
  rps=$(for i in $(seq 1 10); do curl -s -o /dev/null -w "1\n" "$URL"; done | \
        awk -v start="$(date +%s%3N)" 'BEGIN { n=0 } { n++ } END { elapsed=('"$(date +%s%3N)"'-start)/1000; printf "%.1f\n", n/elapsed }')
  echo "  $URL → $rps req/s (sequential)"
done 

# ── Phase 3 : strace syscall count ──────────────────────────────
echo ""
echo "[Phase 3] Syscall breakdown on XyPriss PID"
XYP_PID=$(fuser 8093/tcp 2>/dev/null | tr ' ' '\n' | head -1)
if [ -n "$XYP_PID" ]; then
  echo "  Found XyPriss process: PID $XYP_PID"
  echo "  Running strace for 3s during 20 concurrent requests..."
  # Fire concurrent requests in background
  for i in $(seq 1 20); do curl -s -o /dev/null "$SERVER_URL" & done
  strace -c -p "$XYP_PID" -e trace=network,ipc,read,write,sendto,recvfrom sleep 3 2>&1 | \
    grep -E "(syscall|calls|read|write|send|recv|select|poll|epoll|futex|%)" || true
  wait
else
  echo "  XyPriss not detected on port 8093, skip"
fi

# ── Phase 4 : socket buffer / backlog state ──────────────────────
echo ""
echo "[Phase 4] Unix socket buffer state"
ss -x --extended 2>/dev/null | grep -i "xypriss\|xhsc" | \
  awk '{ print "  Recv-Q=" $2 " Send-Q=" $3 " " $5 }' || echo "  (no Unix sockets found)"

echo ""
echo "============================================================"
echo "  Done."
echo "============================================================"
