import {
    createServer,
    NetworkStats,
    ProcessInfo,
    XyPrissSys,
} from "../src/index";

const app = createServer({
    security: {
        rateLimit: {
            max: 1000000,
        },
    },
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 1000,
        },
        lifecycle: {},
        networkQuality: {
            enabled: true,
            rejectOnPoorConnection: true, // Disabled by default for normal use
            maxLatency: 500, // 500ms threshold
        },
        resilience: {
            retryEnabled: true,
            retryDelay: 100,
            circuitBreaker: {
                enabled: true,
                failureThreshold: 3,
                resetTimeout: 5000,
            },
        },
    },

    cluster: {
        enabled: true,
        workers: "auto",
        autoRespawn: true,
        strategy: "weighted-least-connections",
        resources: {
            maxMemory: "500MB",
            maxCpu: 50,
            priority: "normal", // Sets nice to 0
            fileDescriptorLimit: 10000,
            gcHint: true, // Enables --expose-gc
            memoryManagement: {
                checkInterval: 2000, // Check every 2 seconds
            },
            enforcement: {
                hardLimits: true, // Kill if exceeded
            },
            intelligence: {
                enabled: true,
                preAllocate: true,
                rescueMode: true,
            },
        },
    },

    server: {
        port: 6372,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
        },
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

app.get("/", (req, res) => {
    // console.log("Request received on /");
    res.xJson({ message: "Hello world from XP" });
});

app.get("/params/:id", (req, res) => {
    // console.log("Request received on /params/:id");
    res.xJson({ message: "Hello world from XP", params: req.params });
});

app.post("/", (req, res) => {
    console.log("Request POST method with data: ", req.body);
    res.xJson({ message: "Hello world from XP" });
});

app.get("/kill", (req, res) => {
    console.log("Request received on /kill - killing server");
    process.exit(1);
    res.xJson({ message: "Server killed" });
});

app.get("/error", (req, res) => {
    console.log("Request received on /error - simulating failure");
    // Simulate processing then fail
    setTimeout(() => {
        // We don't send a response, we crash or timeout?
        // Rust breaker counts failed requests (timeouts or disconnects).
        // Let's just not respond to force a timeout or abrupt close?
        // Actually, let's try to crash/close the connection if possible, or just timeout.
        // For now, let's rely on timeout if configured, or explicit error?
        // Wait, the Rust breaker logic we wrote counts "Request timed out or worker disconnected".
        // So we need to NOT respond.
    }, 100);
});

app.start();

