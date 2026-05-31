# XyPriss Comparative Benchmark Suite

Compares static file serving performance between:
- **Express** + `serve-static` (Node.js baseline)
- **Fastify** + `@fastify/static` (Node.js optimized baseline)
- **XyPriss XStatic** via XCIS (Go fast path)

Same file, same tool ([autocannon](https://github.com/mcollina/autocannon)), same load levels: **100 / 500 / 1,000 concurrent connections**, 15 seconds each.

---

## Prerequisites

```bash
# Node.js (v18+) required for Express & Fastify
node --version

# autocannon (global)
npm i -g autocannon

# Bun (for XCIS)
bun --version
```

---

## Setup

```bash
# Install dependencies for both baselines
cd baseline-express && npm install && cd ..
cd baseline-fastify && npm install && cd ..
```

---

## Run

### All benchmarks in sequence
```bash
bash scripts/bench_all.sh
```

### Individual benchmarks
```bash
bash scripts/bench_express.sh   # Express  → results/express.txt
bash scripts/bench_fastify.sh   # Fastify  → results/fastify.txt
bash scripts/bench_xcis.sh      # XCIS     → results/xcis.txt
```

### Custom XCIS path
By default, the XCIS script looks for your project at:
`~/Documents/projects/XyPriss/simulations/XCIS`

Override it with:
```bash
XCIS_DIR=/path/to/your/xcis bash scripts/bench_xcis.sh
```

---

## Results

All outputs are saved in `results/`. Send all three `.txt` files for analysis.

---

## Notes

- All servers run on **loopback only** (127.0.0.1) — no network overhead
- The **same `texte.txt`** file (~5 KB) is used across all servers
- Warmup phase (10c, 3s) is run before each benchmark and excluded from results
- Test is limited to 1,000 connections to keep results comparable and avoid fd limit issues
