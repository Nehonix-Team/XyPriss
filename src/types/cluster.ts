/**
 *  Robust Cluster Configuration for XyPrissJS
 * clustering with advanced resilience features
 * TO ALL TEAM: WE PUT ONLY CLUSTER TYPES HERE
 * Contains ALL cluster-related types and configurations
 */

// =====  CLUSTER CONFIGURATION =====

// Enhanced types for better type safety
export interface WorkerHealth {
    status: "healthy" | "warning" | "critical" | "down";
    score: number; // 0-100, higher is better
    lastCheck: number;
    consecutiveFailures: number;
}

export interface WorkerPerformanceMetrics {
    avgResponseTime: number;
    throughput: number; // requests per second
    errorRate: number; // 0-1
    cpuUsage: number; // 0-100
    memoryUsage: number; // 0-100
    activeConnections: number;
}

export interface LoadBalancingStrategy {
    name: string;
    selector: (workers: WorkerMetrics[], request?: any) => string;
    healthAware: boolean;
    performanceAware: boolean;
}

export interface CircuitBreakerState {
    failures: number;
    lastFailure: number;
    state: "closed" | "open" | "half-open";
    nextAttempt: number;
}

export interface ClusterConfig {
    enabled?: boolean;
    workers?: number | "auto"; // "auto" = CPU cores
    entryPoint?: string; // Path to worker entry script (optional)

    // Process Management
    processManagement?: {
        respawn?: boolean;
        maxRestarts?: number; // Max restarts per worker per hour
        restartDelay?: number; // Delay between restarts (ms)
        gracefulShutdownTimeout?: number; // Max time to wait for graceful shutdown
        killTimeout?: number; // Force kill timeout after graceful shutdown fails
        zombieDetection?: boolean; // Detect and kill zombie processes
        memoryThreshold?: string; // e.g., "512MB" - restart worker if exceeded
        cpuThreshold?: number; // e.g., 80 - restart worker if CPU > 80% for sustained period
    };

    // Memory Management
    memoryManagement?: {
        enabled?: boolean; // Enable memory management (default: true)
        maxWorkerMemory?: string; // Max memory per worker (e.g., "128MB", "1GB")
        maxTotalMemory?: string; // Max total cluster memory (e.g., "2GB", "50%")
        memoryCheckInterval?: number; // Memory check interval in ms (default: 30000)
        memoryWarningThreshold?: number; // Warning threshold as percentage (default: 80)
        memoryCriticalThreshold?: number; // Critical threshold as percentage (default: 95)
        autoScaleOnMemory?: boolean; // Auto scale down when memory is high (default: true)
        memoryLeakDetection?: boolean; // Detect memory leaks in workers (default: true)
        garbageCollectionHint?: boolean; // Send GC hints to workers (default: false)
        lowMemoryMode?: boolean; // Enable low memory optimizations (default: false)
    };

    // Health Monitoring
    healthCheck?: {
        enabled?: boolean;
        interval?: number; // Health check interval (ms)
        timeout?: number; // Health check timeout (ms)
        maxFailures?: number; // Max consecutive failures before restart
        endpoint?: string; // Health check endpoint path
        customCheck?: (worker: any) => Promise<boolean>;
    };

    // Load Balancing
    loadBalancing?: {
        strategy?:
            | "round-robin"
            | "least-connections"
            | "ip-hash"
            | "weighted"
            | "adaptive"
            | "least-response-time"
            | "resource-based";
        weights?: number[]; // Worker weights for weighted strategy
        stickySession?: boolean;
        sessionAffinityKey?: string; // Key for session affinity (e.g., "userId")
        circuitBreakerThreshold?: number; // Circuit breaker failure threshold
        circuitBreakerTimeout?: number; // Circuit breaker timeout in ms
    };

    // Inter-Process Communication
    ipc?: {
        enabled?: boolean;
        channel?: string;
        messageQueue?: {
            maxSize?: number;
            timeout?: number;
        };
        broadcast?: boolean; // Enable broadcasting to all workers
        events?: {
            [eventName: string]: (data: any, workerId: string) => void;
        };
    };

    // Scaling
    autoScaling?: {
        enabled?: boolean;
        minWorkers?: number;
        maxWorkers?: number;
        scaleUpThreshold?: {
            cpu?: number; // Scale up if avg CPU > threshold
            memory?: number; // Scale up if avg memory > threshold
            responseTime?: number; // Scale up if avg response time > threshold (ms)
            queueLength?: number; // Scale up if request queue > threshold
        };
        scaleDownThreshold?: {
            cpu?: number; // Scale down if avg CPU < threshold
            memory?: number; // Scale down if avg memory < threshold
            idleTime?: number; // Scale down if idle for X minutes
        };
        cooldownPeriod?: number; // Minimum time between scaling actions (ms)
        scaleStep?: number; // Number of workers to add/remove at once
    };

    // Resource Management
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

    // Logging & Monitoring
    monitoring?: {
        enabled?: boolean;
        collectMetrics?: boolean;
        metricsInterval?: number; // Metrics collection interval (ms)
        logLevel?: "error" | "warn" | "info" | "debug" | "trace";
        logWorkerEvents?: boolean;
        logPerformance?: boolean;
        customMetrics?: {
            [metricName: string]: (workerId: string) => number;
        };
    };

    // Error Handling
    errorHandling?: {
        uncaughtException?: "restart" | "log" | "ignore";
        unhandledRejection?: "restart" | "log" | "ignore";
        customErrorHandler?: (error: Error, workerId: string) => void;
        errorThreshold?: number; // Max errors per hour before restart
        crashRecovery?: {
            enabled?: boolean;
            saveState?: boolean;
            stateStorage?: "memory" | "redis" | "file";
        };
    };

    // Security
    security?: {
        isolateWorkers?: boolean;
        sandboxMode?: boolean;
        resourceLimits?: boolean;
        preventForkBombs?: boolean;
        workerAuthentication?: boolean;
        encryptIPC?: boolean;
    };

    // Development Features
    development?: {
        hotReload?: boolean;
        debugMode?: boolean;
        profiling?: boolean;
        inspectPorts?: number[]; // Debug ports for each worker
    };

    // Resilience Features
    resilience?: {
        circuitBreaker?: {
            enabled?: boolean;
            failureThreshold?: number;
            recoveryTimeout?: number;
            halfOpenRequests?: number;
        };
        bulkhead?: {
            enabled?: boolean;
            maxConcurrentRequests?: number;
            queueSize?: number;
        };
        timeout?: {
            enabled?: boolean;
            requestTimeout?: number;
            healthCheckTimeout?: number;
        };
        retryPolicy?: {
            enabled?: boolean;
            maxRetries?: number;
            backoffStrategy?: "linear" | "exponential" | "constant";
            baseDelay?: number;
            maxDelay?: number;
        };
    };

    // Advanced Features
    advanced?: {
        stateSync?: {
            enabled?: boolean;
            strategy?: "redis" | "gossip" | "consensus";
            syncInterval?: number;
        };
        deployment?: {
            rollingUpdates?: boolean;
            maxUnavailable?: number;
            maxSurge?: number;
            healthCheckGracePeriod?: number;
        };
        networking?: {
            tcpNoDelay?: boolean;
            keepAlive?: boolean;
            keepAliveInitialDelay?: number;
        };
    };

    // Persistence Configuration
    persistence?: {
        enabled?: boolean;
        type?: "redis" | "file" | "memory" | "custom";
        redis?: {
            host?: string;
            port?: number;
            password?: string;
            db?: number;
            keyPrefix?: string;
            ttl?: number;
        };
        file?: {
            path?: string;
            backup?: boolean;
            maxBackups?: number;
            compression?: boolean;
        };
        memory?: {
            maxSize?: number;
            ttl?: number;
        };
        custom?: {
            saveHandler?: (state: any) => Promise<void>;
            loadHandler?: () => Promise<any>;
        };
    };
}

// ===== WORKER METRICS & STATUS =====

export interface WorkerMetrics {
    workerId: string;
    pid: number;
    uptime: number;
    restarts: number;
    lastRestart?: Date;

    // Performance metrics
    cpu: {
        usage: number; // Current CPU usage %
        average: number; // Average CPU usage
        peak: number; // Peak CPU usage
    };

    memory: {
        usage: number; // Current memory usage (bytes)
        peak: number; // Peak memory usage
        percentage: number; // Memory usage as percentage of limit
        heapUsed: number;
        heapTotal: number;
        external: number;
    };

    network: {
        connections: number;
        bytesReceived: number;
        bytesSent: number;
        connectionsPerSecond: number;
    };

    requests: {
        total: number;
        perSecond: number;
        errors: number;
        averageResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        activeRequests: number;
        queuedRequests: number;
    };

    health: {
        status: "healthy" | "warning" | "critical" | "dead";
        lastCheck: Date;
        consecutiveFailures: number;
        lastFailureReason?: string;
        healthScore: number; // 0-100
    };

    //  metrics
    gc: {
        collections: number;
        timeSpent: number;
        averageTime: number;
    };

    eventLoop: {
        delay: number;
        utilization: number;
    };
}

export interface ClusterMetrics {
    totalWorkers: number;
    activeWorkers: number;
    deadWorkers: number;
    restarting: number;
    totalRequests: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    totalErrors: number;
    errorRate: number;

    resources: {
        totalCpu: number;
        totalMemory: number;
        peakCpu: number;
        peakMemory: number;
        availableMemory: number;
        totalConnections: number;
    };

    workers: WorkerMetrics[];
    uptime: number;
    lastScalingAction?: {
        type: "scale-up" | "scale-down" | "restart" | "replace";
        timestamp: Date;
        reason: string;
        workersChanged: number;
        success: boolean;
    };

    // Load balancing metrics
    loadBalance: {
        strategy: string;
        distribution: { [workerId: string]: number };
        efficiency: number; // 0-100
    };

    // Health metrics
    healthOverall: {
        status: "healthy" | "degraded" | "critical";
        healthyWorkers: number;
        unhealthyWorkers: number;
        averageHealthScore: number;
    };
}

// ===== CLUSTER EVENTS =====

export interface ClusterEvents {
    "worker:started": (workerId: string, pid: number) => void;
    "worker:died": (workerId: string, code: number, signal: string) => void;
    "worker:restarted": (workerId: string, reason: string) => void;
    "worker:health:warning": (workerId: string, metrics: WorkerMetrics) => void;
    "worker:health:critical": (
        workerId: string,
        metrics: WorkerMetrics
    ) => void;
    "worker:overloaded": (workerId: string, metrics: WorkerMetrics) => void;
    "cluster:scaled": (action: string, newWorkerCount: number) => void;
    "cluster:overloaded": (metrics: ClusterMetrics) => void;
    "cluster:underutilized": (metrics: ClusterMetrics) => void;
    "cluster:degraded": (metrics: ClusterMetrics) => void;
    "cluster:recovered": (metrics: ClusterMetrics) => void;
    "ipc:message": (from: string, to: string, message: any) => void;
    "ipc:broadcast": (from: string, message: any) => void;
    "error:threshold": (workerId: string, errorCount: number) => void;
    "scaling:triggered": (
        reason: string,
        currentWorkers: number,
        targetWorkers: number
    ) => void;
    "loadbalancer:updated": (
        strategy: string,
        weights: { [workerId: string]: number }
    ) => void;
}

// =====  CLUSTER MANAGER =====

export interface RobustClusterManager {
    // Core management
    start(): Promise<void>;
    stop(graceful?: boolean): Promise<void>;
    restart(workerId?: string): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;

    // Worker management
    addWorker(): Promise<string>;
    removeWorker(workerId: string, graceful?: boolean): Promise<void>;
    replaceWorker(workerId: string): Promise<string>;
    getWorker(workerId: string): WorkerMetrics | null;
    getAllWorkers(): WorkerMetrics[];
    getActiveWorkers(): WorkerMetrics[];
    getUnhealthyWorkers(): WorkerMetrics[];

    // Health monitoring
    checkHealth(workerId?: string): Promise<boolean>;
    getHealthStatus(): Promise<{ [workerId: string]: boolean }>;
    runHealthCheck(): Promise<void>;

    // Metrics & monitoring
    getMetrics(): Promise<ClusterMetrics>;
    getWorkerMetrics(workerId: string): Promise<WorkerMetrics | null>;
    getAggregatedMetrics(): Promise<{
        cpu: number;
        memory: number;
        requests: number;
        errors: number;
        responseTime: number;
    }>;
    startMonitoring(): void;
    stopMonitoring(): void;
    exportMetrics(format?: "json" | "prometheus" | "csv"): Promise<string>;

    // Scaling
    scaleUp(count?: number): Promise<void>;
    scaleDown(count?: number): Promise<void>;
    autoScale(): Promise<void>;
    getOptimalWorkerCount(): Promise<number>;

    // Load Balancing
    updateLoadBalancingStrategy(strategy: string, options?: any): Promise<void>;
    getLoadBalanceStatus(): Promise<{ [workerId: string]: number }>;
    redistributeLoad(): Promise<void>;

    // IPC
    sendToWorker(workerId: string, message: any): Promise<void>;
    sendToAllWorkers(message: any): Promise<void>;
    broadcast(message: any): Promise<void>;
    sendToRandomWorker(message: any): Promise<void>;
    sendToLeastLoadedWorker(message: any): Promise<void>;
    on<K extends keyof ClusterEvents>(
        event: K,
        handler: ClusterEvents[K]
    ): void;
    off<K extends keyof ClusterEvents>(
        event: K,
        handler: ClusterEvents[K]
    ): void;
    emit<K extends keyof ClusterEvents>(
        event: K,
        ...args: Parameters<ClusterEvents[K]>
    ): void;

    // State management
    saveState(): Promise<void>;
    restoreState(): Promise<void>;
    getState(): Promise<ClusterState>;
    exportConfiguration(): Promise<ClusterConfig>;

    // Utilities
    isHealthy(): boolean;
    getLoadBalance(): number; // Returns load balance score (0-100)
    getRecommendedWorkerCount(): number;
    getClusterEfficiency(): number;

    // Advanced features
    enableProfiling(workerId: string): Promise<void>;
    disableProfiling(workerId: string): Promise<void>;
    takeHeapSnapshot(workerId: string): Promise<string>; // Returns snapshot path
    enableDebugMode(workerId: string, port?: number): Promise<void>;
    disableDebugMode(workerId: string): Promise<void>;

    // Rolling updates
    performRollingUpdate(updateFn: () => Promise<void>): Promise<void>;
    drainWorker(workerId: string): Promise<void>;

    // Circuit breaker
    isCircuitOpen(workerId?: string): boolean;
    resetCircuitBreaker(workerId?: string): Promise<void>;

    // Cleanup
    cleanup(): Promise<void>;
    forceCleanup(): Promise<void>;
}

// ===== UTILITY TYPES =====

export type ClusterState =
    | "initializing"
    | "starting"
    | "running"
    | "scaling"
    | "paused"
    | "draining"
    | "stopping"
    | "stopped"
    | "error"
    | "degraded";

export interface ClusterConfiguration {
    state: ClusterState;
    config: ClusterConfig;
    startTime: Date;
    lastConfigUpdate: Date;
    version: string;
    environment: "development" | "production" | "test";
}

export interface WorkerPool {
    active: Map<string, WorkerMetrics>;
    pending: Set<string>;
    draining: Set<string>;
    dead: Map<
        string,
        {
            diedAt: Date;
            reason: string;
            exitCode?: number;
            signal?: string;
            restartCount: number;
        }
    >;
    maxSize: number;
    currentSize: number;
    targetSize: number;
}

export interface LoadBalancer {
    strategy:
        | "round-robin"
        | "least-connections"
        | "ip-hash"
        | "weighted"
        | "adaptive"
        | "least-response-time"
        | "resource-based";
    weights: Map<string, number>;
    connections: Map<string, number>;
    lastSelected: string;
    selector: (workers: WorkerMetrics[], request?: any) => string;
}

export interface HealthChecker {
    enabled: boolean;
    interval: number;
    timeout: number;
    checks: Map<
        string,
        {
            lastCheck: Date;
            consecutiveFailures: number;
            isHealthy: boolean;
            lastError?: Error;
        }
    >;
    customChecks: Array<(workerId: string) => Promise<boolean>>;
}

export interface AutoScaler {
    enabled: boolean;
    minWorkers: number;
    maxWorkers: number;
    cooldownPeriod: number;
    lastScalingAction: Date;
    pendingActions: Array<{
        type: "scale-up" | "scale-down";
        count: number;
        reason: string;
        scheduledAt: Date;
    }>;
}

// ===== FACTORY FUNCTION TYPE =====

export interface ClusterFactory {
    create(config: ClusterConfig): RobustClusterManager;
    createWithDefaults(): RobustClusterManager;
    createForEnvironment(
        env: "development" | "production" | "test"
    ): RobustClusterManager;
    validateConfig(config: ClusterConfig): {
        valid: boolean;
        errors: string[];
    };
    getRecommendedConfig(
        serverType: "api" | "web" | "microservice" | "worker"
    ): ClusterConfig;
    mergeConfigs(
        base: ClusterConfig,
        override: Partial<ClusterConfig>
    ): ClusterConfig;
}

// ===== CLUSTER INTEGRATION TYPES =====

export interface ClusterServerOptions {
    cluster?: {
        enabled?: boolean;
        config?: ClusterConfig;
    };
}

export interface ClusterMiddleware {
    workerId: string;
    isMainProcess: boolean;
    isMaster: boolean;
    sendToMaster: (message: any) => Promise<void>;
    sendToWorker: (workerId: string, message: any) => Promise<void>;
    broadcast: (message: any) => Promise<void>;
}

// ===== CLUSTER BUILDER PATTERN =====

export interface ClusterBuilder {
    withWorkers(count: number | "auto"): ClusterBuilder;
    withHealthCheck(
        config: Partial<ClusterConfig["healthCheck"]>
    ): ClusterBuilder;
    withAutoScaling(
        config: Partial<ClusterConfig["autoScaling"]>
    ): ClusterBuilder;
    withLoadBalancing(strategy: string, options?: any): ClusterBuilder;
    withMonitoring(
        config: Partial<ClusterConfig["monitoring"]>
    ): ClusterBuilder;
    withSecurity(config: Partial<ClusterConfig["security"]>): ClusterBuilder;
    withResilience(
        config: Partial<ClusterConfig["resilience"]>
    ): ClusterBuilder;
    enableDevelopmentMode(): ClusterBuilder;
    enableProductionMode(): ClusterBuilder;
    build(): ClusterConfig;
    create(): RobustClusterManager;
}

export interface ClusterBuilderFactory {
    create(): ClusterBuilder;
    fromConfig(config: Partial<ClusterConfig>): ClusterBuilder;
    forEnvironment(env: "development" | "production" | "test"): ClusterBuilder;
}

// ===== PERSISTENCE CONFIGURATION =====
export interface PersistenceConfig {
    enabled?: boolean;
    type: "redis" | "file" | "memory" | "custom";
    redis?: {
        host: string;
        port: number;
        password?: string;
        db?: number;
        keyPrefix?: string;
        ttl?: number;
    };
    file?: {
        path: string;
        backup: boolean;
        maxBackups?: number;
        compression?: boolean;
    };
    memory?: {
        maxSize: number;
        ttl?: number;
    };
    custom?: {
        saveHandler?: (state: PersistentClusterState) => Promise<void>;
        loadHandler?: () => Promise<PersistentClusterState | null>;
    };
}

// ===== PERSISTENT CLUSTER STATE =====
export interface PersistentClusterState {
    state: ClusterState;
    config: Partial<ClusterConfig>;
    workers?: Array<{
        id: string;
        pid: number;
        status: "running" | "stopped" | "restarting";
        startTime: Date;
        restarts: number;
        metrics?: Partial<WorkerMetrics>;
    }>;
    metrics?: {
        clusterMetrics: Partial<ClusterMetrics>;
        historicalData: Array<{
            timestamp: Date;
            cpu: number;
            memory: number;
            requests: number;
            errors: number;
            responseTime: number;
        }>;
        workerHistory: Map<
            string,
            Array<{
                timestamp: Date;
                cpu: number;
                memory: number;
                requests: number;
                errors: number;
                responseTime: number;
            }>
        >;
    };
    loadBalancer?: {
        strategy: string;
        weights: { [workerId: string]: number };
        distribution: { [workerId: string]: number };
        historicalTrends: {
            requestsPerMinute: Array<{ timestamp: Date; value: number }>;
            averageResponseTimes: Array<{ timestamp: Date; value: number }>;
            errorRates: Array<{ timestamp: Date; value: number }>;
        };
    };
    timestamp: Date;
    version: string;
}

//scaling

export interface ScalingDecision {
    action: "scale-up" | "scale-down" | "no-action";
    targetWorkers: number;
    reason: string;
    confidence: number;
    metrics: {
        cpu: number;
        memory: number;
        responseTime: number;
        queueLength: number;
    };
}

export interface ScalingHistory {
    timestamp: Date;
    action: "scale-up" | "scale-down";
    fromWorkers: number;
    toWorkers: number;
    reason: string;
    success: boolean;
}
export interface MetricsSnapshot {
    timestamp: Date;
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    responseTime: number;
}

export interface MemoryStats {
    totalMemory: number;
    usedMemory: number;
    freeMemory: number;
    usagePercentage: number;
    swapUsed: number;
    swapTotal: number;
    swapPercentage: number;
}

export interface WorkerMemoryStats {
    workerId: string;
    pid: number;
    memoryUsage: {
        rss: number; // Resident Set Size
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
    };
    cpuUsage: number;
    uptime: number;
}

export interface MemoryAlert {
    type: "warning" | "critical" | "leak_detected" | "limit_exceeded";
    workerId?: string;
    message: string;
    memoryUsage: number;
    threshold: number;
    timestamp: number;
    action?: "scale_down" | "restart_worker" | "throttle" | "alert_only";
}

