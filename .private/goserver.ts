import { __sys__, createServer, XyPrissSys } from "../src";

const app = createServer({
    cluster: {
        enabled: false,
        strategy: "round-robin",
        workers: 2,
        autoRespawn: true,
        resources: {
            maxMemory: "400MB",
        },
    },
    workerPool: {
        enabled: true, // Délégeons ça à Go pour qu'il s'en occupe au lieu de JS.
        config: {
            maxConcurrentTasks: 1,
            io: {
                max: 30,
                min: 10,
            },
            cpu: {
                max: 30,
                min: 10,
            },
        },
    },
});

console.log("sys info: ", (__sys__ as XyPrissSys).$battery());

// Test route to verify cluster is handling requests
app.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss XHSC Cluster",
        pid: process.pid,
        worker: process.env.XYPRISS_WORKER_ID || "standalone",
        timestamp: new Date().toISOString(),
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
    });
});

app.start(7628);

