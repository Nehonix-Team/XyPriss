#!/bin/bash
# Benchmarking script for XyPriss Native Static Fast Path

set -e

echo "=========================================="
echo " XyPriss Fast Path Benchmark (autocannon)"
echo "=========================================="

cd "$(dirname "$0")"

# Assurez-vous que tous les processus restants sont tués
echo "[*] Nettoyage des anciens processus..."
killall bun 2>/dev/null || true

# Augmentation de la limite de fichiers ouverts (important pour le trafic réseau élevé)
ulimit -n 65535

# Démarrage du serveur XCIS en arrière-plan
echo "[*] Démarrage du serveur XCIS..."
bun run ./src/server.ts > /dev/null 2>&1 &
SERVER_PID=$!

# Attendre que le serveur soit prêt (y compris la connexion IPC avec Go)
echo "[*] En attente de l'initialisation du serveur (3 secondes)..."
sleep 3

echo "[*] Lancement de autocannon..."
# Test avec 2000 connexions simultanées (hautement concurrentiel)
npx autocannon -c 2000 -d 10 http://127.0.0.1:8085/static/texte.txt

echo "[*] Benchmark terminé. Arrêt du serveur XCIS."
kill $SERVER_PID 2>/dev/null || true
echo "[*] Terminé."
