#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "##############################################"
echo "#   XyPriss JSON API Benchmark Suite         #"
echo "##############################################"
echo ""

echo "[1/3] Running Express baseline (JSON API)..."
bash "$DIR/bench_json_express.sh"
echo ""

echo "[2/3] Running Fastify baseline (JSON API)..."
bash "$DIR/bench_json_fastify.sh"
echo ""

echo "[3/3] Running XyPriss (JSON API)..."
bash "$DIR/bench_json_xypriss.sh"
echo ""

echo "=============================================="
echo " All JSON benchmarks completed successfully."
echo " Results available in bench/xcis-bench/results/"
echo "=============================================="
