import { ClusterConfig } from "../../cluster";

// ===== OPTIMIZED CLUSTER CONFIGURATIONS =====
export const DEFAULT_CLUSTER_CONFIGS: Omit<ClusterConfig, "enabled"> = {
    workers: "auto" as const, // Will use os.cpus().length

    // Process Management - Enhanced for reliability
    processManagement: {
        respawn: true,
        maxRestarts: 10, // Max restarts per worker per hour
        restartDelay: 1000, // Reduced for faster recovery
        gracefulShutdownTimeout: 48000, // Increased for complex cleanup
        killTimeout: 15000, // Force kill timeout after graceful shutdown fails
        zombieDetection: true,
        memoryThreshold: "1GB", // Restart worker if memory exceeded
        cpuThreshold: 85, // Restart worker if CPU > 85% sustained
    },

    // Memory Management - Optimized
    memoryManagement: {
        enabled: true,
        maxWorkerMemory: "1GB", // Increased from default for better performance
        maxTotalMemory: "12GB", // Conservative total memory limit
        memoryCheckInterval: 15000, // More frequent checks (15s)
        memoryWarningThreshold: 70, // Earlier warning threshold
        memoryCriticalThreshold: 85, // Lower critical threshold for safety
        autoScaleOnMemory: true,
        memoryLeakDetection: true,
        garbageCollectionHint: true, // Enable GC hints
        lowMemoryMode: false, // Disable for better performance
    },

    // Health Monitoring - Enhanced
    healthCheck: {
        enabled: true,
        interval: 20000, // Check every 20 seconds
        timeout: 8000, // 8 second timeout
        maxFailures: 2, // Faster failover with 2 max failures
        endpoint: "/health",
    },

    // Load Balancing - Optimized strategy
    loadBalancing: {
        strategy: "least-connections" as const, // Better than round-robin for uneven loads
        stickySession: false,
        circuitBreakerThreshold: 5, // Circuit breaker after 5 failures
        circuitBreakerTimeout: 30000, // 30 second recovery timeout
    },

    // Inter-Process Communication - Enhanced
    ipc: {
        enabled: true,
        broadcast: true, // Enable broadcasting to all workers
        messageQueue: {
            maxSize: 1000, // Queue size limit
            timeout: 20000, // 20 second timeout
        },
        // Custom events can be added as needed
    },

    // Auto Scaling - Fine-tuned
    autoScaling: {
        enabled: true,
        minWorkers: 2, // Minimum workers for availability
        maxWorkers: 16, // Increased maximum for scalability
        scaleUpThreshold: {
            cpu: 65, // Scale up if CPU > 65%
            memory: 75, // Scale up if memory > 75%
            responseTime: 800, // Scale up if response time > 800ms
            queueLength: 30, // Scale up if queue > 30 requests
        },
        scaleDownThreshold: {
            cpu: 25, // Scale down if CPU < 25%
            memory: 35, // Scale down if memory < 35%
            idleTime: 15, // Scale down after 15 minutes idle
        },
        cooldownPeriod: 180000, // 3 minute cooldown between scaling
        scaleStep: 2, // Add/remove 2 workers at a time
    },

    // Resource Management - Comprehensive
    resources: {
        maxMemoryPerWorker: "1GB",
        maxCpuPerWorker: 80, // 80% CPU per worker
        priorityLevel: "high" as const,
        fileDescriptorLimit: 4096,
        networkConnections: {
            max: 1000,
            timeout: 30000,
        },

        // Enhanced Memory Management
        memoryManagement: {
            enabled: true,
            maxTotalMemory: "12GB",
            memoryCheckInterval: 15000,
            memoryWarningThreshold: 70,
            memoryCriticalThreshold: 85,
            autoScaleOnMemory: true,
            memoryLeakDetection: true,
            garbageCollectionHint: true,
            lowMemoryMode: false,
            memoryReservation: "1GB", // Reserve 1GB for system
            swapUsageLimit: 5, // Max 5% swap usage
        },

        // Performance Optimization
        performanceOptimization: {
            enabled: true,
            lowMemoryMode: false,
            reducedLogging: false, // Keep full logging for debugging
            compactMetrics: true,
            lazyWorkerInit: false, // Pre-initialize for faster response
            workerPooling: true,
            memoryPooling: true,
            disableDebugFeatures: true, // Disable in production
            minimalFootprint: false, // Prioritize performance over memory
            efficientDataStructures: true,
        },

        // Resource Limits Enforcement
        enforcement: {
            enabled: true,
            enforceHardLimits: true,
            softLimitWarnings: true,
            gracefulDegradation: false, // Hard limits for predictability
            resourceThrottling: false,
            alertOnLimitReached: true,
        },
    },

    // Monitoring - Enhanced observability
    monitoring: {
        enabled: true,
        collectMetrics: true,
        metricsInterval: 30000, // Collect metrics every 30 seconds
        logLevel: "info" as const, // Balanced logging level
        logWorkerEvents: true,
        logPerformance: true, // Enable performance logging
        // customMetrics can be added as needed
    },

    // Error Handling - Robust recovery
    errorHandling: {
        uncaughtException: "restart" as const,
        unhandledRejection: "restart" as const, // Restart for both types
        errorThreshold: 3, // Max 3 errors per hour before restart
        crashRecovery: {
            enabled: true,
            saveState: true,
            stateStorage: "memory" as const, // Use memory for fast recovery
        },
    },

    // Security - Production ready
    security: {
        isolateWorkers: true,
        sandboxMode: true, // Enable sandboxing
        resourceLimits: true,
        preventForkBombs: true,
        workerAuthentication: false, // Can be enabled if needed
        encryptIPC: true, // Enable IPC encryption
    },

    // Development Features - Disabled for production
    development: {
        hotReload: false,
        debugMode: false,
        profiling: false,
        // inspectPorts can be added for debugging
    },

    // Resilience Features - Enhanced fault tolerance
    resilience: {
        circuitBreaker: {
            enabled: true,
            failureThreshold: 5,
            recoveryTimeout: 30000,
            halfOpenRequests: 3,
        },
        bulkhead: {
            enabled: true,
            maxConcurrentRequests: 100,
            queueSize: 200,
        },
        timeout: {
            enabled: true,
            requestTimeout: 30000,
            healthCheckTimeout: 8000,
        },
        retryPolicy: {
            enabled: true,
            maxRetries: 3,
            backoffStrategy: "exponential" as const,
            baseDelay: 1000,
            maxDelay: 30000,
        },
    },

    // Advanced Features - Production optimizations
    advanced: {
        stateSync: {
            enabled: false, // Disable unless needed
            strategy: "redis" as const,
            syncInterval: 60000,
        },
        deployment: {
            rollingUpdates: true,
            maxUnavailable: 1,
            maxSurge: 2,
            healthCheckGracePeriod: 30000,
        },
        networking: {
            tcpNoDelay: true,
            keepAlive: true,
            keepAliveInitialDelay: 30000,
        },
    },

    // Persistence - Optional state persistence
    persistence: {
        enabled: false, // Enable only if state persistence is needed
        type: "memory" as const,
        memory: {
            maxSize: 100 * 1024 * 1024, // 100MB max memory storage
            ttl: 3600000, // 1 hour TTL
        },
    },
} as const;

