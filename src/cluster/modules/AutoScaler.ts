/**
 * XyPrissJS Auto Scaler
 * Intelligent auto-scaling with predictive analytics and resource optimization
 */

import { EventEmitter } from "events";
import { performance } from "perf_hooks";
import pidusage from "pidusage";
import {
    ClusterConfig,
    AutoScaler as AutoScalerInterface,
    ScalingDecision,
    ScalingHistory,
} from "../../types/cluster";
import {
    SecurityErrorLogger,
    createSecurityError,
    ErrorType,
    ErrorSeverity,
} from "../../../mods/security/src/utils/errorHandler";
import { func } from "../../../mods/security/src/components/fortified-function";
import { logger } from "../../server/utils/Logger";
import cluster from "cluster";
import { cpus } from "os";

/**
 * Advanced auto-scaler with machine learning-inspired decision making
 */
export class AutoScaler extends EventEmitter {
    private config: ClusterConfig;
    private errorLogger: SecurityErrorLogger;
    private autoScaler: AutoScalerInterface;
    private scalingHistory: ScalingHistory[] = [];
    private lastScalingAction = performance.now();
    private isScaling = false;
    private scalingInterval?: NodeJS.Timeout;
    private currentWorkerCount = 0;
    private workerManager?: any;
    private metricsCollector?: any;
    private scalingTimings: Map<string, number> = new Map();

    constructor(config: ClusterConfig, errorLogger: SecurityErrorLogger) {
        super();
        this.config = config;
        this.errorLogger = errorLogger;

        this.autoScaler = {
            enabled: config.autoScaling?.enabled !== false,
            minWorkers: config.autoScaling?.minWorkers || 1,
            maxWorkers: config.autoScaling?.maxWorkers || cpus().length,
            cooldownPeriod: config.autoScaling?.cooldownPeriod || 300000,
            lastScalingAction: new Date(),
            pendingActions: [],
        };

        this.setupAutoScaling();
    }

    private setupAutoScaling(): void {
        if (!this.autoScaler.enabled) return;

        this.startScalingEvaluation();
        this.emit("autoscaler:initialized", {
            minWorkers: this.autoScaler.minWorkers,
            maxWorkers: this.autoScaler.maxWorkers,
            cooldownPeriod: this.autoScaler.cooldownPeriod,
        });
    }

    private startScalingEvaluation(): void {
        const evaluationInterval = 30000;

        const fortifiedEvaluator = func(
            async () => {
                await this.evaluateScaling();
            },
            {
                ultraFast: "maximum",
                auditLog: true,
                timeout: 10000,
                errorHandling: "graceful",
            }
        );

        this.scalingInterval = setInterval(() => {
            fortifiedEvaluator().catch((error) => {
                const securityError = createSecurityError(
                    `Auto-scaling evaluation failed: ${error.message}`,
                    ErrorType.INTERNAL,
                    ErrorSeverity.MEDIUM,
                    "AUTOSCALING_ERROR",
                    { operation: "auto_scaling_evaluation" }
                );
                this.errorLogger.logError(securityError);
            });
        }, evaluationInterval);
    }

    public stopScaling(): void {
        if (this.scalingInterval) {
            clearInterval(this.scalingInterval);
            this.scalingInterval = undefined;
        }
        this.emit("autoscaler:stopped");
    }

    private async evaluateScaling(): Promise<void> {
        if (this.isScaling || !this.autoScaler.enabled) return;

        if (this.isInCooldownPeriod()) return;

        try {
            const metrics = await this.getCurrentMetrics();
            const decision = this.makeScalingDecision(metrics);

            if (decision.action !== "no-action") {
                await this.executeScaling(decision);
            }
        } catch (error: any) {
            const securityError = createSecurityError(
                `Scaling evaluation error: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.MEDIUM,
                "SCALING_EVALUATION_ERROR",
                { operation: "scaling_evaluation" }
            );
            this.errorLogger.logError(securityError);
        }
    }

    private makeScalingDecision(metrics: any): ScalingDecision {
        const scaleUpThreshold = this.config.autoScaling?.scaleUpThreshold;
        const scaleDownThreshold = this.config.autoScaling?.scaleDownThreshold;

        let action: "scale-up" | "scale-down" | "no-action" = "no-action";
        let reason = "No scaling needed";
        let confidence = 0;
        let targetWorkers = this.currentWorkerCount;

        const scaleUpReasons: string[] = [];
        let scaleUpScore = 0;

        if (scaleUpThreshold?.cpu && metrics.cpu > scaleUpThreshold.cpu) {
            scaleUpReasons.push(
                `CPU usage (${metrics.cpu}%) > threshold (${scaleUpThreshold.cpu}%)`
            );
            scaleUpScore += 30;
        }
        if (
            scaleUpThreshold?.memory &&
            metrics.memory > scaleUpThreshold.memory
        ) {
            scaleUpReasons.push(
                `Memory usage (${metrics.memory}%) > threshold (${scaleUpThreshold.memory}%)`
            );
            scaleUpScore += 25;
        }
        if (
            scaleUpThreshold?.responseTime &&
            metrics.responseTime > scaleUpThreshold.responseTime
        ) {
            scaleUpReasons.push(
                `Response time (${metrics.responseTime}ms) > threshold (${scaleUpThreshold.responseTime}ms)`
            );
            scaleUpScore += 35;
        }
        if (
            scaleUpThreshold?.queueLength &&
            metrics.queueLength > scaleUpThreshold.queueLength
        ) {
            scaleUpReasons.push(
                `Queue length (${metrics.queueLength}) > threshold (${scaleUpThreshold.queueLength})`
            );
            scaleUpScore += 40;
        }

        const scaleDownReasons: string[] = [];
        let scaleDownScore = 0;

        if (scaleDownThreshold?.cpu && metrics.cpu < scaleDownThreshold.cpu) {
            scaleDownReasons.push(
                `CPU usage (${metrics.cpu}%) < threshold (${scaleDownThreshold.cpu}%)`
            );
            scaleDownScore += 20;
        }
        if (
            scaleDownThreshold?.memory &&
            metrics.memory < scaleDownThreshold.memory
        ) {
            scaleDownReasons.push(
                `Memory usage (${metrics.memory}%) < threshold (${scaleDownThreshold.memory}%)`
            );
            scaleDownScore += 15;
        }
        if (
            scaleDownThreshold?.idleTime &&
            metrics.idleTime > scaleDownThreshold.idleTime
        ) {
            scaleDownReasons.push(
                `Idle time (${metrics.idleTime}min) > threshold (${scaleDownThreshold.idleTime}min)`
            );
            scaleDownScore += 30;
        }

        if (
            scaleUpScore >= 50 &&
            this.currentWorkerCount < this.autoScaler.maxWorkers
        ) {
            action = "scale-up";
            reason = scaleUpReasons.join(", ");
            confidence = Math.min(100, scaleUpScore);
            targetWorkers = Math.min(
                this.autoScaler.maxWorkers,
                this.currentWorkerCount +
                    (this.config.autoScaling?.scaleStep || 1)
            );
        } else if (
            scaleDownScore >= 40 &&
            this.currentWorkerCount > this.autoScaler.minWorkers
        ) {
            action = "scale-down";
            reason = scaleDownReasons.join(", ");
            confidence = Math.min(100, scaleDownScore);
            targetWorkers = Math.max(
                this.autoScaler.minWorkers,
                this.currentWorkerCount -
                    (this.config.autoScaling?.scaleStep || 1)
            );
        }

        confidence = this.adjustConfidenceBasedOnHistory(action, confidence);

        return {
            action,
            targetWorkers,
            reason,
            confidence,
            metrics: {
                cpu: metrics.cpu,
                memory: metrics.memory,
                responseTime: metrics.responseTime,
                queueLength: metrics.queueLength,
            },
        };
    }

    private adjustConfidenceBasedOnHistory(
        action: string,
        baseConfidence: number
    ): number {
        const recentHistory = this.scalingHistory
            .filter((h) => h.timestamp.getTime() > Date.now() - 3600000)
            .filter((h) => h.action === action);

        if (recentHistory.length === 0) return baseConfidence;

        const successRate =
            recentHistory.filter((h) => h.success).length /
            recentHistory.length;
        return successRate > 0.8
            ? Math.min(100, baseConfidence * 1.1)
            : successRate < 0.5
            ? Math.max(0, baseConfidence * 0.8)
            : baseConfidence;
    }

    private async executeScaling(decision: ScalingDecision): Promise<void> {
        if (decision.confidence < 60) {
            this.emit("scaling:skipped", {
                reason: "Low confidence",
                confidence: decision.confidence,
                decision: decision.action,
            });
            return;
        }

        this.isScaling = true;
        const startWorkers = this.currentWorkerCount;
        const scalingId = `${decision.action}_${Date.now()}`;
        const scalingStartTime = performance.now();
        let success = false;

        try {
            this.emit("scaling:executing", {
                action: decision.action,
                fromWorkers: startWorkers,
                toWorkers: decision.targetWorkers,
                reason: decision.reason,
                confidence: decision.confidence,
            });

            if (decision.action === "scale-up") {
                await this.scaleUp(decision.targetWorkers - startWorkers);
            } else {
                await this.scaleDown(startWorkers - decision.targetWorkers);
            }

            success = true;
            this.currentWorkerCount = decision.targetWorkers;
            this.lastScalingAction = performance.now();
            this.autoScaler.lastScalingAction = new Date();

            const scalingDuration = performance.now() - scalingStartTime;
            this.scalingTimings.set(scalingId, scalingDuration);

            this.emit("scaling:completed", {
                action: decision.action,
                fromWorkers: startWorkers,
                toWorkers: decision.targetWorkers,
                success: true,
                duration: scalingDuration,
            });
        } catch (error: any) {
            const securityError = createSecurityError(
                `Scaling execution failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "SCALING_EXECUTION_ERROR",
                { operation: "scaling_execution" }
            );
            this.errorLogger.logError(securityError);
        } finally {
            this.recordScalingHistory({
                timestamp: new Date(),
                action: decision.action as "scale-up" | "scale-down",
                fromWorkers: startWorkers,
                toWorkers: decision.targetWorkers,
                reason: decision.reason,
                success,
            });
            this.isScaling = false;
        }
    }

    public async scaleUp(count: number = 1): Promise<void> {
        const targetCount = Math.min(
            this.autoScaler.maxWorkers,
            this.currentWorkerCount + count
        );
        const actualCount = targetCount - this.currentWorkerCount;

        if (actualCount <= 0) {
            throw new Error("Cannot scale up: already at maximum workers");
        }

        this.emit("scaling:starting", {
            action: "scale-up",
            count: actualCount,
            targetCount,
        });

        try {
            const startPromises: Promise<void>[] = [];
            for (let i = 0; i < actualCount; i++) {
                startPromises.push(
                    new Promise((resolve, reject) => {
                        const worker = cluster.fork();
                        const timeout = setTimeout(() => {
                            worker.kill();
                            reject(
                                new Error(`Worker startup timeout after 8s`)
                            );
                        }, 8000);

                        worker.once("online", () => {
                            clearTimeout(timeout);
                            this.emit("worker:online", {
                                workerId: worker.id,
                                pid: worker.process.pid,
                            });
                            resolve();
                        });

                        worker.once("error", (error: Error) => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                    })
                );

                if (i < actualCount - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
            }

            await Promise.all(startPromises);
            this.currentWorkerCount = targetCount;

            this.emit("cluster:scaled", "scale-up", targetCount);
            this.emit("scaling:success", {
                action: "scale-up",
                targetCount,
                message: `Scaled up to ${targetCount} workers`,
            });
        } catch (error: any) {
            throw new Error(`Failed to scale up: ${error.message}`);
        }
    }

    public async scaleDown(count: number = 1): Promise<void> {
        const targetCount = Math.max(
            this.autoScaler.minWorkers,
            this.currentWorkerCount - count
        );
        const actualCount = this.currentWorkerCount - targetCount;

        if (actualCount <= 0) {
            throw new Error("Cannot scale down: already at minimum workers");
        }

        this.emit("scaling:starting", {
            action: "scale-down",
            count: actualCount,
            targetCount,
        });

        try {
            const workers = Object.values(cluster.workers || {}).slice(
                0,
                actualCount
            );
            const stopPromises: Promise<void>[] = [];

            for (const worker of workers) {
                if (
                    worker &&
                    typeof worker === "object" &&
                    "disconnect" in worker
                ) {
                    stopPromises.push(
                        new Promise((resolve) => {
                            const timeout = setTimeout(() => {
                                worker.kill();
                                resolve();
                            }, 8000);

                            worker.once("disconnect", () => {
                                clearTimeout(timeout);
                                this.emit("worker:disconnected", {
                                    workerId: worker.id,
                                    graceful: true,
                                });
                                resolve();
                            });

                            worker.once("error", () => {
                                clearTimeout(timeout);
                                resolve();
                            });

                            worker.disconnect();
                        })
                    );
                }
            }

            await Promise.all(stopPromises);
            this.currentWorkerCount = targetCount;

            this.emit("cluster:scaled", "scale-down", targetCount);
            this.emit("scaling:success", {
                action: "scale-down",
                targetCount,
                message: `Scaled down to ${targetCount} workers`,
            });
        } catch (error: any) {
            throw new Error(`Failed to scale down: ${error.message}`);
        }
    }

    public async autoScale(): Promise<void> {
        await this.evaluateScaling();
    }

    public async getOptimalWorkerCount(): Promise<number> {
        const metrics = await this.getCurrentMetrics();
        return this.makeScalingDecision(metrics).targetWorkers;
    }

    private isInCooldownPeriod(): boolean {
        return (
            performance.now() - this.lastScalingAction <
            this.autoScaler.cooldownPeriod
        );
    }

    private async getCurrentMetrics(): Promise<any> {
        try {
            if (this.metricsCollector) {
                const {
                    cpu,
                    memory,
                    responseTime,
                    activeWorkers,
                    totalRequests,
                    errorRate,
                } = this.metricsCollector.getAggregatedMetrics();
                return {
                    cpu,
                    memory,
                    responseTime,
                    queueLength: this.estimateQueueLength(cpu, activeWorkers),
                    idleTime: Math.max(0, (100 - cpu) / 10),
                    systemLoad: cpu,
                    systemMemory: memory,
                    workerCount: activeWorkers,
                    totalRequests,
                    errorRate,
                };
            }

            if (this.workerManager) {
                const workers = this.workerManager.getActiveWorkers();
                const workerCount = workers.length;

                if (workerCount > 0) {
                    let totalWorkerCpu = 0;
                    let totalWorkerMemory = 0;
                    let totalResponseTime = 0;
                    let totalQueueLength = 0;

                    for (const worker of workers) {
                        totalWorkerCpu += worker.cpu?.usage || 0;
                        totalWorkerMemory += worker.memory?.percentage || 0;
                        totalResponseTime +=
                            worker.requests?.averageResponseTime || 0;
                        totalQueueLength +=
                            worker.requests?.queuedRequests || 0;
                    }

                    return {
                        cpu: Math.min(100, totalWorkerCpu / workerCount),
                        memory: Math.min(100, totalWorkerMemory / workerCount),
                        responseTime: totalResponseTime / workerCount,
                        queueLength: totalQueueLength / workerCount,
                        idleTime: Math.max(
                            0,
                            (100 - totalWorkerCpu / workerCount) / 10
                        ),
                        systemLoad: totalWorkerCpu / workerCount,
                        systemMemory: totalWorkerMemory / workerCount,
                        workerCount,
                    };
                }
            }

            const workerPromises = Object.values(cluster.workers || {})
                .filter(
                    (worker): worker is NonNullable<typeof worker> =>
                        !!worker && !worker.isDead()
                )
                .map(async (worker) => {
                    try {
                        if (worker.process?.pid) {
                            const stats = await pidusage(worker.process.pid);
                            return {
                                cpu: stats.cpu,
                                memory: stats.memory / (1024 * 1024),
                            };
                        }
                        return { cpu: 0, memory: 0 };
                    } catch {
                        return { cpu: 0, memory: 0 };
                    }
                });

            const workerStats = await Promise.all(workerPromises);
            const validStats = workerStats.filter(
                (stats) => stats.cpu > 0 || stats.memory > 0
            );

            if (validStats.length > 0) {
                const avgWorkerCpu =
                    validStats.reduce((sum, stats) => sum + stats.cpu, 0) /
                    validStats.length;
                const avgWorkerMemory =
                    validStats.reduce((sum, stats) => sum + stats.memory, 0) /
                    validStats.length;

                return {
                    cpu: Math.min(100, avgWorkerCpu),
                    memory: Math.min(100, avgWorkerMemory),
                    responseTime: this.estimateResponseTime(
                        avgWorkerCpu,
                        validStats.length
                    ),
                    queueLength: this.estimateQueueLength(
                        avgWorkerCpu,
                        validStats.length
                    ),
                    idleTime: Math.max(0, (100 - avgWorkerCpu) / 10),
                    systemLoad: avgWorkerCpu,
                    systemMemory: avgWorkerMemory,
                    workerCount: validStats.length,
                };
            }

            return {
                cpu: 50,
                memory: 50,
                responseTime: 100,
                queueLength: 5,
                idleTime: 5,
                systemLoad: 50,
                systemMemory: 50,
                workerCount: this.currentWorkerCount,
            };
        } catch (error: any) {
            logger.error(
                "other",
                `Metrics collection failed: ${error.message}`
            );
            return {
                cpu: 50,
                memory: 50,
                responseTime: 100,
                queueLength: 5,
                idleTime: 5,
                systemLoad: 50,
                systemMemory: 50,
                workerCount: this.currentWorkerCount,
            };
        }
    }

    private estimateResponseTime(
        cpuUsage: number,
        workerCount: number
    ): number {
        let baseTime = 50;
        if (cpuUsage > 80) baseTime += (cpuUsage - 80) * 15;
        else if (cpuUsage > 60) baseTime += (cpuUsage - 60) * 4;

        if (workerCount > 0) {
            const optimalWorkers = cpus().length;
            if (workerCount < optimalWorkers)
                baseTime *= optimalWorkers / workerCount;
        }

        return Math.min(5000, baseTime);
    }

    private estimateQueueLength(cpuUsage: number, workerCount: number): number {
        if (cpuUsage < 50) return 0;

        let queueLength = Math.floor((cpuUsage - 50) / 8);
        if (workerCount > 0) {
            const optimalWorkers = cpus().length;
            if (workerCount < optimalWorkers)
                queueLength *= optimalWorkers / workerCount;
        }

        return Math.min(100, queueLength);
    }

    private recordScalingHistory(entry: ScalingHistory): void {
        this.scalingHistory.push(entry);
        if (this.scalingHistory.length > 100) this.scalingHistory.shift();
    }

    public updateWorkerCount(count: number): void {
        this.currentWorkerCount = count;
    }

    public getConfiguration(): AutoScalerInterface {
        return { ...this.autoScaler };
    }

    public getScalingHistory(): ScalingHistory[] {
        return [...this.scalingHistory];
    }

    public getScalingStats(): {
        totalScalingActions: number;
        successfulActions: number;
        failedActions: number;
        successRate: number;
        averageScalingTime: number;
        lastScalingAction?: Date;
    } {
        const total = this.scalingHistory.length;
        const successful = this.scalingHistory.filter((h) => h.success).length;
        return {
            totalScalingActions: total,
            successfulActions: successful,
            failedActions: total - successful,
            successRate: total > 0 ? (successful / total) * 100 : 0,
            averageScalingTime: this.calculateAverageScalingTime(),
            lastScalingAction: this.autoScaler.lastScalingAction,
        };
    }

    public enable(): void {
        this.autoScaler.enabled = true;
        this.startScalingEvaluation();
        logger.debug("other", "Auto-scaling enabled");
    }

    public disable(): void {
        this.autoScaler.enabled = false;
        this.stopScaling();
        logger.debug("other", "Auto-scaling disabled");
    }

    public isEnabled(): boolean {
        return this.autoScaler.enabled;
    }

    public setWorkerManager(workerManager: any): void {
        this.workerManager = workerManager;
    }

    public setMetricsCollector(metricsCollector: any): void {
        this.metricsCollector = metricsCollector;
    }

    private calculateAverageScalingTime(): number {
        if (this.scalingTimings.size === 0) return 0;
        const timings = Array.from(this.scalingTimings.values());
        return timings.reduce((sum, time) => sum + time, 0) / timings.length;
    }
}

