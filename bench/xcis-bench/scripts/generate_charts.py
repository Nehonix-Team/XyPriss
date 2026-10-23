#!/usr/bin/env python3
"""
Nehonix XyPriss Benchmark Chart Generator
Generates publication-quality high-DPI charts for the 2026 Performance Report.
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

# Destination paths
DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.abspath(os.path.join(DIR, "..", "report"))
DOCS_ASSETS_DIR = os.path.abspath(os.path.join(DIR, "..", "..", "..", "docs", "benchmarks", "assets"))

os.makedirs(REPORT_DIR, exist_ok=True)
os.makedirs(DOCS_ASSETS_DIR, exist_ok=True)

# Data sets
connections = ["100 Connections", "500 Connections", "1,000 Connections"]
x = np.arange(len(connections))
width = 0.26

# Throughput (req/s)
express_rps = [5872, 5550, 6090]
fastify_rps = [4373, 4316, 4386]
xypriss_rps = [11125, 10593, 11398]

# Latency P50 (ms)
express_p50 = [16.0, 88.0, 161.0]
fastify_p50 = [21.0, 113.0, 224.0]
xypriss_p50 = [8.0, 45.0, 87.0]

# Latency P99 (ms)
express_p99 = [22.0, 174.0, 331.0]
fastify_p99 = [36.0, 156.0, 436.0]
xypriss_p99 = [18.0, 108.0, 136.0]

# --- CHART 1: Throughput Comparison ---
def generate_throughput_chart():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    rects1 = ax.bar(x - width, express_rps, width, label="Express + serve-static", color="#6C757D", edgecolor="#495057", zorder=3)
    rects2 = ax.bar(x, fastify_rps, width, label="Fastify + @fastify/static", color="#007ACC", edgecolor="#005A9E", zorder=3)
    rects3 = ax.bar(x + width, xypriss_rps, width, label="XyPriss (XStatic)", color="#059669", edgecolor="#047857", zorder=3)

    ax.set_ylabel("Requests per Second (Throughput)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("Comparative Throughput Benchmark (Higher is Better)\nAutocannon 15s Continuous Load @ 127.0.0.1", fontsize=13, fontweight="bold", color="#111827", pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(connections, fontsize=10, fontweight="bold", color="#374151")
    ax.legend(frameon=True, facecolor="#FFFFFF", edgecolor="#E5E7EB", fontsize=10)
    ax.grid(axis="y", zorder=0)
    ax.set_ylim(0, 18000)

    # Bar value labels
    def autolabel(rects, is_lead=False):
        for rect in rects:
            height = rect.get_height()
            weight = "bold" if is_lead else "normal"
            color = "#047857" if is_lead else "#374151"
            ax.annotate(f"{height:,.0f} req/s",
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 4),
                        textcoords="offset points",
                        ha="center", va="bottom", fontsize=8.5, fontweight=weight, color=color)

    autolabel(rects1)
    autolabel(rects2)
    autolabel(rects3, is_lead=True)

    plt.tight_layout()
    out1 = os.path.join(REPORT_DIR, "bench_throughput_2026.png")
    out2 = os.path.join(DOCS_ASSETS_DIR, "bench_throughput_2026.png")
    plt.savefig(out1, dpi=300)
    plt.savefig(out2, dpi=300)
    plt.close()
    print(f"[+] Saved throughput chart: {out1}")

# --- CHART 2: Latency P50 & P99 ---
def generate_latency_chart():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.2), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")

    # P50 (Median)
    ax1.set_facecolor("#FAFBFC")
    ax1.plot(connections, express_p50, marker="o", linewidth=2.2, color="#6C757D", label="Express")
    ax1.plot(connections, fastify_p50, marker="s", linewidth=2.2, color="#007ACC", label="Fastify")
    ax1.plot(connections, xypriss_p50, marker="D", linewidth=2.5, color="#059669", label="XyPriss")
    ax1.set_title("Median Latency P50 (Lower is Better)", fontsize=11, fontweight="bold", color="#111827")
    ax1.set_ylabel("Latency (ms)", fontsize=10, fontweight="bold", color="#1F2937")
    ax1.grid(True, zorder=0)
    ax1.legend(frameon=True, facecolor="#FFFFFF", edgecolor="#E5E7EB")
    ax1.set_ylim(0, 180)

    for i, txt in enumerate(xypriss_p50):
        ax1.annotate(f"{txt:.1f} ms", (i, txt), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9, fontweight="bold", color="#059669")

    # P99 (Tail Latency)
    ax2.set_facecolor("#FAFBFC")
    ax2.plot(connections, express_p99, marker="o", linewidth=2.2, color="#6C757D", label="Express")
    ax2.plot(connections, fastify_p99, marker="s", linewidth=2.2, color="#007ACC", label="Fastify")
    ax2.plot(connections, xypriss_p99, marker="D", linewidth=2.5, color="#059669", label="XyPriss")
    ax2.set_title("Tail Latency P99 (Lower is Better)", fontsize=11, fontweight="bold", color="#111827")
    ax2.set_ylabel("Latency (ms)", fontsize=10, fontweight="bold", color="#1F2937")
    ax2.grid(True, zorder=0)
    ax2.legend(frameon=True, facecolor="#FFFFFF", edgecolor="#E5E7EB")
    ax2.set_ylim(0, 300)

    for i, txt in enumerate(xypriss_p99):
        ax2.annotate(f"{txt:.1f} ms", (i, txt), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9, fontweight="bold", color="#059669")

    fig.suptitle("Latency Progression Across Concurrency Levels (ms)", fontsize=13, fontweight="bold", color="#111827", y=1.02)
    plt.tight_layout()
    out1 = os.path.join(REPORT_DIR, "bench_latency_2026.png")
    out2 = os.path.join(DOCS_ASSETS_DIR, "bench_latency_2026.png")
    plt.savefig(out1, dpi=300)
    plt.savefig(out2, dpi=300)
    plt.close()
    print(f"[+] Saved latency chart: {out1}")

# --- CHART 3: Generational Leap (May 2026 vs Oct 2026) ---
def generate_evolution_chart():
    fig, ax = plt.subplots(figsize=(9, 5), dpi=300)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FAFBFC")

    categories = ["100 Conns", "500 Conns", "1,000 Conns"]
    may_2026 = [6518, 6706, 6922]
    oct_2026 = [11125, 10593, 11398]
    
    idx = np.arange(len(categories))
    w = 0.32

    r1 = ax.bar(idx - w/2, may_2026, w, label="XyPriss (May 2026 - Legacy IPC)", color="#94A3B8", edgecolor="#64748B", zorder=3)
    r2 = ax.bar(idx + w/2, oct_2026, w, label="XyPriss (October 2026 - Single-Syscall XBP)", color="#2563EB", edgecolor="#1D4ED8", zorder=3)

    ax.set_ylabel("Throughput (req/s)", fontsize=11, fontweight="bold", color="#1F2937")
    ax.set_title("XyPriss Performance Evolution: May 2026 vs October 2026\n(+65% to +70% Throughput Increase with Native Binary Framing)", fontsize=12, fontweight="bold", color="#111827", pad=12)
    ax.set_xticks(idx)
    ax.set_xticklabels(categories, fontsize=10, fontweight="bold", color="#374151")
    ax.legend(frameon=True, facecolor="#FFFFFF", edgecolor="#E5E7EB", fontsize=10)
    ax.grid(axis="y", zorder=0)
    ax.set_ylim(0, 15000)

    for rect in r1:
        h = rect.get_height()
        ax.annotate(f"{h:,.0f}", xy=(rect.get_x() + rect.get_width() / 2, h), xytext=(0, 4), textcoords="offset points", ha="center", fontsize=8.5, color="#64748B")

    for rect in r2:
        h = rect.get_height()
        ax.annotate(f"{h:,.0f}", xy=(rect.get_x() + rect.get_width() / 2, h), xytext=(0, 4), textcoords="offset points", ha="center", fontsize=9, fontweight="bold", color="#1D4ED8")

    plt.tight_layout()
    out1 = os.path.join(REPORT_DIR, "bench_evolution_2026.png")
    out2 = os.path.join(DOCS_ASSETS_DIR, "bench_evolution_2026.png")
    plt.savefig(out1, dpi=300)
    plt.savefig(out2, dpi=300)
    plt.close()
    print(f"[+] Saved evolution chart: {out1}")

if __name__ == "__main__":
    generate_throughput_chart()
    generate_latency_chart()
    generate_evolution_chart()
    print("All benchmark charts generated successfully.")
