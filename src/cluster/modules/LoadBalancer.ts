/**
 * XyPrissJS  Load Balancer
 * Intelligent load balancing with adaptive strategies, performance optimization,
 * and advanced health-aware routing
 */

import { EventEmitter } from "events";
import * as crypto from "crypto";
import {
    ClusterConfig,
    WorkerMetrics,
    LoadBalancer as LoadBalancerInterface,
    WorkerHealth,
    WorkerPerformanceMetrics,
    LoadBalancingStrategy,
    CircuitBreakerState,
} from "../../types/cluster";
import { logger } from "../../../shared/logger/Logger";

/**
 * Advanced load balancer with multiple strategies and intelligent routing
 */
export class LoadBalancer extends EventEmitter {
    private config: ClusterConfig;
    private loadBalancer: LoadBalancerInterface;
    private connectionCounts: Map<string, number> = new Map();
    private requestCounts: Map<string, number> = new Map();
    private responseTimesHistory: Map<string, number[]> = new Map();
    private performanceMetrics: Map<string, WorkerPerformanceMetrics> =
        new Map();
    private healthScores: Map<string, WorkerHealth> = new Map();
    private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
    private strategies: Map<string, LoadBalancingStrategy> = new Map();
    private lastSelectedWorker = "";
    private roundRobinIndex = 0;
    private adaptiveWeights: Map<string, number> = new Map();
    private metricsWindow = 300000; // 5 minutes
    private readonly cleanupInterval: NodeJS.Timeout;

    // Performance tracking
    private requestLatencies: Map<string, number[]> = new Map();
    private errorCounts: Map<string, number> = new Map();
    private throughputCounters: Map<
        string,
        { count: number; timestamp: number }
    > = new Map();

    // Historical trends tracking
    private historicalTrends = {
        requestsPerMinute: [] as Array<{ timestamp: Date; value: number }>,
        averageResponseTimes: [] as Array<{ timestamp: Date; value: number }>,
        errorRates: [] as Array<{ timestamp: Date; value: number }>,
    };

    // IPC Manager reference for worker communication
    private ipcManager?: any;

    constructor(config: ClusterConfig) {
        super();
        this.config = config;

        // Initialize load balancer configuration
        this.loadBalancer = {
            strategy: config.loadBalancing?.strategy || "adaptive",
            weights: new Map(),
            connections: new Map(),
            lastSelected: "",
            selector: this.createSelector(),
        };

        this.initializeStrategies();
        this.setupLoadBalancing();

        // Setup periodic cleanup and recalculation
        this.cleanupInterval = setInterval(() => {
            this.performPeriodicMaintenance();
        }, 30000); // Every 30 seconds
    }

    /**
     * Initialize all available load balancing strategies
     */
    private initializeStrategies(): void {
        this.strategies.set("round-robin", {
            name: "round-robin",
            selector: (workers) => this.roundRobinSelection(workers),
            healthAware: false,
            performanceAware: false,
        });

        this.strategies.set("least-connections", {
            name: "least-connections",
            selector: (workers) => this.leastConnectionsSelection(workers),
            healthAware: true,
            performanceAware: false,
        });

        this.strategies.set("ip-hash", {
            name: "ip-hash",
            selector: (workers, request) =>
                this.ipHashSelection(workers, request),
            healthAware: true,
            performanceAware: false,
        });

        this.strategies.set("weighted", {
            name: "weighted",
            selector: (workers) => this.weightedSelection(workers),
            healthAware: true,
            performanceAware: false,
        });

        this.strategies.set("least-response-time", {
            name: "least-response-time",
            selector: (workers) => this.leastResponseTimeSelection(workers),
            healthAware: true,
            performanceAware: true,
        });

        this.strategies.set("adaptive", {
            name: "adaptive",
            selector: (workers, request) =>
                this.adaptiveSelection(workers, request),
            healthAware: true,
            performanceAware: true,
        });

        this.strategies.set("resource-based", {
            name: "resource-based",
            selector: (workers) => this.resourceBasedSelection(workers),
            healthAware: true,
            performanceAware: true,
        });
    }

    /**
     * Setup load balancing with intelligent defaults
     */
    private setupLoadBalancing(): void {
        // Initialize weights if provided
        if (this.config.loadBalancing?.weights) {
            this.config.loadBalancing.weights.forEach((weight, index) => {
                this.loadBalancer.weights.set(`worker_${index}`, weight);
                this.adaptiveWeights.set(`worker_${index}`, weight);
            });
        }

        this.setupConnectionTracking();
    }

    /**
     * Setup connection tracking for load balancing decisions
     */
    private setupConnectionTracking(): void {
        // More intelligent cleanup with sliding window
        this.cleanupMetrics();
    }

    /**
     * Perform periodic maintenance tasks
     */
    private performPeriodicMaintenance(): void {
        this.cleanupMetrics();
        this.updateHealthScores();
        this.updateAdaptiveWeights();
        this.checkCircuitBreakers();
        this.updateHistoricalTrends();
        this.emitMetricsUpdate();
    }

    /**
     * Clean up old metrics data
     */
    private cleanupMetrics(): void {
        const cutoffTime = Date.now() - this.metricsWindow;

        // Clean response times with sliding window
        this.responseTimesHistory.forEach((times, workerId) => {
            if (times.length > 1000) {
                // Increased history size
                this.responseTimesHistory.set(workerId, times.slice(-500));
            }
        });

        // Clean latency data
        this.requestLatencies.forEach((latencies, workerId) => {
            if (latencies.length > 1000) {
                this.requestLatencies.set(workerId, latencies.slice(-500));
            }
        });

        // Reset hourly counters
        if (Date.now() % 3600000 < 30000) {
            // Every hour, within 30s window
            this.connectionCounts.clear();
            this.requestCounts.clear();
            this.errorCounts.clear();
        }
    }

    /**
     * Update health scores based on recent performance
     */
    private updateHealthScores(): void {
        this.performanceMetrics.forEach((metrics, workerId) => {
            const health = this.healthScores.get(workerId) || {
                status: "healthy",
                score: 100,
                lastCheck: Date.now(),
                consecutiveFailures: 0,
            };

            // Calculate health score based on multiple factors
            let score = 100;

            // Response time factor (0-40 points)
            if (metrics.avgResponseTime > 0) {
                score -= Math.min(40, (metrics.avgResponseTime / 1000) * 10);
            }

            // Error rate factor (0-30 points)
            score -= metrics.errorRate * 30;

            // Resource usage factor (0-20 points)
            const resourcePenalty =
                ((metrics.cpuUsage + metrics.memoryUsage) / 200) * 20;
            score -= resourcePenalty;

            // Throughput bonus (0-10 points)
            if (metrics.throughput > 0) {
                score += Math.min(10, metrics.throughput / 10);
            }

            health.score = Math.max(0, Math.min(100, score));
            health.lastCheck = Date.now();

            // Update status based on score
            if (health.score >= 80) health.status = "healthy";
            else if (health.score >= 60) health.status = "warning";
            else if (health.score >= 30) health.status = "critical";
            else health.status = "down";

            this.healthScores.set(workerId, health);
        });
    }

    /**
     * Update adaptive weights based on performance
     */
    private updateAdaptiveWeights(): void {
        const totalHealthScore = Array.from(this.healthScores.values()).reduce(
            (sum, health) => sum + health.score,
            0
        );

        if (totalHealthScore === 0) return;

        this.healthScores.forEach((health, workerId) => {
            // Calculate adaptive weight based on health score and performance
            const baseWeight = this.loadBalancer.weights.get(workerId) || 1;
            const healthWeight = (health.score / 100) * baseWeight;

            // Apply performance multiplier
            const metrics = this.performanceMetrics.get(workerId);
            let performanceMultiplier = 1;

            if (metrics) {
                // Boost weight for low response time and high throughput
                performanceMultiplier = Math.max(
                    0.1,
                    (1 - metrics.errorRate) *
                        Math.min(
                            2,
                            1000 / Math.max(1, metrics.avgResponseTime)
                        ) *
                        Math.min(1.5, metrics.throughput / 100)
                );
            }

            this.adaptiveWeights.set(
                workerId,
                healthWeight * performanceMultiplier
            );
        });
    }

    /**
     * Check and update circuit breaker states
     */
    private checkCircuitBreakers(): void {
        const now = Date.now();

        this.circuitBreakers.forEach((breaker, workerId) => {
            if (breaker.state === "open" && now >= breaker.nextAttempt) {
                breaker.state = "half-open";
                this.emit("circuit-breaker:half-open", workerId);
            }
        });
    }

    /**
     * Create selector function based on strategy
     */
    private createSelector(): (
        workers: WorkerMetrics[],
        request?: any
    ) => string {
        return (workers: WorkerMetrics[], request?: any) => {
            return this.selectWorker(workers, request);
        };
    }

    /**
     * Select optimal worker based on configured strategy
     */
    private selectWorker(workers: WorkerMetrics[], request?: any): string {
        if (workers.length === 0) {
            throw new Error("No workers available for load balancing");
        }

        // Filter workers based on circuit breaker state
        let availableWorkers = workers.filter((worker) => {
            const breaker = this.circuitBreakers.get(worker.workerId);
            return !breaker || breaker.state !== "open";
        });

        // If no workers available due to circuit breakers, allow one half-open attempt
        if (availableWorkers.length === 0) {
            const halfOpenWorkers = workers.filter((worker) => {
                const breaker = this.circuitBreakers.get(worker.workerId);
                return breaker && breaker.state === "half-open";
            });
            availableWorkers =
                halfOpenWorkers.length > 0
                    ? [halfOpenWorkers[0]]
                    : [workers[0]];
        }

        // Apply health filtering for health-aware strategies
        const strategy = this.strategies.get(this.loadBalancer.strategy);
        if (strategy?.healthAware) {
            const healthyWorkers = availableWorkers.filter((worker) => {
                const health = this.healthScores.get(worker.workerId);
                return !health || health.status !== "down";
            });

            if (healthyWorkers.length > 0) {
                availableWorkers = healthyWorkers;
            }
        }

        const selectedWorkerId =
            strategy?.selector(availableWorkers, request) ||
            this.roundRobinSelection(availableWorkers);

        this.updateSelectionTracking(selectedWorkerId);
        this.loadBalancer.lastSelected = selectedWorkerId;

        return selectedWorkerId;
    }

    /**
     * Least response time selection strategy
     */
    private leastResponseTimeSelection(workers: WorkerMetrics[]): string {
        let bestWorker = workers[0];
        let bestScore = Infinity;

        for (const worker of workers) {
            const avgResponseTime = this.getAverageResponseTime(
                worker.workerId
            );
            const activeRequests = worker.requests?.activeRequests || 0;

            // Score based on response time and current load
            const score = avgResponseTime * (1 + activeRequests * 0.1);

            if (score < bestScore) {
                bestScore = score;
                bestWorker = worker;
            }
        }

        return bestWorker.workerId;
    }

    /**
     * Adaptive selection strategy that combines multiple factors
     */
    private adaptiveSelection(workers: WorkerMetrics[], request?: any): string {
        let bestWorker = workers[0];
        let bestScore = -Infinity;

        for (const worker of workers) {
            const health = this.healthScores.get(worker.workerId);
            const metrics = this.performanceMetrics.get(worker.workerId);
            const activeRequests = worker.requests?.activeRequests || 0;
            const adaptiveWeight =
                this.adaptiveWeights.get(worker.workerId) || 1;

            // Calculate composite score
            let score = 0;

            // Health score (0-40 points)
            if (health) {
                score += (health.score / 100) * 40;
            } else {
                score += 20; // Default moderate score for unknown health
            }

            // Performance score (0-30 points)
            if (metrics) {
                const responseTimeFactor = Math.max(
                    0,
                    30 - metrics.avgResponseTime / 100
                );
                const errorRateFactor = (1 - metrics.errorRate) * 15;
                const throughputFactor = Math.min(15, metrics.throughput / 10);

                score +=
                    responseTimeFactor + errorRateFactor + throughputFactor;
            }

            // Load factor (0-20 points)
            const maxRequests = Math.max(
                1,
                ...workers.map((w) => w.requests?.activeRequests || 1)
            );
            const loadFactor = (1 - activeRequests / maxRequests) * 20;
            score += loadFactor;

            // Adaptive weight factor (0-10 points)
            score +=
                (adaptiveWeight /
                    Math.max(...Array.from(this.adaptiveWeights.values()))) *
                10;

            // Add some randomness to prevent thundering herd (±2 points)
            score += (Math.random() - 0.5) * 4;

            if (score > bestScore) {
                bestScore = score;
                bestWorker = worker;
            }
        }

        return bestWorker.workerId;
    }

    /**
     * Resource-based selection considering CPU and memory usage
     */
    private resourceBasedSelection(workers: WorkerMetrics[]): string {
        let bestWorker = workers[0];
        let bestScore = Infinity;

        for (const worker of workers) {
            const metrics = this.performanceMetrics.get(worker.workerId);
            if (!metrics) continue;

            // Score based on resource usage (lower is better)
            const resourceScore = (metrics.cpuUsage + metrics.memoryUsage) / 2;
            const loadScore = (worker.requests?.activeRequests || 0) * 10;
            const totalScore = resourceScore + loadScore;

            if (totalScore < bestScore) {
                bestScore = totalScore;
                bestWorker = worker;
            }
        }

        return bestWorker.workerId;
    }

    /**
     *  round-robin selection with health awareness
     */
    private roundRobinSelection(workers: WorkerMetrics[]): string {
        const startIndex = this.roundRobinIndex;
        let attempts = 0;

        do {
            const worker = workers[this.roundRobinIndex % workers.length];
            this.roundRobinIndex = (this.roundRobinIndex + 1) % workers.length;

            const health = this.healthScores.get(worker.workerId);
            if (!health || health.status !== "down") {
                return worker.workerId;
            }

            attempts++;
        } while (attempts < workers.length);

        // Fallback to first worker if all are down
        return workers[0].workerId;
    }

    /**
     *  least connections selection with performance weighting
     */
    private leastConnectionsSelection(workers: WorkerMetrics[]): string {
        let minScore = Infinity;
        let selectedWorker = workers[0];

        for (const worker of workers) {
            const connections = this.connectionCounts.get(worker.workerId) || 0;
            const activeRequests = worker.requests?.activeRequests || 0;
            const avgResponseTime = this.getAverageResponseTime(
                worker.workerId
            );

            // Weighted score considering connections, active requests, and response time
            const score = connections + activeRequests + avgResponseTime / 100;

            if (score < minScore) {
                minScore = score;
                selectedWorker = worker;
            }
        }

        return selectedWorker.workerId;
    }

    /**
     *  IP hash selection with consistent hashing
     */
    private ipHashSelection(workers: WorkerMetrics[], request?: any): string {
        if (!request?.ip) {
            return this.adaptiveSelection(workers, request);
        }

        const sessionKey = this.config.loadBalancing?.sessionAffinityKey;
        const hashInput =
            sessionKey && request[sessionKey]
                ? request[sessionKey]
                : request.ip;

        // Use consistent hashing with virtual nodes
        const virtualNodes = 150; // Number of virtual nodes per worker
        const ring: Array<{ hash: number; workerId: string }> = [];

        workers.forEach((worker) => {
            for (let i = 0; i < virtualNodes; i++) {
                const virtualKey = `${worker.workerId}:${i}`;
                const hash = this.hashString(virtualKey);
                ring.push({ hash, workerId: worker.workerId });
            }
        });

        ring.sort((a, b) => a.hash - b.hash);

        const requestHash = this.hashString(hashInput);
        const node = ring.find((n) => n.hash >= requestHash) || ring[0];

        return node.workerId;
    }

    /**
     *  weighted selection with dynamic weights
     */
    private weightedSelection(workers: WorkerMetrics[]): string {
        const useAdaptive = this.loadBalancer.strategy === "adaptive";
        const weightMap = useAdaptive
            ? this.adaptiveWeights
            : this.loadBalancer.weights;

        const totalWeight = workers.reduce((sum, worker) => {
            const weight = weightMap.get(worker.workerId) || 1;
            return sum + Math.max(0.1, weight); // Minimum weight to prevent zero
        }, 0);

        if (totalWeight === 0) {
            return this.roundRobinSelection(workers);
        }

        const random = Math.random() * totalWeight;
        let currentWeight = 0;

        for (const worker of workers) {
            const weight = Math.max(0.1, weightMap.get(worker.workerId) || 1);
            currentWeight += weight;

            if (random <= currentWeight) {
                return worker.workerId;
            }
        }

        return workers[0].workerId;
    }

    /**
     * Hash string to number for consistent hashing
     */
    private hashString(str: string): number {
        const hash = crypto.createHash("md5").update(str).digest("hex");
        return parseInt(hash.substring(0, 8), 16);
    }

    /**
     * Update selection tracking for analytics
     */
    private updateSelectionTracking(workerId: string): void {
        const currentConnections = this.connectionCounts.get(workerId) || 0;
        this.connectionCounts.set(workerId, currentConnections + 1);

        const currentRequests = this.requestCounts.get(workerId) || 0;
        this.requestCounts.set(workerId, currentRequests + 1);

        this.loadBalancer.connections.set(workerId, currentConnections + 1);

        // Update throughput counter
        const now = Date.now();
        const throughputData = this.throughputCounters.get(workerId) || {
            count: 0,
            timestamp: now,
        };

        if (now - throughputData.timestamp > 1000) {
            // Reset every second
            const throughput =
                throughputData.count /
                ((now - throughputData.timestamp) / 1000);
            this.updatePerformanceMetric(workerId, "throughput", throughput);
            this.throughputCounters.set(workerId, { count: 1, timestamp: now });
        } else {
            throughputData.count++;
        }
    }

    /**
     * Update performance metrics for a worker
     */
    private updatePerformanceMetric(
        workerId: string,
        metric: keyof WorkerPerformanceMetrics,
        value: number
    ): void {
        const current = this.performanceMetrics.get(workerId) || {
            avgResponseTime: 0,
            throughput: 0,
            errorRate: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            activeConnections: 0,
        };

        current[metric] = value;
        this.performanceMetrics.set(workerId, current);
    }

    /**
     * Record response time with  analytics
     */
    public recordResponseTime(workerId: string, responseTime: number): void {
        // Record in history
        if (!this.responseTimesHistory.has(workerId)) {
            this.responseTimesHistory.set(workerId, []);
        }
        const times = this.responseTimesHistory.get(workerId)!;
        times.push(responseTime);

        // Record in latencies for more detailed analysis
        if (!this.requestLatencies.has(workerId)) {
            this.requestLatencies.set(workerId, []);
        }
        const latencies = this.requestLatencies.get(workerId)!;
        latencies.push(responseTime);

        // Update average response time
        const avgResponseTime =
            times.reduce((sum, time) => sum + time, 0) / times.length;
        this.updatePerformanceMetric(
            workerId,
            "avgResponseTime",
            avgResponseTime
        );

        // Cleanup old data
        if (times.length > 1000) {
            times.splice(0, times.length - 500);
        }
        if (latencies.length > 1000) {
            latencies.splice(0, latencies.length - 500);
        }
    }

    /**
     * Record error for circuit breaker and error rate tracking
     */
    public recordError(workerId: string): void {
        // Update error count
        const currentErrors = this.errorCounts.get(workerId) || 0;
        this.errorCounts.set(workerId, currentErrors + 1);

        // Update circuit breaker
        let breaker = this.circuitBreakers.get(workerId);
        if (!breaker) {
            breaker = {
                failures: 0,
                lastFailure: 0,
                state: "closed",
                nextAttempt: 0,
            };
            this.circuitBreakers.set(workerId, breaker);
        }

        breaker.failures++;
        breaker.lastFailure = Date.now();

        // Open circuit breaker if failure threshold exceeded
        const failureThreshold =
            this.config.loadBalancing?.circuitBreakerThreshold || 5;
        if (
            breaker.failures >= failureThreshold &&
            breaker.state === "closed"
        ) {
            breaker.state = "open";
            breaker.nextAttempt =
                Date.now() +
                (this.config.loadBalancing?.circuitBreakerTimeout || 60000);
            this.emit("circuit-breaker:opened", workerId);
        }

        // Calculate error rate
        const totalRequests = this.requestCounts.get(workerId) || 1;
        const errorRate = Math.min(1, currentErrors / totalRequests);
        this.updatePerformanceMetric(workerId, "errorRate", errorRate);
    }

    /**
     * Record successful request (for circuit breaker recovery)
     */
    public recordSuccess(workerId: string): void {
        const breaker = this.circuitBreakers.get(workerId);
        if (breaker) {
            if (breaker.state === "half-open") {
                breaker.state = "closed";
                breaker.failures = 0;
                this.emit("circuit-breaker:closed", workerId);
            } else if (breaker.state === "closed") {
                breaker.failures = Math.max(0, breaker.failures - 1);
            }
        }
    }

    /**
     * Get average response time for a worker
     */
    public getAverageResponseTime(workerId: string): number {
        const times = this.responseTimesHistory.get(workerId);
        if (!times || times.length === 0) return 0;
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    /**
     * Get response time percentiles
     */
    public getResponseTimePercentiles(
        workerId: string,
        percentiles: number[] = [50, 90, 95, 99]
    ): { [key: number]: number } {
        const times = this.responseTimesHistory.get(workerId);
        if (!times || times.length === 0) return {};

        const sorted = [...times].sort((a, b) => a - b);
        const result: { [key: number]: number } = {};

        percentiles.forEach((p) => {
            const index = Math.ceil((p / 100) * sorted.length) - 1;
            result[p] = sorted[Math.max(0, index)];
        });

        return result;
    }

    /**
     * Update load balancing strategy with  options
     */
    public async updateStrategy(
        strategy: string,
        options?: any
    ): Promise<void> {
        if (!this.strategies.has(strategy)) {
            throw new Error(`Unknown load balancing strategy: ${strategy}`);
        }

        this.loadBalancer.strategy = strategy as any;

        if (options?.weights && Array.isArray(options.weights)) {
            this.loadBalancer.weights.clear();
            options.weights.forEach((weight: number, index: number) => {
                this.loadBalancer.weights.set(`worker_${index}`, weight);
            });
        }

        if (options?.circuitBreakerThreshold) {
            this.config.loadBalancing = this.config.loadBalancing || {};
            this.config.loadBalancing.circuitBreakerThreshold =
                options.circuitBreakerThreshold;
        }

        this.loadBalancer.selector = this.createSelector();
        this.emit("loadbalancer:updated", strategy, this.getWeights());
    }

    /**
     * Get  distribution statistics
     */
    public getDistributionStats(): {
        strategy: string;
        totalRequests: number;
        distribution: { [workerId: string]: number };
        efficiency: number;
        averageResponseTimes: { [workerId: string]: number };
        healthScores: { [workerId: string]: number };
        errorRates: { [workerId: string]: number };
        circuitBreakerStates: { [workerId: string]: string };
        responseTimePercentiles: {
            [workerId: string]: { [percentile: number]: number };
        };
    } {
        const totalRequests = Array.from(this.requestCounts.values()).reduce(
            (sum, count) => sum + count,
            0
        );

        const distribution: { [workerId: string]: number } = {};
        this.requestCounts.forEach((count, workerId) => {
            distribution[workerId] = count;
        });

        const averageResponseTimes: { [workerId: string]: number } = {};
        const healthScores: { [workerId: string]: number } = {};
        const errorRates: { [workerId: string]: number } = {};
        const circuitBreakerStates: { [workerId: string]: string } = {};
        const responseTimePercentiles: {
            [workerId: string]: { [percentile: number]: number };
        } = {};

        this.responseTimesHistory.forEach((_, workerId) => {
            averageResponseTimes[workerId] =
                this.getAverageResponseTime(workerId);
            responseTimePercentiles[workerId] =
                this.getResponseTimePercentiles(workerId);
        });

        this.healthScores.forEach((health, workerId) => {
            healthScores[workerId] = health.score;
        });

        this.performanceMetrics.forEach((metrics, workerId) => {
            errorRates[workerId] = metrics.errorRate;
        });

        this.circuitBreakers.forEach((breaker, workerId) => {
            circuitBreakerStates[workerId] = breaker.state;
        });

        return {
            strategy: this.loadBalancer.strategy,
            totalRequests,
            distribution,
            efficiency: this.getLoadDistributionEfficiency(),
            averageResponseTimes,
            healthScores,
            errorRates,
            circuitBreakerStates,
            responseTimePercentiles,
        };
    }

    /**
     * Get current load balance status with  metrics
     */
    public getLoadBalanceStatus(): {
        connections: { [workerId: string]: number };
        health: { [workerId: string]: WorkerHealth };
        performance: { [workerId: string]: WorkerPerformanceMetrics };
        adaptiveWeights: { [workerId: string]: number };
    } {
        const connections: { [workerId: string]: number } = {};
        this.connectionCounts.forEach((count, workerId) => {
            connections[workerId] = count;
        });

        const health: { [workerId: string]: WorkerHealth } = {};
        this.healthScores.forEach((score, workerId) => {
            health[workerId] = score;
        });

        const performance: { [workerId: string]: WorkerPerformanceMetrics } =
            {};
        this.performanceMetrics.forEach((metrics, workerId) => {
            performance[workerId] = metrics;
        });

        const adaptiveWeights: { [workerId: string]: number } = {};
        this.adaptiveWeights.forEach((weight, workerId) => {
            adaptiveWeights[workerId] = weight;
        });

        return { connections, health, performance, adaptiveWeights };
    }

    /**
     *  load distribution efficiency calculation
     */
    public getLoadDistributionEfficiency(): number {
        const connections = Array.from(this.connectionCounts.values());
        if (connections.length === 0) return 100;

        const total = connections.reduce((sum, count) => sum + count, 0);
        const average = total / connections.length;

        if (average === 0) return 100;

        // Calculate Gini coefficient for more accurate distribution measurement
        const sortedConnections = connections.sort((a, b) => a - b);
        let giniSum = 0;

        sortedConnections.forEach((count, i) => {
            giniSum += (2 * (i + 1) - connections.length - 1) * count;
        });

        const giniCoefficient = giniSum / (connections.length * total);

        // Convert Gini coefficient to efficiency score (0-100, higher is better)
        // Gini of 0 = perfect equality = 100% efficiency
        // Gini of 1 = maximum inequality = 0% efficiency
        return Math.max(0, 100 * (1 - Math.abs(giniCoefficient)));
    }

    /**
     * Advanced redistribute load with strategy-specific optimizations
     */
    public async redistributeLoad(): Promise<void> {
        // Reset connection counts
        this.connectionCounts.clear();
        this.roundRobinIndex = 0;

        // Reset circuit breakers for healthy redistribution
        this.circuitBreakers.forEach((breaker, workerId) => {
            if (breaker.state === "open") {
                breaker.state = "half-open";
            }
        });

        // Recalculate adaptive weights
        this.updateAdaptiveWeights();

        logger.info(
            "cluster",
            `Load redistributed across workers using ${this.loadBalancer.strategy} strategy`
        );
        this.emit("load:redistributed", {
            strategy: this.loadBalancer.strategy,
            timestamp: Date.now(),
            efficiency: this.getLoadDistributionEfficiency(),
        });
    }

    /**
     * Get worker weights (static and adaptive)
     */
    private getWeights(): {
        static: { [workerId: string]: number };
        adaptive: { [workerId: string]: number };
    } {
        const staticWeights: { [workerId: string]: number } = {};
        const adaptiveWeights: { [workerId: string]: number } = {};

        this.loadBalancer.weights.forEach((weight, workerId) => {
            staticWeights[workerId] = weight;
        });

        this.adaptiveWeights.forEach((weight, workerId) => {
            adaptiveWeights[workerId] = weight;
        });

        return { static: staticWeights, adaptive: adaptiveWeights };
    }

    /**
     * Select worker using the configured strategy (public interface)
     */
    public selectWorkerForRequest(
        workers: WorkerMetrics[],
        request?: any
    ): string {
        return this.loadBalancer.selector(workers, request);
    }

    /**
     * Get comprehensive load balancer configuration
     */
    public getConfiguration(): LoadBalancerInterface & {
        availableStrategies: string[];
        healthAware: boolean;
        performanceAware: boolean;
        circuitBreakerEnabled: boolean;
        metricsWindow: number;
    } {
        const currentStrategy = this.strategies.get(this.loadBalancer.strategy);

        return {
            strategy: this.loadBalancer.strategy,
            weights: new Map(this.loadBalancer.weights),
            connections: new Map(this.loadBalancer.connections),
            lastSelected: this.loadBalancer.lastSelected,
            selector: this.loadBalancer.selector,
            availableStrategies: Array.from(this.strategies.keys()),
            healthAware: currentStrategy?.healthAware || false,
            performanceAware: currentStrategy?.performanceAware || false,
            circuitBreakerEnabled: this.circuitBreakers.size > 0,
            metricsWindow: this.metricsWindow,
        };
    }

    /**
     * Emit periodic metrics update
     */
    private emitMetricsUpdate(): void {
        this.emit("metrics:updated", {
            timestamp: Date.now(),
            distribution: this.getDistributionStats(),
            status: this.getLoadBalanceStatus(),
            efficiency: this.getLoadDistributionEfficiency(),
        });
    }

    /**
     * Get worker ranking based on current strategy
     */
    public getWorkerRanking(workers: WorkerMetrics[]): Array<{
        workerId: string;
        rank: number;
        score: number;
        health: WorkerHealth | null;
        performance: WorkerPerformanceMetrics | null;
    }> {
        const rankings = workers.map((worker) => {
            const health = this.healthScores.get(worker.workerId) || null;
            const performance =
                this.performanceMetrics.get(worker.workerId) || null;

            let score = 0;

            // Calculate score based on current strategy
            switch (this.loadBalancer.strategy) {
                case "adaptive":
                    score = this.calculateAdaptiveScore(
                        worker,
                        health,
                        performance
                    );
                    break;
                case "least-response-time":
                    score = 1000 - this.getAverageResponseTime(worker.workerId);
                    break;
                case "least-connections":
                    score =
                        1000 -
                        (this.connectionCounts.get(worker.workerId) || 0);
                    break;
                case "resource-based":
                    if (performance) {
                        score =
                            200 -
                            (performance.cpuUsage + performance.memoryUsage);
                    }
                    break;
                default:
                    score = Math.random() * 100; // Random for round-robin, etc.
            }

            return {
                workerId: worker.workerId,
                rank: 0, // Will be set after sorting
                score,
                health,
                performance,
            };
        });

        // Sort by score (descending) and assign ranks
        rankings.sort((a, b) => b.score - a.score);
        rankings.forEach((ranking, index) => {
            ranking.rank = index + 1;
        });

        return rankings;
    }

    /**
     * Calculate adaptive score for worker ranking
     */
    private calculateAdaptiveScore(
        worker: WorkerMetrics,
        health: WorkerHealth | null,
        performance: WorkerPerformanceMetrics | null
    ): number {
        let score = 0;

        // Health contribution (40%)
        if (health) {
            score += health.score * 0.4;
        } else {
            score += 50 * 0.4; // Default moderate score
        }

        // Performance contribution (40%)
        if (performance) {
            const responseTimeScore = Math.max(
                0,
                100 - performance.avgResponseTime / 10
            );
            const errorRateScore = (1 - performance.errorRate) * 100;
            const throughputScore = Math.min(100, performance.throughput);

            score +=
                ((responseTimeScore + errorRateScore + throughputScore) / 3) *
                0.4;
        }

        // Load contribution (20%)
        const activeRequests = worker.requests?.activeRequests || 0;
        const loadScore = Math.max(0, 100 - activeRequests * 5);
        score += loadScore * 0.2;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Enable/disable specific workers
     */
    public setWorkerEnabled(workerId: string, enabled: boolean): void {
        if (enabled) {
            // Remove from circuit breaker or reset it
            const breaker = this.circuitBreakers.get(workerId);
            if (breaker) {
                breaker.state = "closed";
                breaker.failures = 0;
            }
        } else {
            // Force circuit breaker open
            this.circuitBreakers.set(workerId, {
                failures: 999,
                lastFailure: Date.now(),
                state: "open",
                nextAttempt: Date.now() + 86400000, // 24 hours
            });
        }

        this.emit("worker:toggled", { workerId, enabled });
    }

    /**
     * Set IPC Manager reference for worker communication
     */
    public setIPCManager(ipcManager: any): void {
        this.ipcManager = ipcManager;
    }

    /**
     * Perform  worker health ping using IPC communication
     */
    private async performWorkerHealthPing(
        worker: WorkerMetrics
    ): Promise<WorkerHealth> {
        const existingHealth = this.healthScores.get(worker.workerId) || {
            status: "healthy" as const,
            score: 100,
            lastCheck: Date.now(),
            consecutiveFailures: 0,
        };

        try {
            if (this.ipcManager) {
                // Send health ping via IPC with timeout
                const startTime = Date.now();
                const response = await Promise.race([
                    this.ipcManager.sendRequest(
                        worker.workerId,
                        "health_ping",
                        {},
                        3000
                    ),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Health ping timeout")),
                            3000
                        )
                    ),
                ]);

                const responseTime = Date.now() - startTime;

                if (response && response.status === "healthy") {
                    existingHealth.consecutiveFailures = 0;
                    existingHealth.score = Math.min(
                        100,
                        existingHealth.score + 2
                    );
                    existingHealth.status =
                        responseTime < 1000 ? "healthy" : "warning";
                } else {
                    existingHealth.consecutiveFailures++;
                    existingHealth.score = Math.max(
                        0,
                        existingHealth.score - 10
                    );
                    existingHealth.status = "warning";
                }
            } else {
                // Fallback to basic health check based on worker metrics
                if (worker.health.status === "healthy") {
                    existingHealth.consecutiveFailures = 0;
                    existingHealth.score = Math.min(
                        100,
                        existingHealth.score + 1
                    );
                    existingHealth.status = "healthy";
                } else {
                    existingHealth.consecutiveFailures++;
                    existingHealth.score = Math.max(
                        0,
                        existingHealth.score - 5
                    );
                    existingHealth.status = "warning";
                }
            }
        } catch (error) {
            // Health ping failed
            existingHealth.consecutiveFailures++;
            existingHealth.score = Math.max(0, existingHealth.score - 15);
            existingHealth.status =
                existingHealth.consecutiveFailures >= 3
                    ? "critical"
                    : "warning";
        }

        return existingHealth;
    }

    /**
     * Update historical trends data
     */
    private updateHistoricalTrends(): void {
        const now = new Date();

        // Calculate current metrics
        const totalRequests = Array.from(this.requestCounts.values()).reduce(
            (sum, count) => sum + count,
            0
        );
        const totalErrors = Array.from(this.errorCounts.values()).reduce(
            (sum, count) => sum + count,
            0
        );
        const allResponseTimes = Array.from(
            this.responseTimesHistory.values()
        ).flat();
        const avgResponseTime =
            allResponseTimes.length > 0
                ? allResponseTimes.reduce((sum, time) => sum + time, 0) /
                  allResponseTimes.length
                : 0;
        const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

        // Add to historical trends
        this.historicalTrends.requestsPerMinute.push({
            timestamp: now,
            value: totalRequests,
        });
        this.historicalTrends.averageResponseTimes.push({
            timestamp: now,
            value: avgResponseTime,
        });
        this.historicalTrends.errorRates.push({
            timestamp: now,
            value: errorRate,
        });

        // Keep only last 1000 entries for each trend
        const maxEntries = 1000;
        if (this.historicalTrends.requestsPerMinute.length > maxEntries) {
            this.historicalTrends.requestsPerMinute =
                this.historicalTrends.requestsPerMinute.slice(-maxEntries);
        }
        if (this.historicalTrends.averageResponseTimes.length > maxEntries) {
            this.historicalTrends.averageResponseTimes =
                this.historicalTrends.averageResponseTimes.slice(-maxEntries);
        }
        if (this.historicalTrends.errorRates.length > maxEntries) {
            this.historicalTrends.errorRates =
                this.historicalTrends.errorRates.slice(-maxEntries);
        }
    }

    /**
     * Perform health check on all workers
     */
    public async performHealthCheck(
        workers: WorkerMetrics[]
    ): Promise<{ [workerId: string]: WorkerHealth }> {
        const healthResults: { [workerId: string]: WorkerHealth } = {};

        for (const worker of workers) {
            try {
                //  worker health ping implementation using IPC
                const health = await this.performWorkerHealthPing(worker);

                health.lastCheck = Date.now();

                // Update health based on recent metrics
                const performance = this.performanceMetrics.get(
                    worker.workerId
                );
                if (performance) {
                    if (performance.errorRate > 0.1) {
                        // 10% error rate threshold
                        health.consecutiveFailures++;
                        health.score = Math.max(0, health.score - 20);
                    } else {
                        health.consecutiveFailures = 0;
                        health.score = Math.min(100, health.score + 5);
                    }
                }

                // Update status based on consecutive failures
                if (health.consecutiveFailures >= 3) {
                    health.status = "critical";
                } else if (health.consecutiveFailures >= 1) {
                    health.status = "warning";
                } else {
                    health.status = "healthy";
                }

                this.healthScores.set(worker.workerId, health);
                healthResults[worker.workerId] = health;
            } catch (error) {
                const health: WorkerHealth = {
                    status: "down",
                    score: 0,
                    lastCheck: Date.now(),
                    consecutiveFailures: 999,
                };

                this.healthScores.set(worker.workerId, health);
                healthResults[worker.workerId] = health;
            }
        }

        this.emit("health-check:completed", healthResults);
        return healthResults;
    }

    /**
     * Get detailed analytics for monitoring dashboards
     */
    public getAnalytics(): {
        overview: {
            totalRequests: number;
            averageResponseTime: number;
            errorRate: number;
            efficiency: number;
        };
        workers: Array<{
            workerId: string;
            requests: number;
            responseTime: number;
            errorRate: number;
            healthScore: number;
            status: string;
            throughput: number;
        }>;
        trends: {
            requestsPerMinute: number[];
            averageResponseTimes: number[];
            errorRates: number[];
        };
    } {
        const totalRequests = Array.from(this.requestCounts.values()).reduce(
            (sum, count) => sum + count,
            0
        );
        const totalErrors = Array.from(this.errorCounts.values()).reduce(
            (sum, count) => sum + count,
            0
        );

        const allResponseTimes = Array.from(this.responseTimesHistory.values())
            .flat()
            .filter((time) => time > 0);

        const averageResponseTime =
            allResponseTimes.length > 0
                ? allResponseTimes.reduce((sum, time) => sum + time, 0) /
                  allResponseTimes.length
                : 0;

        const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

        const workers = Array.from(this.requestCounts.keys()).map(
            (workerId) => {
                const requests = this.requestCounts.get(workerId) || 0;
                const responseTime = this.getAverageResponseTime(workerId);
                const errors = this.errorCounts.get(workerId) || 0;
                const workerErrorRate = requests > 0 ? errors / requests : 0;
                const health = this.healthScores.get(workerId);
                const performance = this.performanceMetrics.get(workerId);

                return {
                    workerId,
                    requests,
                    responseTime,
                    errorRate: workerErrorRate,
                    healthScore: health?.score || 0,
                    status: health?.status || "unknown",
                    throughput: performance?.throughput || 0,
                };
            }
        );

        return {
            overview: {
                totalRequests,
                averageResponseTime,
                errorRate,
                efficiency: this.getLoadDistributionEfficiency(),
            },
            workers,
            trends: {
                requestsPerMinute: this.historicalTrends.requestsPerMinute.map(
                    (t) => t.value
                ),
                averageResponseTimes:
                    this.historicalTrends.averageResponseTimes.map(
                        (t) => t.value
                    ),
                errorRates: this.historicalTrends.errorRates.map(
                    (t) => t.value
                ),
            },
        };
    }

    /**
     * Cleanup resources when shutting down
     */
    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.connectionCounts.clear();
        this.requestCounts.clear();
        this.responseTimesHistory.clear();
        this.performanceMetrics.clear();
        this.healthScores.clear();
        this.circuitBreakers.clear();
        this.requestLatencies.clear();
        this.errorCounts.clear();
        this.throughputCounters.clear();
        this.adaptiveWeights.clear();

        this.removeAllListeners();

        logger.info("cluster", " Load Balancer destroyed");
    }
}

