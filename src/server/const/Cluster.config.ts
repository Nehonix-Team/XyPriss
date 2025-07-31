// ===== DEFAULT CONFIGURATIONS =====

export const DEFAULT_CLUSTER_CONFIGS = {
    enabled: true,
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
        cooldownPeriod: 300000,
        scaleStep: 1,
        scaleUpThreshold: {
            cpu: 70,
            memory: 80,
            responseTime: 1000,
            queueLength: 50,
        },
        scaleDownThreshold: {
            cpu: 30,
            memory: 40,
            idleTime: 10,
        },
    },
    monitoring: {
        enabled: true,
        collectMetrics: true,
        metricsInterval: 60000,
        logLevel: "info",
        logWorkerEvents: true,
        logPerformance: true,
    },
    errorHandling: {
        uncaughtException: "restart",
        unhandledRejection: "restart",
        errorThreshold: 10,
    },
    security: {
        isolateWorkers: true,
        resourceLimits: true,
        preventForkBombs: true,
        encryptIPC: true,
    },
} as const