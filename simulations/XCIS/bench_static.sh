#!/bin/bash
set -e

echo "=========================================="
echo " XyPriss Fast Path Benchmark (autocannon)"
echo "=========================================="

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || (cd "$DIR/../.." && pwd))"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

echo "[*] Nettoyage des anciens processus..."
pkill -9 -f "server.ts" 2>/dev/null || true
fuser -k 5618/tcp 2>/dev/null || true
fuser -k 5628/tcp 2>/dev/null || true
sleep 1

ulimit -n 65535

echo "[*] Démarrage du serveur XCIS avec libXESS..."
fileonix -l xess --script ./src/server.ts > /dev/null 2>&1 &
SERVER_PID=$!

# Attendre que le port soit réellement ouvert
echo "[*] En attente que le port 5618 soit prêt..."
for i in $(seq 1 20); do
  if curl -s http://127.0.0.1:5618/ping > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[*] Warmup rapide (évite le cold start dans les stats)..."
autocannon -c 10 -d 3 http://127.0.0.1:5618/static/texte.txt > /dev/null

echo "[*] Lancement du benchmark principal..."
for CONNS in 100 500 1000 2000; do
  echo ""
  echo "--- Test avec $CONNS connexions ---"
  autocannon -c $CONNS -d 15 http://127.0.0.1:5618/static/texte.txt
done

echo "[*] Benchmark terminé. Arrêt du serveur XCIS."
kill $SERVER_PID 2>/dev/null || true
pkill -9 -f "server.ts" 2>/dev/null || true
echo "[*] Terminé."