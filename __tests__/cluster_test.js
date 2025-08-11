import { createServer } from "../../dist";

// Enhanced configuration for testing
// All processes (master and workers) should listen on the same port for proper clustering
const serverPort = 9338;

console.log(
    `🔧 Configuring server - Worker: ${isWorker}, Port: ${serverPort}, WorkerID: ${workerId}`
);

const app = createServer({
    server: {
        port: serverPort,
        autoPortSwitch: {
            enabled: false, // Disable auto port switch for clustering
        },
    },
    workerPool: {
        enabled: true,
        config: {
            cpu: { min: 2, max: 4 }, // Increased for better testing
            io: { min: 2, max: 4 },
            maxConcurrentTasks: 20, // Increased for stress testing
        },
    },
    cluster: {
        enabled: !isWorker, // Only enable cluster management on master
        config: {
            workers: 2, // Use specific number for testing
            loadBalancing: {
                strategy: "round-robin",
            },
        },
    },
});


app.start()