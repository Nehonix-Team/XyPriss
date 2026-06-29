#!/bin/bash
set -e

RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
mkdir -p "$RESULTS_DIR"

command -v bun >/dev/null 2>&1 || { echo "[!] bun not found"; exit 1; }
command -v autocannon >/dev/null 2>&1 || { echo "[!] autocannon not found. Run: npm i -g autocannon"; exit 1; }

echo "##############################################"
echo "#   Mixed-Route Benchmark (Auth + 500KB)     #"
echo "##############################################"

cd "$(dirname "$0")/../servers"

ulimit -n 65535

# Fonction utilitaire pour attendre le démarrage d'un serveur de manière sécurisée
wait_for_port() {
  local port=$1
  local pid=$2
  echo "[*] Waiting for port $port..."
  until curl -sf "http://127.0.0.1:$port/api/download" -o /dev/null; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[!] Le serveur sur le port $port a crashé avant de démarrer."
      exit 1
    fi
    sleep 0.2
  done
}

# Fonction utilitaire pour stopper proprement un process
stop_server() {
  local pid=$1
  if kill -0 "$pid" 2>/dev/null; then
    kill -15 "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

# ==========================================
# 1. EXPRESS
# ==========================================
echo ""
echo "[1/3] Running Express baseline..."
OUTPUT_EXP="$RESULTS_DIR/express.txt"
echo "==========================================" > "$OUTPUT_EXP"
echo " Baseline: Express" >> "$OUTPUT_EXP"
echo "==========================================" >> "$OUTPUT_EXP"

echo "[*] Starting Express server..."
node express.cjs &
SERVER_PID=$!

wait_for_port 8091 $SERVER_PID

echo "[*] Warmup..."
autocannon -c 10 -d 3 http://127.0.0.1:8091/api/download > /dev/null

for CONNS in 10 50 100; do
  echo "" >> "$OUTPUT_EXP"
  echo "--- $CONNS connections ---" | tee -a "$OUTPUT_EXP"
  autocannon -c $CONNS -d 10 -T 10 http://127.0.0.1:8091/api/download | tee -a "$OUTPUT_EXP"
done

echo "[*] Stopping Express."
stop_server $SERVER_PID
sleep 1
echo "[*] Done. Results saved to $OUTPUT_EXP"

# ==========================================
# 2. FASTIFY
# ==========================================
echo ""
echo "[2/3] Running Fastify baseline..."
OUTPUT_FAS="$RESULTS_DIR/fastify.txt"
echo "==========================================" > "$OUTPUT_FAS"
echo " Baseline: Fastify" >> "$OUTPUT_FAS"
echo "==========================================" >> "$OUTPUT_FAS"

echo "[*] Starting Fastify server..."
node fastify.cjs &
SERVER_PID=$!

wait_for_port 8092 $SERVER_PID

echo "[*] Warmup..."
autocannon -c 10 -d 3 http://127.0.0.1:8092/api/download > /dev/null

for CONNS in 10 50 100; do
  echo "" >> "$OUTPUT_FAS"
  echo "--- $CONNS connections ---" | tee -a "$OUTPUT_FAS"
  autocannon -c $CONNS -d 10 -T 10 http://127.0.0.1:8092/api/download | tee -a "$OUTPUT_FAS"
done

echo "[*] Stopping Fastify."
stop_server $SERVER_PID
sleep 1
echo "[*] Done. Results saved to $OUTPUT_FAS"

# ==========================================
# 3. XYPRISS
# ==========================================
echo ""
echo "[3/3] Running XyPriss..."
OUTPUT_XYP="$RESULTS_DIR/xypriss.txt"
echo "==========================================" > "$OUTPUT_XYP"
echo " Baseline: XyPriss (Auth + sendFile)" >> "$OUTPUT_XYP"
echo "==========================================" >> "$OUTPUT_XYP"

echo "[*] Starting XyPriss server..."
bun run xypriss.ts &
SERVER_PID=$!

# Suppression du sleep 10 redondant ici
wait_for_port 8093 $SERVER_PID

echo "[*] Warmup..."
autocannon -c 10 -d 3 http://127.0.0.1:8093/api/download > /dev/null

for CONNS in 10 50 100; do
  echo "" >> "$OUTPUT_XYP"
  echo "--- $CONNS connections ---" | tee -a "$OUTPUT_XYP"
  autocannon -c $CONNS -d 10 -T 10 http://127.0.0.1:8093/api/download | tee -a "$OUTPUT_XYP"
done

echo "[*] Stopping XyPriss."
stop_server $SERVER_PID
echo "[*] Done. Results saved to $OUTPUT_XYP"

echo ""
echo "##############################################"
echo "  All benchmarks complete."
echo "  Results saved in: results/"
echo "    - results/express.txt"
echo "    - results/fastify.txt"
echo "    - results/xypriss.txt"
echo "##############################################"