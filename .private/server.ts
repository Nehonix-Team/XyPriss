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
            maxMemory: "1GB",
            maxCpu: 80,
            priority: "normal", // Sets nice to 0
            fileDescriptorLimit: 10000,
            gcHint: true, // Enables --expose-gc
            memoryManagement: {
                checkInterval: 2000, // Check every 2 seconds
            },
            enforcement: {
                hardLimits: true, // Kill if exceeded
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

/**
 *  // Resource Management
    resources?: {
        maxMemoryPerWorker?: string; // e.g., "1GB", "512MB"
        maxCpuPerWorker?: number; // CPU limit percentage
        priorityLevel?: "low" | "normal" | "high" | "critical";
        fileDescriptorLimit?: number;
        networkConnections?: {
            max?: number;
            timeout?: number;
        };

        // Enhanced Memory Management
        memoryManagement?: {
            enabled?: boolean; // Enable memory management (default: true)
            maxTotalMemory?: string; // Max total cluster memory (e.g., "4GB", "50%")
            memoryCheckInterval?: number; // Memory check interval in ms (default: 30000)
            memoryWarningThreshold?: number; // Warning threshold as percentage (default: 80)
            memoryCriticalThreshold?: number; // Critical threshold as percentage (default: 95)
            autoScaleOnMemory?: boolean; // Auto scale down when memory is high (default: true)
            memoryLeakDetection?: boolean; // Detect memory leaks in workers (default: true)
            garbageCollectionHint?: boolean; // Send GC hints to workers (default: false)
            lowMemoryMode?: boolean; // Enable low memory optimizations (default: false)
            memoryReservation?: string; // Reserve memory for system (e.g., "1GB")
            swapUsageLimit?: number; // Max swap usage percentage (default: 10)
        };

        // Performance Optimization
        performanceOptimization?: {
            enabled?: boolean; // Enable performance optimizations (default: true)
            lowMemoryMode?: boolean; // Optimize for low memory environments
            reducedLogging?: boolean; // Reduce logging to save memory
            compactMetrics?: boolean; // Use compact metrics storage
            lazyWorkerInit?: boolean; // Initialize workers on-demand
            workerPooling?: boolean; // Reuse worker processes when possible
            memoryPooling?: boolean; // Use memory pooling for buffers
            disableDebugFeatures?: boolean; // Disable debug features in production
            minimalFootprint?: boolean; // Minimize memory footprint
            efficientDataStructures?: boolean; // Use memory-efficient data structures
        };

        // Resource Limits Enforcement
        enforcement?: {
            enabled?: boolean; // Enable resource limit enforcement (default: true)
            enforceHardLimits?: boolean; // Enforce hard limits (kill worker if exceeded)
            softLimitWarnings?: boolean; // Log warnings when soft limits are approached
            gracefulDegradation?: boolean; // Gracefully degrade performance instead of killing
            resourceThrottling?: boolean; // Throttle resources instead of hard limits
            alertOnLimitReached?: boolean; // Send alerts when limits are reached
        };
    };

 */

