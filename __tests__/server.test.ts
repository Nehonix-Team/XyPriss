import { createServer, func, Hash, fObject } from "..";
import { SecureRandom } from "../core";

const app = createServer({
    fileWatcher: {
        enabled: true,
        watchPaths: ["src", "lib"],
        ignorePaths: [
            "node_modules",
            ".git",
            ".vscode",
            ".idea",
            "dist",
            "build",
            "coverage",
            ".next",
            ".cache",
            "tmp",
            "temp",
            "logs",
        ],
    },
    cluster: {
        enabled: false,
        config: {
            workers: "auto",
            processManagement: {
                respawn: true,
                maxRestarts: 5,
                restartDelay: 1000,
                gracefulShutdownTimeout: 30000,
                killTimeout: 5000,
                zombieDetection: true,
                memoryThreshold: "512MB",
                cpuThreshold: 80,
            },
            healthCheck: {
                enabled: true,
                interval: 30000,
                timeout: 5000,
                maxFailures: 3,
                endpoint: "/health",
            },
            loadBalancing: {
                strategy: "round-robin",
                stickySession: false,
            },
            ipc: {
                enabled: true,
                broadcast: true,
            },
            autoScaling: {
                enabled: true,
                minWorkers: 1,
                maxWorkers: 8,
            },
        },
    },
});

app.get("/test", async (req, res) => {
    const bytes = SecureRandom.getRandomBytes(32);
    res.send(
        "Hello World from Nehonix XyPrissSecurity: " + bytes.toString("hex")
    );
});

console.error("Hello error world");
await app.start(5378);

