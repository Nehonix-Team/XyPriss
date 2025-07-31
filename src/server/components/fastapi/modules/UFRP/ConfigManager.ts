/**
 * XyPrissJS - Config Manager Module
 * Manages configuration for all UFRP modules
 */

import * as os from "os";
import { UFRPConfig, LegacyConfig } from "./types/ConfigTypes";
import { WorkerPoolLimits } from "./types/WorkerTypes";

export class ConfigManager {
    private config: UFRPConfig;

    constructor(config?: Partial<UFRPConfig> | LegacyConfig) {
        this.config = this.createFinalConfig(config);
    }

    private createFinalConfig(
        config?: Partial<UFRPConfig> | LegacyConfig
    ): UFRPConfig {
        // Check if it's legacy config format
        const isLegacy =
            config && ("cacheSize" in config || "maxWorkers" in config);

        if (isLegacy) {
            const legacyConfig = config as LegacyConfig;
            return this.convertLegacyConfig(legacyConfig);
        }

        // Modern config format
        const modernConfig = config as Partial<UFRPConfig>;
        return this.createDefaultConfig(modernConfig);
    }

    private convertLegacyConfig(legacy: LegacyConfig): UFRPConfig {
        return {
            cache: {
                maxSize: legacy.cacheSize || 10000,
                defaultTTL: 300000,
                enableCompression: true,
                compressionThreshold: 1024,
            },
            performance: {
                enabled: true,
                metrics: [
                    "cpu",
                    "memory",
                    "responseTime",
                    "requests",
                    "errors",
                ],
                interval: 5000,
                alerts: [],
            },
            workers: {
                cpu: {
                    min: 2,
                    max: Math.max(2, Math.floor(legacy.maxWorkers / 2)),
                },
                io: {
                    min: 2,
                    max: Math.max(2, Math.floor(legacy.maxWorkers / 4)),
                },
                maxConcurrentTasks: 100,
            },
            prediction: {
                enabled: true,
                patternRetentionTime: 600000,
                analysisInterval: 180000,
                hotPatternThreshold: 10,
            },
            security: {
                allowedHeaders: [
                    "content-type",
                    "accept",
                    "authorization",
                    "user-agent",
                    "x-request-id",
                    "x-correlation-id",
                ],
                sensitiveHeaders: ["authorization", "cookie", "x-api-key"],
                maxRequestSize: 1024 * 1024,
                rateLimits: {
                    windowMs: 60000,
                    maxRequests: 1000,
                },
            },
            metrics: {
                enabled: legacy.enableMetrics,
                collectionInterval: 5000,
                retentionPeriod: 86400000,
                alertThresholds: {
                    errorRate: 0.01,
                    responseTime: 1000,
                    memoryUsage: 0.8,
                    cpuUsage: 0.8,
                },
            },
        };
    }

    private createDefaultConfig(override?: Partial<UFRPConfig>): UFRPConfig {
        const defaults: UFRPConfig = {
            cache: {
                maxSize: 10000,
                defaultTTL: 300000,
                enableCompression: true,
                compressionThreshold: 1024,
            },
            performance: {
                enabled: true,
                metrics: [
                    "cpu",
                    "memory",
                    "responseTime",
                    "requests",
                    "errors",
                ],
                interval: 5000,
                alerts: [],
            },
            workers: {
                cpu: {
                    min: 2,
                    max: 8,
                },
                io: {
                    min: 2,
                    max: 4,
                },
                maxConcurrentTasks: 100,
            },
            prediction: {
                enabled: true,
                patternRetentionTime: 600000,
                analysisInterval: 180000,
                hotPatternThreshold: 10,
            },
            security: {
                allowedHeaders: [
                    "content-type",
                    "accept",
                    "authorization",
                    "user-agent",
                    "x-request-id",
                    "x-correlation-id",
                ],
                sensitiveHeaders: ["authorization", "cookie", "x-api-key"],
                maxRequestSize: 1024 * 1024,
                rateLimits: {
                    windowMs: 60000,
                    maxRequests: 1000,
                },
            },
            metrics: {
                enabled: true,
                collectionInterval: 5000,
                retentionPeriod: 86400000,
                alertThresholds: {
                    errorRate: 0.01,
                    responseTime: 1000,
                    memoryUsage: 0.8,
                    cpuUsage: 0.8,
                },
            },
        };

        return this.deepMerge(defaults, override || {});
    }

    private deepMerge(target: any, source: any): any {
        const result = { ...target };

        for (const key in source) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    getConfig(): UFRPConfig {
        return { ...this.config };
    }

    getCacheConfig() {
        return { ...this.config.cache };
    }

    getPerformanceConfig() {
        return { ...this.config.performance };
    }

    getWorkersConfig() {
        return { ...this.config.workers };
    }

    getPredictionConfig() {
        return { ...this.config.prediction };
    }

    getSecurityConfig() {
        return { ...this.config.security };
    }

    updateConfig(newConfig: Partial<UFRPConfig>): void {
        this.config = this.deepMerge(this.config, newConfig);
    }
}

