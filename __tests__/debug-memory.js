// Debug memory detection
import { createServer } from "../src/index.ts";

console.log("🔍 Debugging memory detection...");

async function debugMemory() {
    // Check Node.js os module values
    const os = require("os");
    console.log("=== Node.js os module ===");
    console.log("Total memory:", Math.round(os.totalmem() / 1024 / 1024), "MB");
    console.log("Free memo ry:", Math.round(os.freemem() / 1024 / 1024), "MB");

    // Check /proc/meminfo directly
    console.log("\n=== /proc/meminfo ===");
    try {
        const fs = require("fs");
        const meminfo = fs.readFileSync("/proc/meminfo", "utf8");

        const lines = meminfo.split("\n").slice(0, 10); // First 10 lines
        for (const line of lines) {
            if (
                line.includes("MemTotal") ||
                line.includes("MemFree") ||
                line.includes("MemAvailable") ||
                line.includes("Buffers") ||
                line.includes("Cached")
            ) {
                console.log(line);
            }
        }
    } catch (error) {
        console.log("Error reading /proc/meminfo:", error.message);
    }

    // Test the actual memory manager
    console.log("\n=== MemoryManager Results ===");
    try {
        const app = createServer({
            logging: { enabled: false },
            cluster: { enabled: true },
        });

        // Access the cluster manager to get memory stats
        const clusterManager = app.clusterManager;
        if (clusterManager && clusterManager.memoryManager) {
            const memStats =
                await clusterManager.memoryManager.getSystemMemoryStats();
            console.log(
                "Total memory:",
                Math.round(memStats.totalMemory / 1024 / 1024),
                "MB"
            );
            console.log(
                "Free memory:",
                Math.round(memStats.freeMemory / 1024 / 1024),
                "MB"
            );
            console.log(
                "Used memory:",
                Math.round(memStats.usedMemory / 1024 / 1024),
                "MB"
            );
            console.log(
                "Usage percentage:",
                Math.round(memStats.usagePercentage),
                "%"
            );
        } else {
            console.log("Could not access memory manager");
        }
    } catch (error) {
        console.log("Error getting memory stats:", error.message);
    }

    // Check system memory with free command
    console.log("\n=== System 'free' command ===");
    try {
        const proc = Bun.spawn(["free", "-m"], {
            stdout: "pipe",
        });
        const output = await new Response(proc.stdout).text();
        console.log(output);
    } catch (error) {
        console.log("Error running 'free' command:", error.message);
    }
}

debugMemory()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Debug failed:", err);
        process.exit(1);
    });

