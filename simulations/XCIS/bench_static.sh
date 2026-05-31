#!/bin/bash
set -e

echo "=========================================="
echo " XyPriss Fast Path Benchmark (autocannon)"
echo "=========================================="

cd "$(dirname "$0")"

echo "[*] Nettoyage des anciens processus..."
killall bun 2>/dev/null || true

ulimit -n 65535

echo "[*] Démarrage du serveur XCIS..."
bun run ./src/server.ts > /dev/null 2>&1 &
SERVER_PID=$!

# Attendre que le port soit réellement ouvert (plus fiable que sleep fixe)
echo "[*] En attente que le port 8085 soit prêt..."
for i in $(seq 1 15); do
  nc -z 127.0.0.1 8085 2>/dev/null && break
  sleep 1
done

echo "[*] Warmup rapide (évite le cold start dans les stats)..."
autocannon -c 10 -d 3 http://127.0.0.1:8085/static/texte.txt > /dev/null

echo "[*] Lancement du benchmark principal..."
for CONNS in 100 500 1000 2000; do
  echo ""
  echo "--- Test avec $CONNS connexions ---"
  autocannon -c $CONNS -d 15 http://127.0.0.1:8085/static/texte.txt
done

echo "[*] Benchmark terminé. Arrêt du serveur XCIS."
kill $SERVER_PID 2>/dev/null || true
echo "[*] Terminé."