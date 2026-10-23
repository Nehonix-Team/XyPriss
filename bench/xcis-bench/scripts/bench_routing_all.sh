#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "##############################################"
echo "#   XyPriss Dynamic Routing Benchmark Suite  #"
echo "##############################################"
echo ""

echo "[1/3] Running Express baseline (Dynamic Routing)..."
bash "$DIR/bench_routing_express.sh"
echo ""

echo "[2/3] Running Fastify baseline (Dynamic Routing)..."
bash "$DIR/bench_routing_fastify.sh"
echo ""

echo "[3/3] Running XyPriss (Dynamic Routing)..."
bash "$DIR/bench_routing_xypriss.sh"
echo ""

echo "=============================================="
echo " All Routing benchmarks completed."
echo " Results available in bench/xcis-bench/results/"
echo "=============================================="
