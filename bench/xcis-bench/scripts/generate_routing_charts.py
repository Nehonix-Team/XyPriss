#!/usr/bin/env python3
"""
Nehonix XyPriss Dynamic Routing Benchmark Chart Generator
Generates publication-quality high-DPI charts for the 2026 Dynamic Routing Performance Report.
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# Styling
plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Helvetica", "Arial"]
plt.rcParams["axes.edgecolor"] = "#D0D7DE"
plt.rcParams["axes.linewidth"] = 0.8
plt.rcParams["grid.color"] = "#E1E4E8"
plt.rcParams["grid.linestyle"] = "--"
plt.rcParams["grid.alpha"] = 0.6

DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.abspath(os.path.join(DIR, "..", "report"))
DOCS_ASSETS_DIR = os.path.abspath(os.path.join(DIR, "..", "..", "..", "docs", "benchmarks", "assets"))

os.makedirs(REPORT_DIR, exist_ok=True)
os.makedirs(DOCS_ASSETS_DIR, exist_ok=True)

conns = ["100 conns", "500 conns", "1,000 conns", "2,000 conns"]
x = np.arange(len(conns))
width = 0.26

# Throughput (req/s)
express_rps = [6244, 6631, 6345, 6206]
fastify_rps = [11159, 11062, 11358, 10939]
xypriss_rps = [4413, 5656, 5714, 5588]

# Latency P99 (ms)
express_p99 = [34.0, 151.0, 266.0, 506.0]
fastify_p99 = [13.0, 85.0, 142.0, 450.0]
xypriss_p99 = [55.0, 185.0, 422.0, 680.0]

def generate_throughput_chart():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    rects1 = ax.bar(x - width, express_rps, width, label="Express (path-to-regexp)", color="#6C757D", edgecolor="#495057", zorder=3)
    rects2 = ax.bar(x, fastify_rps, width, label="Fastify (find-my-way)", color="#007ACC", edgecolor="#005A9E", zorder=3)
    rects3 = ax.bar(x + width, xypriss_rps, width, label="XyPriss (RouteManager + WAF)", color="#059669", edgecolor="#047857", zorder=3)

    ax.set_ylabel("Requests per Second (Throughput)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("Dynamic Routing Benchmark: Parametric Route Matching & URL Extraction\nTarget: /api/v1/orgs/:orgId/projects/:projectId/issues/:issueId with 50 Background Routes", fontsize=11, fontweight="bold", pad=16, color="#111827")
    ax.set_xticks(x)
    ax.set_xticklabels(conns, fontsize=10, fontweight="600")
    ax.legend(frameon=True, facecolor="#FFFFFF", edgecolor="#E5E7EB", fontsize=10, loc="upper right")
    ax.grid(axis="y", zorder=0)

    for rects in [rects1, rects2, rects3]:
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f"{height:,.0f}",
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 4),
                        textcoords="offset points",
                        ha="center", va="bottom", fontsize=8.5, fontweight="600", color="#374151")

    y_max = max(max(express_rps), max(fastify_rps), max(xypriss_rps)) * 1.15
    ax.set_ylim(0, y_max)
    plt.tight_layout()

    for out_dir in [REPORT_DIR, DOCS_ASSETS_DIR]:
        plt.savefig(os.path.join(out_dir, "bench_routing_throughput.png"), dpi=300)
    plt.close()
    print("[*] Saved bench_routing_throughput.png")

def generate_p99_chart():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    rects1 = ax.bar(x - width, express_p99, width, label="Express (P99 Latency)", color="#9CA3AF", edgecolor="#6B7280", zorder=3)
    rects2 = ax.bar(x, fastify_p99, width, label="Fastify (P99 Latency)", color="#38BDF8", edgecolor="#0284C7", zorder=3)
    rects3 = ax.bar(x + width, xypriss_p99, width, label="XyPriss (P99 Latency)", color="#10B981", edgecolor="#059669", zorder=3)

    ax.set_ylabel("P99 Tail Latency (ms, Lower is Better)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("Dynamic Routing Benchmark: P99 Tail Latency Comparison\nEvaluation across Concurrency Tiers (100 to 2,000 conns)", fontsize=11, fontweight="bold", pad=16, color="#111827")
    ax.set_xticks(x)
    ax.set_xticklabels(conns, fontsize=10, fontweight="600")
    ax.legend(frameon=True, facecolor="#FFFFFF", edgecolor="#E5E7EB", fontsize=10, loc="upper left")
    ax.grid(axis="y", zorder=0)

    for rects in [rects1, rects2, rects3]:
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f"{height:.0f} ms",
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 4),
                        textcoords="offset points",
                        ha="center", va="bottom", fontsize=8.5, fontweight="600", color="#374151")

    y_max = max(max(express_p99), max(fastify_p99), max(xypriss_p99)) * 1.18
    ax.set_ylim(0, y_max)
    plt.tight_layout()

    for out_dir in [REPORT_DIR, DOCS_ASSETS_DIR]:
        plt.savefig(os.path.join(out_dir, "bench_routing_p99_latency.png"), dpi=300)
    plt.close()
    print("[*] Saved bench_routing_p99_latency.png")

if __name__ == "__main__":
    generate_throughput_chart()
    generate_p99_chart()
    print("[✓] All Dynamic Routing benchmark charts generated successfully.")
