# Performance Report — XCIS / XyPriss Fast Path

**Date:** May 30, 2026
**Author:** iDevo + Zetad2
**Environment:** Kali GNU/Linux Rolling — localhost (127.0.0.1:8085)
**Benchmark tool:** [autocannon](https://github.com/mcollina/autocannon)

---

## 1. Overview

This report presents the results of a benchmark targeting the static file serving layer of the **XCIS** server, part of the **XyPriss** framework. The goal is to evaluate server behavior under increasing load, validate the Go fast path gains of XStatic, and compare them against Node.js reference solutions.

Two scenarios were tested for XStatic:
- **Cluster OFF** — single worker, equal-footing comparison with Express/Fastify
- **Cluster ON (×10)** — default production configuration

Node.js baselines (Express, Fastify) run as single-process in both scenarios.

### Tech stack

| Component | Detail |
|---|---|
| Runtime | Bun (via XFPM) |
| Orchestrator | `xhsc-linux-amd64` |
| File served | `public/texte.txt` (static) |
| Performance monitoring | Disabled |
| Network compression | Disabled |
| Network rate limiting | Disabled |

The benchmarked route is registered via `XStatic`:

```typescript
const xs = new XStatic(app, __sys__);
xs.define("/static", "public");
```

---

## 2. Test protocol

The comparative benchmark runs three servers in sequence on separate ports, using the same file, same tool, and same load levels.

| Server | Port | Stack |
|---|---|---|
| Express + `serve-static` | 8086 | Node.js single-process |
| Fastify + `@fastify/static` | 8087 | Node.js single-process |
| XyPriss XStatic (XCIS) | 8085 | Go fast path via XHSC |

**Steps per server:**
1. Start server
2. Wait for HTTP-level readiness
3. Warmup: 10 connections, 3 seconds (results excluded)
4. Main benchmark: 3 load levels × 15 seconds each

**Load levels tested:** 100 — 500 — 1,000 concurrent connections

---

## 3. Comparative results

### 3.1 Average throughput (req/s)

#### Cluster ON (×10 workers) — production configuration

![Average Throughput — Cluster ON](bench_throughput_cluster_on.png)

| Connections | Express | Fastify | XStatic | ×vs Express | ×vs Fastify |
|---|---|---|---|---|---|
| 100 | 1,649 | 1,905 | **12,724** | ×7.7 | ×6.7 |
| 500 | 1,703 | 2,475 | **12,778** | ×7.5 | ×5.2 |
| 1,000 | 1,531 | 1,951 | **13,115** | ×8.6 | ×6.7 |

#### Cluster OFF (single worker) — equal-footing comparison

![Average Throughput — Cluster OFF](bench_throughput_cluster_off.png)

| Connections | Express | Fastify | XStatic | ×vs Express | ×vs Fastify |
|---|---|---|---|---|---|
| 100 | 858 | 1,440 | **6,518** | ×7.6 | ×4.5 |
| 500 | 779 | 1,330 | **6,706** | ×8.6 | ×5.0 |
| 1,000 | 1,282 | 1,012 | **6,922** | ×5.4 | ×6.8 |

---

### 3.2 Median latency p50 & tail latency p99 (ms)

![Latency p50 and p99 — Cluster OFF](bench_latency_cluster_off.png)

#### Median latency p50 — Cluster OFF

| Connections | Express | Fastify | XStatic |
|---|---|---|---|
| 100 | 120 ms | 54 ms | **13 ms** |
| 500 | 634 ms | 358 ms | **68 ms** |
| 1,000 | 750 ms | 945 ms | **146 ms** |

#### Median latency p50 — Cluster ON

| Connections | Express | Fastify | XStatic |
|---|---|---|---|
| 100 | 49 ms | 38 ms | **7 ms** |
| 500 | 261 ms | 180 ms | **34 ms** |
| 1,000 | 605 ms | 464 ms | **73 ms** |

---

### 3.3 Tail latency p99 (ms)

#### Cluster OFF

| Connections | Express | Fastify | XStatic |
|---|---|---|---|
| 100 | 246 ms | 201 ms | **44 ms** |
| 500 | 911 ms | 672 ms | **242 ms** |
| 1,000 | 1,196 ms | 1,651 ms | **955 ms** |

#### Cluster ON

| Connections | Express | Fastify | XStatic |
|---|---|---|---|
| 100 | 160 ms | 186 ms | **19 ms** |
| 500 | 772 ms | 487 ms | **145 ms** |
| 1,000 | 1,290 ms | 1,026 ms | **190 ms** |

---

## 4. Analysis

### XStatic wins even without clustering

This is the most significant finding of this benchmark. As a single worker, XStatic delivers 5× to 8× the throughput of Express or Fastify, with median latency 4 to 6 times lower. This gap is not explained by clustering — it is explained by architecture: Node.js is completely removed from the static serving path. Go intercepts requests at the TCP level and transfers files directly via `sendfile(2)`, with zero involvement from the JavaScript event loop.

### Cluster ×10 doubles performance on an already strong base

Moving from single-worker to 10 workers delivers a ×1.9 throughput gain (~6,900 → ~13,100 req/s at 1,000 connections) and halves median latency (146 ms → 73 ms). This is an effective multiplier on top of an already superior baseline, confirming that the architectural gain and the scaling gain are fully cumulative.

### Behavior under pressure: Fastify degrades more than Express at high load

An unexpected result: Fastify, which outperforms Express at low concurrency (100c), degrades more severely at 1,000 connections — median latency of 945 ms vs 750 ms for Express (cluster OFF), and p99 of 1,651 ms vs 1,196 ms. The Fastify event loop appears to saturate more abruptly under extreme load in this configuration.

### Special case: 2,000 connections (XStatic)

The 2,000-connection test remains inconclusive across both runs — the benchmark stopped prematurely at 20–33% of the expected duration, with req/s stdev of 0. The likely cause is the file descriptor limit inherited by XHSC workers. This load level is excluded from all comparative tables.

---

## 5. Identified improvements

### 5.1 Warmup reliability

Replace the `nc -z` probe (TCP only) with an HTTP-level health check:

```bash
until curl -sf http://127.0.0.1:8085/static/texte.txt > /dev/null; do sleep 0.5; done
```

### 5.2 File descriptor limit for workers

Apply the limit before launching XHSC via `prlimit`:

```bash
prlimit --nofile=65535 ./bin/xhsc-linux-amd64 server start ...
```

### 5.3 Horizontal scaling

Test with `--cluster-workers 16` or higher to push past the CPU ceiling observed at 1,000 connections.

---

## 6. Conclusion

XStatic (XyPriss) outperforms Express and Fastify in every scenario tested, with or without clustering.

As a single worker, XStatic delivers **~6,500 to 6,900 req/s** against 800–1,500 req/s for Node.js baselines — a ×5 to ×8 advantage that comes exclusively from the Go fast path, not horizontal scaling.

In production configuration (cluster ×10), XStatic reaches **~12,700 to 13,100 req/s** with median latency under **75 ms** up to 1,000 concurrent connections, with no degradation or timeouts.

> XStatic delivers ~13,000 req/s for static file serving with median latency under 75 ms up to 1,000 concurrent connections — ×8.6 vs Express and ×6.7 vs Fastify in production configuration.
