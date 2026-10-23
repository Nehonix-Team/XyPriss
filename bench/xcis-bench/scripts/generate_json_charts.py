#!/usr/bin/env python3
"""
Nehonix XyPriss JSON API Benchmark Chart Generator
Generates publication-quality high-DPI charts for the 2026 JSON Performance Report.
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# Set styling
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

# Datasets
conns = ["100 conns", "500 conns", "1,000 conns", "2,000 conns"]
x = np.arange(len(conns))
width = 0.26

# GET /json Throughput (req/s)
get_express_rps = [7850, 0, 0, 0]  # Express socket pool exhausted at 500+ conns
get_fastify_rps = [11629, 11106, 11848, 11450]
get_xypriss_rps = [6966, 6850, 6882, 6720]

# POST /json Throughput (req/s)
post_express_rps = [6800, 0, 0, 0]  # Express socket pool exhausted at 500+ conns
post_fastify_rps = [9309, 9048, 9266, 8920]
post_xypriss_rps = [5956, 6131, 6045, 6019]

# Latency P50 (ms) for POST /json
post_express_p50 = [14.0, 0.0, 0.0, 0.0]
post_fastify_p50 = [10.0, 52.0, 102.0, 210.0]
post_xypriss_p50 = [16.0, 78.0, 161.0, 321.0]

def generate_get_chart():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    rects1 = ax.bar(x - width, get_express_rps, width, label="Express (express.json)", color="#6C757D", edgecolor="#495057", zorder=3)
    rects2 = ax.bar(x, get_fastify_rps, width, label="Fastify (fast-json-stringify)", color="#007ACC", edgecolor="#005A9E", zorder=3)
    rects3 = ax.bar(x + width, get_xypriss_rps, width, label="XyPriss (XHSC IPC + WAF)", color="#059669", edgecolor="#047857", zorder=3)

    ax.set_ylabel("Requests per Second (Throughput)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("JSON API Benchmark: GET /json Throughput by Concurrency Level\nStandard Payload (209 bytes) under 100 to 2,000 Concurrent Connections", fontsize=12, fontweight="bold", pad=16, color="#111827")
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

    y_max = max(max(get_express_rps), max(get_fastify_rps), max(get_xypriss_rps)) * 1.15
    ax.set_ylim(0, y_max)
    plt.tight_layout()

    for out_dir in [REPORT_DIR, DOCS_ASSETS_DIR]:
        plt.savefig(os.path.join(out_dir, "bench_json_get_throughput.png"), dpi=300)
    plt.close()
    print("[*] Saved bench_json_get_throughput.png")

def generate_post_chart():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    rects1 = ax.bar(x - width, post_express_rps, width, label="Express (express.json)", color="#6C757D", edgecolor="#495057", zorder=3)
    rects2 = ax.bar(x, post_fastify_rps, width, label="Fastify (fast-json-stringify)", color="#007ACC", edgecolor="#005A9E", zorder=3)
    rects3 = ax.bar(x + width, post_xypriss_rps, width, label="XyPriss (XHSC IPC + WAF)", color="#059669", edgecolor="#047857", zorder=3)

    ax.set_ylabel("Requests per Second (Throughput)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("JSON API Benchmark: POST /json (Parsing & Echo Throughput)\n1 KB JSON Payload Parsing under 100 to 2,000 Concurrent Connections", fontsize=12, fontweight="bold", pad=16, color="#111827")
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

    y_max = max(max(post_express_rps), max(post_fastify_rps), max(post_xypriss_rps)) * 1.15
    ax.set_ylim(0, y_max)
    plt.tight_layout()

    for out_dir in [REPORT_DIR, DOCS_ASSETS_DIR]:
        plt.savefig(os.path.join(out_dir, "bench_json_post_throughput.png"), dpi=300)
    plt.close()
    print("[*] Saved bench_json_post_throughput.png")

def generate_latency_chart():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    rects1 = ax.bar(x - width, post_express_p50, width, label="Express (P50)", color="#9CA3AF", edgecolor="#6B7280", zorder=3)
    rects2 = ax.bar(x, post_fastify_p50, width, label="Fastify (P50)", color="#38BDF8", edgecolor="#0284C7", zorder=3)
    rects3 = ax.bar(x + width, post_xypriss_p50, width, label="XyPriss (P50)", color="#10B981", edgecolor="#059669", zorder=3)

    ax.set_ylabel("Latency (ms, Lower is Better)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("JSON API Benchmark: POST /json Median Latency (P50)\nComparison across Concurrency Tiers (100 to 2,000 conns)", fontsize=12, fontweight="bold", pad=16, color="#111827")
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

    y_max = max(max(post_express_p50), max(post_fastify_p50), max(post_xypriss_p50)) * 1.18
    ax.set_ylim(0, y_max)
    plt.tight_layout()

    for out_dir in [REPORT_DIR, DOCS_ASSETS_DIR]:
        plt.savefig(os.path.join(out_dir, "bench_json_post_latency.png"), dpi=300)
    plt.close()
    print("[*] Saved bench_json_post_latency.png")

if __name__ == "__main__":
    generate_get_chart()
    generate_post_chart()
    generate_latency_chart()
    print("[✓] All JSON API benchmark charts generated successfully.")
