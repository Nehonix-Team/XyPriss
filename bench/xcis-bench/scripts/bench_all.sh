#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$DIR/../results"
mkdir -p "$RESULTS_DIR"

echo ""
echo "##############################################"
echo "#   XyPriss Comparative Benchmark Suite     #"
echo "##############################################"
echo ""

# Make sure no server is left running on our ports
for PORT in 8085 8086 8087; do
  fuser -k ${PORT}/tcp 2>/dev/null || true
done
sleep 1

echo "[1/3] Running Express baseline..."
bash "$DIR/bench_express.sh"
sleep 2

echo ""
echo "[2/3] Running Fastify baseline..."
bash "$DIR/bench_fastify.sh"
sleep 2

echo ""
echo "[3/3] Running XCIS (XyPriss XStatic)..."
bash "$DIR/bench_xcis.sh"
sleep 1

echo ""
echo "##############################################"
echo "  All benchmarks complete."
echo "  Results saved in: results/"
echo "    - results/express.txt"
echo "    - results/fastify.txt"
echo "    - results/xcis.txt"
echo "##############################################"
