/**
 * XyPrissJS Cluster Factory
 * Factory pattern for creating and configuring cluster managers with intelligent defaults
 */

import * as os from "os";
import {
    ClusterConfig,
    RobustClusterManager,
    ClusterFactory as ClusterFactoryInterface,
    ClusterBuilder,
    ClusterBuilderFactory,
} from "../../types/cluster";
import { ClusterManager } from "../cluster-manager";

/**
 * Factory for creating cluster managers with intelligent configuration
 */
export class ClusterFactory implements ClusterFactoryInterface {
    private static instance: ClusterFactory;
    private static defaultConfig: Partial<ClusterConfig> = {};

    /**
     * Get singleton instance
     */
    public static getInstance(): ClusterFactory {
        if (!ClusterFactory.instance) {
            ClusterFactory.instance = new ClusterFactory();
        }
        return ClusterFactory.instance;
    }

    /**
     * Set global default configuration
     */
    public static setDefaults(config: Partial<ClusterConfig>): void {
        ClusterFactory.defaultConfig = {
            ...ClusterFactory.defaultConfig,
            ...config,
        };
    }

    /**
     * Create cluster manager with configuration
     */
    public create(config: ClusterConfig): RobustClusterManager {
        const mergedConfig = this.mergeWithDefaults(config);
        const validationResult = this.validateConfig(mergedConfig);

        if (!validationResult.valid) {
            throw new Error(
                `Invalid cluster configuration: ${validationResult.errors.join(
                    ", "
                )}`
            );
        }

        return new ClusterManager(mergedConfig);
    }

    /**
     * Create cluster manager with intelligent defaults
     */
    public createWithDefaults(): RobustClusterManager {
        const defaultConfig = this.getIntelligentDefaults();
        return this.create(defaultConfig);
    }

    /**
     * Create cluster manager optimized for specific environment
     */
    public createForEnvironment(
        env: "development" | "production" | "test"
    ): RobustClusterManager {
        const envConfig = this.getEnvironmentConfig(env);
        return this.create(envConfig);
    }

    /**
     * Validate cluster configuration
     */
    public validateConfig(config: ClusterConfig): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Validate worker count
        if (
            config.workers &&
            typeof config.workers === "number" &&
            config.workers < 1
        ) {
            errors.push("Worker count must be at least 1");
        }

        // Validate auto-scaling configuration
        if (config.autoScaling) {
            const { minWorkers, maxWorkers } = config.autoScaling;
            if (minWorkers && maxWorkers && minWorkers > maxWorkers) {
                errors.push(
                    "Minimum workers cannot be greater than maximum workers"
                );
            }
            if (minWorkers && minWorkers < 1) {
                errors.push("Minimum workers must be at least 1");
            }
        }

        // Validate health check configuration
        if (config.healthCheck) {
            const { interval, timeout } = config.healthCheck;
            if (interval && timeout && timeout >= interval) {
                errors.push("Health check timeout must be less than interval");
            }
        }

        // Validate process management
        if (config.processManagement) {
            const { maxRestarts, restartDelay } = config.processManagement;
            if (maxRestarts && maxRestarts < 0) {
                errors.push("Max restarts cannot be negative");
            }
            if (restartDelay && restartDelay < 0) {
                errors.push("Restart delay cannot be negative");
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Get recommended configuration for server type
     */
    public getRecommendedConfig(
        serverType: "api" | "web" | "microservice" | "worker"
    ): ClusterConfig {
        const baseConfig = this.getIntelligentDefaults();

        switch (serverType) {
            case "api":
                return {
                    ...baseConfig,
                    workers: "auto",
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: true,
                        minWorkers: 2,
                        maxWorkers: os.cpus().length,
                        scaleUpThreshold: {
                            cpu: 70,
                            memory: 80,
                            responseTime: 500,
                            queueLength: 20,
                        },
                    },
                    loadBalancing: {
                        strategy: "least-connections",
                        stickySession: false,
                    },
                    healthCheck: {
                        enabled: true,
                        interval: 15000,
                        timeout: 3000,
                        maxFailures: 3,
                    },
                };

            case "web":
                return {
                    ...baseConfig,
                    workers: Math.min(4, os.cpus().length),
                    loadBalancing: {
                        strategy: "round-robin",
                        stickySession: true,
                        sessionAffinityKey: "sessionId",
                    },
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: true,
                        minWorkers: 2,
                        maxWorkers: 6,
                    },
                };

            case "microservice":
                return {
                    ...baseConfig,
                    workers: 2,
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: true,
                        minWorkers: 1,
                        maxWorkers: 4,
                        scaleUpThreshold: {
                            cpu: 80,
                            memory: 85,
                            responseTime: 1000,
                        },
                    },
                    resources: {
                        maxMemoryPerWorker: "256MB",
                        maxCpuPerWorker: 50,
                    },
                };

            case "worker":
                return {
                    ...baseConfig,
                    workers: os.cpus().length,
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: false,
                    },
                    loadBalancing: {
                        strategy: "weighted",
                    },
                    processManagement: {
                        ...baseConfig.processManagement,
                        respawn: true,
                        maxRestarts: 10,
                    },
                };

            default:
                return baseConfig;
        }
    }

    /**
     * Merge configurations with intelligent precedence
     */
    public mergeConfigs(
        base: ClusterConfig,
        override: Partial<ClusterConfig>
    ): ClusterConfig {
        return this.deepMerge(base, override);
    }

    /**
     * Get intelligent defaults based on system resources
     */
    private getIntelligentDefaults(): ClusterConfig {
        const cpuCount = os.cpus().length;
        const totalMemory = os.totalmem();
        const memoryGB = Math.floor(totalMemory / (1024 * 1024 * 1024));

        return {
            enabled: true,
            workers: "auto",
            processManagement: {
                respawn: true,
                maxRestarts: 5,
                restartDelay: 1000,
                gracefulShutdownTimeout: 30000,
                killTimeout: 5000,
                zombieDetection: true,
                memoryThreshold: `${Math.min(512, memoryGB * 100)}MB`,
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
                maxWorkers: Math.max(2, cpuCount - 1),
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
            resources: {
                maxMemoryPerWorker: this._getConservativeMemoryPerWorker(
                    memoryGB,
                    cpuCount
                ),
                maxCpuPerWorker: Math.floor(100 / Math.max(2, cpuCount - 1)),
                priorityLevel: "normal",
            },
        };
    }

    /**
     * Get conservative memory per worker based on system resources
     */
    private _getConservativeMemoryPerWorker(
        memoryGB: number,
        cpuCount: number
    ): string {
        // Conservative memory allocation strategy
        if (memoryGB <= 2) {
            return "256MB"; // Very low memory systems
        } else if (memoryGB <= 4) {
            return "512MB"; // Low memory systems
        } else if (memoryGB <= 8) {
            return "512MB"; // Medium memory systems - still conservative
        } else if (memoryGB <= 16) {
            return "1GB"; // High memory systems
        } else {
            return "2GB"; // Very high memory systems
        }
    }

    /**
     * Get environment-specific configuration
     */
    private getEnvironmentConfig(
        env: "development" | "production" | "test"
    ): ClusterConfig {
        const baseConfig = this.getIntelligentDefaults();

        switch (env) {
            case "development":
                return {
                    ...baseConfig,
                    workers: 2,
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: false,
                    },
                    monitoring: {
                        ...baseConfig.monitoring,
                        logLevel: "debug",
                        metricsInterval: 30000,
                    },
                    development: {
                        hotReload: true,
                        debugMode: true,
                        profiling: false,
                    },
                    security: {
                        ...baseConfig.security,
                        encryptIPC: false,
                    },
                };

            case "production":
                return {
                    ...baseConfig,
                    workers: "auto",
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: true,
                    },
                    monitoring: {
                        ...baseConfig.monitoring,
                        logLevel: "warn",
                        collectMetrics: true,
                    },
                    security: {
                        ...baseConfig.security,
                        isolateWorkers: true,
                        sandboxMode: true,
                        resourceLimits: true,
                        encryptIPC: true,
                    },
                    resilience: {
                        circuitBreaker: {
                            enabled: true,
                            failureThreshold: 5,
                            recoveryTimeout: 60000,
                        },
                        bulkhead: {
                            enabled: true,
                            maxConcurrentRequests: 100,
                            queueSize: 50,
                        },
                    },
                };

            case "test":
                return {
                    ...baseConfig,
                    workers: 1,
                    autoScaling: {
                        ...baseConfig.autoScaling,
                        enabled: false,
                    },
                    monitoring: {
                        ...baseConfig.monitoring,
                        enabled: false,
                        logLevel: "error",
                    },
                    healthCheck: {
                        ...baseConfig.healthCheck,
                        enabled: false,
                    },
                };

            default:
                return baseConfig;
        }
    }

    /**
     * Merge configuration with defaults
     */
    private mergeWithDefaults(config: ClusterConfig): ClusterConfig {
        const defaults = ClusterFactory.defaultConfig;
        return this.deepMerge(this.getIntelligentDefaults(), defaults, config);
    }

    /**
     * Deep merge multiple configuration objects
     */
    private deepMerge(...configs: any[]): any {
        const result = {};

        for (const config of configs) {
            if (!config) continue;

            for (const key in config) {
                if (
                    config[key] &&
                    typeof config[key] === "object" &&
                    !Array.isArray(config[key])
                ) {
                    (result as any)[key] = this.deepMerge(
                        (result as any)[key] || {},
                        config[key]
                    );
                } else {
                    (result as any)[key] = config[key];
                }
            }
        }

        return result;
    }
}

/**
 * Builder pattern for cluster configuration
 */
export class ClusterConfigBuilder implements ClusterBuilder {
    private config: Partial<ClusterConfig> = {};

    public withWorkers(count: number | "auto"): ClusterBuilder {
        this.config.workers = count;
        return this;
    }

    public withHealthCheck(
        config: Partial<ClusterConfig["healthCheck"]>
    ): ClusterBuilder {
        this.config.healthCheck = { ...this.config.healthCheck, ...config };
        return this;
    }

    public withAutoScaling(
        config: Partial<ClusterConfig["autoScaling"]>
    ): ClusterBuilder {
        this.config.autoScaling = { ...this.config.autoScaling, ...config };
        return this;
    }

    public withLoadBalancing(strategy: string, options?: any): ClusterBuilder {
        this.config.loadBalancing = {
            strategy: strategy as any,
            ...options,
        };
        return this;
    }

    public withMonitoring(
        config: Partial<ClusterConfig["monitoring"]>
    ): ClusterBuilder {
        this.config.monitoring = { ...this.config.monitoring, ...config };
        return this;
    }

    public withSecurity(
        config: Partial<ClusterConfig["security"]>
    ): ClusterBuilder {
        this.config.security = { ...this.config.security, ...config };
        return this;
    }

    public withResilience(
        config: Partial<ClusterConfig["resilience"]>
    ): ClusterBuilder {
        this.config.resilience = { ...this.config.resilience, ...config };
        return this;
    }

    public enableDevelopmentMode(): ClusterBuilder {
        this.config.development = {
            hotReload: true,
            debugMode: true,
            profiling: false,
        };
        return this;
    }

    public enableProductionMode(): ClusterBuilder {
        this.config.security = {
            isolateWorkers: true,
            sandboxMode: true,
            resourceLimits: true,
            encryptIPC: true,
        };
        this.config.resilience = {
            circuitBreaker: {
                enabled: true,
                failureThreshold: 5,
                recoveryTimeout: 60000,
            },
        };
        return this;
    }

    public build(): ClusterConfig {
        return this.config as ClusterConfig;
    }

    public create(): RobustClusterManager {
        const factory = ClusterFactory.getInstance();
        return factory.create(this.build());
    }
}

/**
 * Builder factory for creating cluster builders
 */
export class ClusterBuilderFactoryImpl implements ClusterBuilderFactory {
    public create(): ClusterBuilder {
        return new ClusterConfigBuilder();
    }

    public fromConfig(config: Partial<ClusterConfig>): ClusterBuilder {
        const builder = new ClusterConfigBuilder();
        (builder as any).config = { ...config };
        return builder;
    }

    public forEnvironment(
        env: "development" | "production" | "test"
    ): ClusterBuilder {
        return this.fromConfig({});
    }
}

// Export singleton instances
export const clusterFactory = ClusterFactory.getInstance();
export const clusterBuilderFactory = new ClusterBuilderFactoryImpl();

// Convenience functions
export function createCluster(config?: ClusterConfig): RobustClusterManager {
    return config
        ? clusterFactory.create(config)
        : clusterFactory.createWithDefaults();
}

export function createClusterForEnvironment(
    env: "development" | "production" | "test"
): RobustClusterManager {
    return clusterFactory.createForEnvironment(env);
}

export function buildCluster(): ClusterBuilder {
    return clusterBuilderFactory.create();
}

